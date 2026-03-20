const Lead = require('../models/Lead');
const mongoose = require('mongoose');

let _devLeads = [];

async function listLeads(req, res, next) {
  try {
    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      return res.json(_devLeads.slice().reverse());
    }
    const leads = await Lead.find().sort({ createdAt: -1 }).populate('assignedTo', 'name email');
    res.json(leads);
  } catch (err) {
    next(err);
  }
}

async function createLead(req, res, next) {
  try {
    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const lead = { _id: `dev_${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
      _devLeads.push(lead);
      return res.status(201).json(lead);
    }
    const lead = await Lead.create(req.body);
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
      _devLeads[idx] = { ..._devLeads[idx], ...req.body };
      return res.json(_devLeads[idx]);
    }
    const lead = await Lead.findByIdAndUpdate(id, req.body, { new: true });
    if (!lead) return res.status(404).json({ message: 'Not found' });
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

module.exports = { listLeads, createLead, updateLead, deleteLead };

