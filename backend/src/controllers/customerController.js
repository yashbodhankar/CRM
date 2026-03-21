const Customer = require('../models/Customer');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { upsertDevUser, removeDevUserByEmail, findDevUserByEmail, _devUsers } = require('../store/devAuthStore');
const { generateTempPassword } = require('../utils/credentials');
const { devStore, createDevId } = require('../store/devCrmStore');

function isDevOfflineMode() {
  return process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1;
}

function matchesSearch(customer, search) {
  const q = search.toLowerCase();
  return [customer.name, customer.email, customer.company, customer.phone]
    .map((v) => String(v || '').toLowerCase())
    .some((v) => v.includes(q));
}

function toTimeline(customer) {
  return [
    ...(customer.interactions || []).map((i) => ({
      kind: 'interaction',
      type: i.type,
      title: i.title,
      details: i.details,
      at: i.happenedAt || i.createdAt,
      createdByEmail: i.createdByEmail
    })),
    ...(customer.documents || []).map((d) => ({
      kind: 'document',
      type: 'file',
      title: d.originalName,
      details: d.mimeType,
      at: d.uploadedAt,
      createdByEmail: d.uploadedByEmail,
      path: d.path,
      size: d.size
    }))
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
}

async function listCustomers(req, res, next) {
  try {
    const search = String(req.query?.search || '').trim();
    const status = String(req.query?.status || '').trim();
    const activityType = String(req.query?.activityType || '').trim();
    const from = String(req.query?.from || '').trim();
    const to = String(req.query?.to || '').trim();
    const sort = String(req.query?.sort || 'newest');

    if (isDevOfflineMode()) {
      let customers = devStore.customers.slice();
      if (search) customers = customers.filter((c) => matchesSearch(c, search));
      if (status && ['active', 'inactive', 'lead'].includes(status)) customers = customers.filter((c) => c.status === status);
      if (activityType && ['call', 'email', 'meeting', 'note'].includes(activityType)) {
        customers = customers.filter((c) => (c.interactions || []).some((i) => i.type === activityType));
      }
      if (from || to) {
        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;
        if (toDate) toDate.setHours(23, 59, 59, 999);
        customers = customers.filter((c) => {
          const created = new Date(c.createdAt || Date.now());
          if (fromDate && created < fromDate) return false;
          if (toDate && created > toDate) return false;
          return true;
        });
      }

      if (sort === 'oldest') customers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (sort === 'newest') customers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (sort === 'name_asc') customers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      if (sort === 'name_desc') customers.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));

      return res.json(customers);
    }

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }
    if (status && ['active', 'inactive', 'lead'].includes(status)) {
      query.status = status;
    }
    if (activityType && ['call', 'email', 'meeting', 'note'].includes(activityType)) {
      query['interactions.type'] = activityType;
    }
    if (from || to) {
      const range = {};
      if (from) range.$gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
      query.createdAt = range;
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 }
    };
    const customers = await Customer.find(query).sort(sortMap[sort] || sortMap.newest);
    res.json(customers);
  } catch (err) {
    next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    if (isDevOfflineMode()) {
      const now = new Date().toISOString();
      const customer = {
        _id: createDevId('customer'),
        name: req.body?.name,
        company: req.body?.company,
        email: req.body?.email,
        phone: req.body?.phone,
        address: req.body?.address,
        status: req.body?.status || 'active',
        documents: [],
        interactions: [],
        createdAt: now,
        updatedAt: now
      };
      devStore.customers.unshift(customer);

      let generatedLogin = null;
      const existingDevUser = findDevUserByEmail(customer.email);
      if (!existingDevUser) {
        const tempPassword = generateTempPassword();
        await upsertDevUser({
          name: customer.name || 'Customer',
          email: customer.email,
          password: tempPassword,
          role: 'customer'
        });
        generatedLogin = {
          email: customer.email,
          temporaryPassword: tempPassword,
          role: 'customer'
        };
      }

      return res.status(201).json({
        ...customer,
        generatedLogin
      });
    }

    const customer = await Customer.create(req.body);
    const existingUser = await User.findOne({ email: customer.email });

    let generatedLogin = null;
    if (!existingUser) {
      const tempPassword = generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      await User.create({
        name: customer.name || 'Customer',
        email: customer.email,
        password: hashedPassword,
        role: 'customer'
      });
      generatedLogin = {
        email: customer.email,
        temporaryPassword: tempPassword,
        role: 'customer'
      };
    }

    res.status(201).json({
      ...customer.toObject(),
      generatedLogin
    });
  } catch (err) {
    next(err);
  }
}

