const Lead = require('../models/Lead');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const { notifyUsers } = require('../utils/notify');

let _devLeads = [];

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
  if (status === 'negotiation') score += 20;
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
      let leads = _devLeads.slice();
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
      const lead = { _id: `dev_${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      _devLeads.push(lead);
      return res.status(201).json(lead);
    }

    const lead = await Lead.create(payload);
    await notifyUsers(['admin@example.com', req.user?.email].filter(Boolean), {
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
      const idx = _devLeads.findIndex(l => l._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      const patch = { ...req.body };
      if (patch.status === 'won' && !_devLeads[idx].expectedValue) {
        patch.expectedValue = 10000;
      }
      _devLeads[idx] = { ..._devLeads[idx], ...patch };
      return res.json(_devLeads[idx]);
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
      const idx = _devLeads.findIndex(l => l._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      const removed = _devLeads.splice(idx, 1)[0];
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
      lead = _devLeads.find((item) => item._id === id);
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

module.exports = { listLeads, createLead, updateLead, deleteLead, getLeadScore };

