const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const Project = require('../models/Project');

let _devMessages = [];
const _typingState = new Map();

function normalizeCustomerRoomId(customerEmail, leadEmail) {
  const customer = (customerEmail || '').trim().toLowerCase();
  const lead = (leadEmail || '').trim().toLowerCase();
  return `customer-lead:${customer}::${lead}`;
}

async function listRooms(req, res, next) {
  try {
    const role = req.user?.role;
    const email = req.user?.email;
    const rooms = [];

    if (role !== 'customer') {
      rooms.push({
        id: 'office',
        type: 'office',
        name: 'Office Chat',
        description: 'Internal office communication'
      });
    }

    if (role === 'lead' || role === 'customer') {
      let projects = [];
      if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
        const { _devProjects } = require('./projectController');
        projects = _devProjects || [];
      } else {
        const query = role === 'lead' ? { teamLeadEmail: email } : { customerEmail: email };
        projects = await Project.find(query).select('customerEmail teamLeadEmail');
      }

      const seen = new Set();
      for (const p of projects) {
        if (!p.customerEmail || !p.teamLeadEmail) continue;
        const roomId = normalizeCustomerRoomId(p.customerEmail, p.teamLeadEmail);
        if (seen.has(roomId)) continue;
        seen.add(roomId);
        rooms.push({
          id: roomId,
          type: 'customer-lead',
          name: `Customer/Lead: ${p.customerEmail}`,
          customerEmail: p.customerEmail,
          leadEmail: p.teamLeadEmail
        });
      }
    }

    res.json(rooms);
  } catch (err) {
    next(err);
  }
}

function canAccessRoom(user, roomId) {
  const role = user?.role;
  const email = (user?.email || '').toLowerCase();

  if (roomId === 'office') {
    return role !== 'customer';
  }

  if (!roomId.startsWith('customer-lead:')) return false;
  const parts = roomId.replace('customer-lead:', '').split('::');
  const customer = (parts[0] || '').toLowerCase();
  const lead = (parts[1] || '').toLowerCase();

  if (role === 'customer') return email === customer;
  if (role === 'lead') return email === lead;
  if (role === 'admin' || role === 'manager') return true;
  return false;
}

function setTypingUser(roomId, user, isTyping) {
  const key = String(roomId || '');
  if (!key) return;

  const existing = _typingState.get(key) || new Map();
  const userKey = String(user?.email || user?.id || '').toLowerCase();
  if (!userKey) return;

  if (!isTyping) {
    existing.delete(userKey);
  } else {
    existing.set(userKey, {
      id: String(user?.id || userKey),
      email: user?.email || '',
      name: user?.name || 'User',
      role: user?.role || '',
      updatedAt: Date.now()
    });
  }

  if (existing.size === 0) {
    _typingState.delete(key);
  } else {
    _typingState.set(key, existing);
  }
}

function getTypingUsers(roomId, currentUser) {
  const roomMap = _typingState.get(String(roomId || '')) || new Map();
  const now = Date.now();
  const maxAgeMs = 5000;
  const currentKey = String(currentUser?.email || currentUser?.id || '').toLowerCase();
  const active = [];

  for (const [key, value] of roomMap.entries()) {
    if (!value || now - Number(value.updatedAt || 0) > maxAgeMs) {
      roomMap.delete(key);
      continue;
    }
    if (key === currentKey) {
      continue;
    }

    active.push({
      id: value.id,
      email: value.email,
      name: value.name,
      role: value.role
    });
  }

  if (roomMap.size === 0) {
    _typingState.delete(String(roomId || ''));
  }

  return active;
}

async function listMessages(req, res, next) {
  try {
    const roomId = req.query.roomId;
    if (!roomId) {
      return res.status(400).json({ message: 'roomId is required' });
    }

    if (!canAccessRoom(req.user, roomId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const messages = _devMessages.filter((m) => m.roomId === roomId).slice(-200);
      return res.json(messages);
    }

    const messages = await ChatMessage.find({ roomId }).sort({ createdAt: 1 }).limit(200);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

async function createMessage(req, res, next) {
  try {
    const { roomId, text } = req.body || {};
    if (!roomId || !text || !String(text).trim()) {
      return res.status(400).json({ message: 'roomId and text are required' });
    }

    if (!canAccessRoom(req.user, roomId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const roomType = roomId === 'office' ? 'office' : 'customer-lead';
    const payload = {
      roomId,
      roomType,
      text: String(text).trim(),
      senderName: req.user?.name || 'User',
      senderEmail: req.user?.email || '',
      senderRole: req.user?.role || ''
    };

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const msg = { _id: `dev_${Date.now()}`, ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      _devMessages.push(msg);
      setTypingUser(roomId, req.user, false);
      return res.status(201).json(msg);
    }

    const message = await ChatMessage.create(payload);
    setTypingUser(roomId, req.user, false);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

async function updateTypingStatus(req, res, next) {
  try {
    const roomId = String(req.body?.roomId || '').trim();
    const isTyping = Boolean(req.body?.isTyping);

    if (!roomId) {
      return res.status(400).json({ message: 'roomId is required' });
    }
    if (!canAccessRoom(req.user, roomId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    setTypingUser(roomId, req.user, isTyping);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function listTypingUsers(req, res, next) {
  try {
    const roomId = String(req.query?.roomId || '').trim();
    if (!roomId) {
      return res.status(400).json({ message: 'roomId is required' });
    }
    if (!canAccessRoom(req.user, roomId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return res.json(getTypingUsers(roomId, req.user));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listRooms,
  listMessages,
  createMessage,
  updateTypingStatus,
  listTypingUsers
};