async function getCustomerById(req, res, next) {
  try {
    if (isDevOfflineMode()) {
      const customer = devStore.customers.find((c) => c._id === req.params.id);
      if (!customer) return res.status(404).json({ message: 'Customer not found' });
      return res.json(customer);
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    return res.json(customer);
  } catch (err) {
    next(err);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const id = req.params.id;
    const patch = { ...req.body };

    if (patch.status && !['active', 'inactive', 'lead'].includes(String(patch.status))) {
      return res.status(400).json({ message: 'Invalid customer status' });
    }

    if (isDevOfflineMode()) {
      const idx = devStore.customers.findIndex((c) => c._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Customer not found' });
      const prevEmail = devStore.customers[idx].email;
      devStore.customers[idx] = { ...devStore.customers[idx], ...patch, updatedAt: new Date().toISOString() };

      const current = devStore.customers[idx];
      if (patch.email && patch.email !== prevEmail) {
        const moved = removeDevUserByEmail(prevEmail);
        if (moved) {
          _devUsers.push({
            ...moved,
            name: current.name || moved.name,
            email: current.email,
            role: 'customer'
          });
        }
      }
      const linked = findDevUserByEmail(current.email);
      if (linked) {
        linked.name = current.name || linked.name;
        linked.role = 'customer';
      }

      return res.json(devStore.customers[idx]);
    }

    const before = await Customer.findById(id);
    if (!before) return res.status(404).json({ message: 'Customer not found' });

    const customer = await Customer.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const prevEmail = before.email;
    const nextEmail = customer.email;

    if (prevEmail !== nextEmail) {
      const conflictUser = await User.findOne({ email: nextEmail });
      if (conflictUser) {
        await Customer.findByIdAndUpdate(id, { email: prevEmail }, { runValidators: true });
        return res.status(409).json({ message: 'Email already used by another login account' });
      }
    }

    let linkedUser = await User.findOne({ email: prevEmail });
    if (!linkedUser && prevEmail !== nextEmail) {
      linkedUser = await User.findOne({ email: nextEmail });
    }
    if (linkedUser) {
      linkedUser.name = customer.name || linkedUser.name;
      linkedUser.email = nextEmail;
      linkedUser.role = 'customer';
      await linkedUser.save();
    }

    return res.json(customer);
  } catch (err) {
    next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    if (isDevOfflineMode()) {
      const idx = devStore.customers.findIndex((c) => c._id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'Customer not found' });
      const removed = devStore.customers.splice(idx, 1)[0];
      removeDevUserByEmail(removed.email);
      return res.json(removed);
    }

    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    await User.deleteOne({ email: customer.email, role: 'customer' });
    return res.json(customer);
  } catch (err) {
    next(err);
  }
}

async function uploadCustomerDocument(req, res, next) {
  try {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'File is required' });
    }

    if (isDevOfflineMode()) {
      const idx = devStore.customers.findIndex((c) => c._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Customer not found' });

      devStore.customers[idx].documents = devStore.customers[idx].documents || [];
      devStore.customers[idx].documents.unshift({
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        uploadedByEmail: req.user?.email,
        uploadedAt: new Date()
      });
      devStore.customers[idx].updatedAt = new Date().toISOString();
      return res.json(devStore.customers[idx]);
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    customer.documents.unshift({
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedByEmail: req.user?.email,
      uploadedAt: new Date()
    });

    await customer.save();
    return res.json(customer);
  } catch (err) {
    next(err);
  }
}

async function addCustomerInteraction(req, res, next) {
  try {
    const id = req.params.id;

    const type = String(req.body?.type || 'note').trim();
    const title = String(req.body?.title || '').trim();
    const details = String(req.body?.details || '').trim();
    const happenedAt = req.body?.happenedAt ? new Date(req.body.happenedAt) : new Date();

    if (!title) {
      return res.status(400).json({ message: 'Interaction title is required' });
    }

    if (!['call', 'email', 'meeting', 'note'].includes(type)) {
      return res.status(400).json({ message: 'Invalid interaction type' });
    }

    if (isDevOfflineMode()) {
      const idx = devStore.customers.findIndex((c) => c._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Customer not found' });
      devStore.customers[idx].interactions = devStore.customers[idx].interactions || [];
      devStore.customers[idx].interactions.unshift({
        type,
        title,
        details,
        happenedAt,
        createdByEmail: req.user?.email
      });
      devStore.customers[idx].updatedAt = new Date().toISOString();
      return res.json(devStore.customers[idx]);
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    customer.interactions.unshift({
      type,
      title,
      details,
      happenedAt,
      createdByEmail: req.user?.email
    });
    await customer.save();
    return res.json(customer);
  } catch (err) {
    next(err);
  }
}

async function listCustomerTimeline(req, res, next) {
  try {
    const id = req.params.id;
    if (isDevOfflineMode()) {
      const customer = devStore.customers.find((c) => c._id === id);
      if (!customer) return res.status(404).json({ message: 'Customer not found' });
      return res.json({
        customer: {
          id: customer._id,
          name: customer.name,
          email: customer.email
        },
        timeline: toTimeline(customer)
      });
    }

    const customer = await Customer.findById(id).select('name email interactions documents');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const timeline = toTimeline(customer);

    return res.json({
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email
      },
      timeline
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  uploadCustomerDocument,
  addCustomerInteraction,
  listCustomerTimeline
};

