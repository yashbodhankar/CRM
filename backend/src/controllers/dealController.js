const Deal = require('../models/Deal');
const mongoose = require('mongoose');
const { devStore, createDevId } = require('../store/devCrmStore');
const STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'converted'];

function isDevOfflineMode() {
  return process.env.DISABLE_AUTH === 'true';
}

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function sendDbUnavailable(res) {
  return res.status(503).json({
    message: 'Database unavailable. Please try again shortly.'
  });
}

async function listDeals(req, res, next) {
  try {
    const search = String(req.query?.search || '').trim();
    const stage = String(req.query?.stage || '').trim();
    const sort = String(req.query?.sort || 'newest').trim();

    if (isDevOfflineMode()) {
      let deals = devStore.deals.slice();
      if (search) {
        const q = search.toLowerCase();
        deals = deals.filter((deal) => [deal.title, deal.customerName, deal.customerEmail]
          .map((v) => String(v || '').toLowerCase())
          .some((v) => v.includes(q)));
      }
      if (stage) deals = deals.filter((deal) => String(deal.stage || '') === stage);
      if (sort === 'oldest') deals = deals.reverse();
      if (sort === 'value_desc') deals = deals.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
      if (sort === 'value_asc') deals = deals.sort((a, b) => Number(a.value || 0) - Number(b.value || 0));
      return res.json(deals);
    }

    if (!isDbReady()) return sendDbUnavailable(res);

    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } }
      ];
    }
    if (stage) query.stage = stage;

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      value_desc: { value: -1 },
      value_asc: { value: 1 }
    };

    const deals = await Deal.find(query)
      .populate('lead', 'customerName email status')
      .populate('customer', 'name email')
      .sort(sortMap[sort] || sortMap.newest);

    return res.json(deals);
  } catch (err) {
    next(err);
  }
}

async function createDeal(req, res, next) {
  try {
    const payload = {
      ...req.body,
      ownerEmail: req.body?.ownerEmail || req.user?.email
    };

    if (payload.stage && !STAGES.includes(String(payload.stage))) {
      return res.status(400).json({ message: 'Invalid deal stage' });
    }

    if (isDevOfflineMode()) {
      const deal = {
        _id: createDevId('deal'),
        ...payload,
        value: Number(payload.value || 0),
        stage: payload.stage || 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      devStore.deals.unshift(deal);
      return res.status(201).json(deal);
    }

    if (!isDbReady()) return sendDbUnavailable(res);

    const deal = await Deal.create(payload);
    return res.status(201).json(deal);
  } catch (err) {
    next(err);
  }
}

async function getDealById(req, res, next) {
  try {
    if (isDevOfflineMode()) {
      const deal = devStore.deals.find((item) => item._id === req.params.id);
      if (!deal) return res.status(404).json({ message: 'Deal not found' });
      return res.json(deal);
    }

    if (!isDbReady()) return sendDbUnavailable(res);

    const deal = await Deal.findById(req.params.id)
      .populate('lead', 'customerName email status')
      .populate('customer', 'name email');
    if (!deal) return res.status(404).json({ message: 'Deal not found' });
    return res.json(deal);
  } catch (err) {
    next(err);
  }
}

async function updateDeal(req, res, next) {
  try {
    const id = req.params.id;
    if (req.body?.stage && !STAGES.includes(String(req.body.stage))) {
      return res.status(400).json({ message: 'Invalid deal stage' });
    }

    if (isDevOfflineMode()) {
      const idx = devStore.deals.findIndex((item) => item._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Deal not found' });
      devStore.deals[idx] = { ...devStore.deals[idx], ...req.body, updatedAt: new Date().toISOString() };
      return res.json(devStore.deals[idx]);
    }

    if (!isDbReady()) return sendDbUnavailable(res);

    const deal = await Deal.findByIdAndUpdate(id, req.body, { new: true });
    if (!deal) return res.status(404).json({ message: 'Deal not found' });
    return res.json(deal);
  } catch (err) {
    next(err);
  }
}

async function deleteDeal(req, res, next) {
  try {
    if (isDevOfflineMode()) {
      const idx = devStore.deals.findIndex((item) => item._id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'Deal not found' });
      const removed = devStore.deals.splice(idx, 1)[0];
      return res.json(removed);
    }

    if (!isDbReady()) return sendDbUnavailable(res);

    const deal = await Deal.findByIdAndDelete(req.params.id);
    if (!deal) return res.status(404).json({ message: 'Deal not found' });
    return res.json(deal);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDeals,
  getDealById,
  createDeal,
  updateDeal,
  deleteDeal
};