const Lead = require('../models/Lead');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const { notifyUsers } = require('../utils/notify');
const { devStore, createDevId } = require('../store/devCrmStore');

function scoreLead(leadLike) {
  const lead = leadLike || {};
  const value = Number(lead.expectedValue || 0);
  let score = 20;
  if (value >= 100000) score += 35;
  else if (value >= 50000) score += 25;
  else if (value >= 10000) score += 10;

  const source = String(lead.source || '').toLowerCase();
  if (['referral', 'partner', 'enterprise'].includes(source)) score += 25;
  if (['website', 'inbound'].includes(source)) score += 15;

  const status = String(lead.status || '').toLowerCase();
  if (status === 'qualified') score += 10;
  if (status === 'contacted') score += 6;
  if (status === 'negotiation') score += 20;
  if (status === 'converted') score = Math.max(score, 90);
  if (status === 'won') score = 100;
  if (status === 'lost') score = Math.min(score, 10);

  return Math.max(0, Math.min(100, score));
}

async function resolveAutoAssignee() {
  if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
    return null;
  }
  const assignees = await Employee.find({ status: 'active', role: { $in: ['sales', 'lead'] } })
    .select('_id email')
    .sort({ createdAt: 1 });
  if (assignees.length === 0) return null;

  const leadCount = await Lead.countDocuments();
  return assignees[leadCount % assignees.length];
}

async function listLeads(req, res, next) {
  try {
    const search = String(req.query?.search || '').trim();
    const status = String(req.query?.status || '').trim();
    const sort = String(req.query?.sort || 'newest').trim();

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      let leads = devStore.leads.slice();
      if (search) {
        const q = search.toLowerCase();
        leads = leads.filter((lead) =>
          [lead.customerName, lead.email, lead.phone, lead.source]
            .map((v) => String(v || '').toLowerCase())
            .some((v) => v.includes(q))
        );
      }
      if (status) {
        leads = leads.filter((lead) => String(lead.status || '') === status);
      }
      if (sort === 'oldest') leads = leads.reverse();
      if (sort === 'value_desc') leads = leads.sort((a, b) => Number(b.expectedValue || 0) - Number(a.expectedValue || 0));
      if (sort === 'value_asc') leads = leads.sort((a, b) => Number(a.expectedValue || 0) - Number(b.expectedValue || 0));
      return res.json(leads);
    }

    const query = {};
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      query.status = status;
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      value_desc: { expectedValue: -1 },
      value_asc: { expectedValue: 1 }
    };

    const leads = await Lead.find(query)
      .sort(sortMap[sort] || sortMap.newest)
      .populate('assignedTo', 'name email');
    res.json(leads);
  } catch (err) {
    next(err);
  }
}

async function createLead(req, res, next) {
  try {
    const payload = { ...req.body };
    const shouldAutoAssign = payload.autoAssign === true || !payload.assignedTo;

    if (shouldAutoAssign) {
      const assignee = await resolveAutoAssignee();
      if (assignee?._id) {
        payload.assignedTo = assignee._id;
      }
    }

    if (!payload.status) {
      payload.status = 'new';
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const now = new Date().toISOString();
      const lead = { _id: createDevId('lead'), ...payload, createdAt: now, updatedAt: now };
      devStore.leads.push(lead);
      return res.status(201).json(lead);
    }

    const lead = await Lead.create(payload);
    await notifyUsers([process.env.ADMIN_EMAIL, req.user?.email].filter(Boolean), {
      title: 'New lead created',
      message: `Lead ${lead.customerName || lead.email || ''} added to pipeline`,
      type: 'info',
      meta: { leadId: String(lead._id) }
    });
    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
}

async function updateLead(req, res, next) {
  try {
    const id = req.params.id;
    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = devStore.leads.findIndex(l => l._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      const patch = { ...req.body };
      if (patch.status === 'won' && !devStore.leads[idx].expectedValue) {
        patch.expectedValue = 10000;
      }
      devStore.leads[idx] = { ...devStore.leads[idx], ...patch, updatedAt: new Date().toISOString() };
      return res.json(devStore.leads[idx]);
    }

    const patch = { ...req.body };
    if (patch.status === 'won') {
      patch.closedAt = new Date();
    }

    const lead = await Lead.findByIdAndUpdate(id, patch, { new: true });
    if (!lead) return res.status(404).json({ message: 'Not found' });

    await notifyUsers([req.user?.email].filter(Boolean), {
      title: 'Lead updated',
      message: `Lead ${lead.customerName || lead.email || ''} moved to ${lead.status}`,
      type: 'success',
      meta: { leadId: String(lead._id), status: lead.status }
    });
    res.json(lead);
  } catch (err) {
    next(err);
  }
}

async function deleteLead(req, res, next) {
  try {
    const id = req.params.id;
    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = devStore.leads.findIndex(l => l._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      const removed = devStore.leads.splice(idx, 1)[0];
      return res.json(removed);
    }
    const lead = await Lead.findByIdAndDelete(id);
    if (!lead) return res.status(404).json({ message: 'Not found' });
    res.json(lead);
  } catch (err) {
    next(err);
  }
}

async function getLeadScore(req, res, next) {
  try {
    const id = req.params.id;
    let lead;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      lead = devStore.leads.find((item) => item._id === id);
    } else {
      lead = await Lead.findById(id);
    }

    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const score = scoreLead(lead);
    const recommendation = score >= 75
      ? 'High priority: immediate follow-up recommended.'
      : score >= 45
        ? 'Medium priority: schedule within 24 hours.'
        : 'Low priority: nurture sequence recommended.';

    return res.json({
      leadId: String(lead._id),
      score,
      recommendation
    });
  } catch (err) {
    next(err);
  }
}

async function convertLeadToDeal(req, res, next) {
  try {
    const id = req.params.id;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = devStore.leads.findIndex((item) => item._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Lead not found' });

      const sourceLead = devStore.leads[idx];
      const now = new Date().toISOString();
      devStore.leads[idx] = { ...sourceLead, status: 'converted', updatedAt: now };

      const existingDealIdx = devStore.deals.findIndex((item) => item.lead === id);
      let deal;
      if (existingDealIdx >= 0) {
        deal = { ...devStore.deals[existingDealIdx], stage: 'converted', updatedAt: now };
        devStore.deals[existingDealIdx] = deal;
      } else {
        deal = {
          _id: createDevId('deal'),
          title: `Deal: ${sourceLead.customerName || sourceLead.email || 'Lead'}`,
          lead: sourceLead._id,
          customerName: sourceLead.customerName,
          customerEmail: sourceLead.email,
          value: Number(sourceLead.expectedValue || 0),
          stage: 'converted',
          ownerEmail: req.user?.email,
          createdAt: now,
          updatedAt: now
        };
        devStore.deals.unshift(deal);
      }

      return res.json({
        lead: devStore.leads[idx],
        deal
      });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    let customer = await Customer.findOne({ email: lead.email });
    if (!customer) {
      customer = await Customer.create({
        name: lead.customerName || lead.email,
        email: lead.email,
        phone: lead.phone,
        status: 'active'
      });
    }

    let deal = await Deal.findOne({ lead: lead._id });
    if (!deal) {
      deal = await Deal.create({
        title: `Deal: ${lead.customerName || lead.email || 'Lead'}`,
        lead: lead._id,
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        value: Number(lead.expectedValue || 0),
        stage: 'converted',
        ownerEmail: req.user?.email
      });
    }

    lead.status = 'converted';
    await lead.save();

    await notifyUsers([req.user?.email, customer.email].filter(Boolean), {
      title: 'Lead converted',
      message: `${lead.customerName || lead.email || 'Lead'} converted to deal`,
      type: 'success',
      meta: { leadId: String(lead._id), dealId: String(deal._id) }
    });

    return res.json({ lead, deal, customer });
  } catch (err) {
    next(err);
  }
}

module.exports = { listLeads, createLead, updateLead, deleteLead, getLeadScore, convertLeadToDeal };

