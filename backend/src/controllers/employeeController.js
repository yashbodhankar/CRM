const Employee = require('../models/Employee');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { upsertDevUser, removeDevUserByEmail } = require('../store/devAuthStore');
const { generateTempPassword, normalizeRole, defaultTeamName } = require('../utils/credentials');

// In-memory fallback storage for dev mode when DB is disabled/unavailable
let _devEmployees = [];

async function listEmployees(req, res, next) {
  try {
    const mineTeam = req.query.mineTeam === 'true';
    const userEmail = req.user?.email;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      let employees = _devEmployees.slice();
      if (mineTeam && userEmail) {
        const me = employees.find((e) => e.email === userEmail);
        if (!me?.teamName) return res.json([]);
        employees = employees.filter((e) => e.teamName === me.teamName);
      }
      return res.json(employees.reverse());
    }

    const query = {};
    if (mineTeam && userEmail) {
      const me = await Employee.findOne({ email: userEmail });
      if (!me?.teamName) return res.json([]);
      query.teamName = me.teamName;
    }

    const employees = await Employee.find(query).sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    next(err);
  }
}

async function createEmployee(req, res, next) {
  try {
    const body = { ...(req.body || {}) };
    body.role = normalizeRole(body.role);

    if (body.role === 'lead') {
      if (!body.teamName) body.teamName = defaultTeamName(body.name, body.role);
      if (!body.teamLeadEmail) body.teamLeadEmail = body.email;
    }

    if (body.role !== 'lead' && body.teamName && !body.teamLeadEmail) {
      const sourceEmployees = (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1)
        ? _devEmployees
        : await Employee.find({ teamName: body.teamName });
      const teamLead = sourceEmployees.find((e) => e.teamName === body.teamName && normalizeRole(e.role) === 'lead');
      if (teamLead?.email) body.teamLeadEmail = teamLead.email;
    }

    const tempPassword = generateTempPassword();

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const emp = {
        _id: `dev_${Date.now()}`,
        name: body.name || 'Unnamed',
        email: body.email || '',
        phone: body.phone || '',
        department: body.department || '',
        role: body.role || '',
        teamName: body.teamName || '',
        teamLeadEmail: body.teamLeadEmail || '',
        status: body.status || 'active',
        createdAt: new Date().toISOString()
      };
      _devEmployees.push(emp);

      await upsertDevUser({
        name: emp.name,
        email: emp.email,
        password: tempPassword,
        role: normalizeRole(emp.role) || 'employee'
      });

      return res.status(201).json({
        ...emp,
        generatedLogin: {
          email: emp.email,
          temporaryPassword: tempPassword,
          role: normalizeRole(emp.role) || 'employee'
        }
      });
    }

    const employee = await Employee.create(body);

    const existingUser = await User.findOne({ email: employee.email });
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      await User.create({
        name: employee.name,
        email: employee.email,
        password: hashedPassword,
        role: normalizeRole(employee.role) || 'employee'
      });
    }

    res.status(201).json({
      ...employee.toObject(),
      generatedLogin: {
        email: employee.email,
        temporaryPassword: tempPassword,
        role: normalizeRole(employee.role) || 'employee'
      }
    });
  } catch (err) {
    next(err);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const id = req.params.id;
    const isLead = req.user?.role === 'lead';
    const userEmail = req.user?.email;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devEmployees.findIndex((e) => e._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });

      if (isLead) {
        const me = _devEmployees.find((e) => e.email === userEmail);
        if (!me?.teamName || _devEmployees[idx].teamName !== me.teamName) {
          return res.status(403).json({ message: 'Lead can update only team members' });
        }
      }

      _devEmployees[idx] = { ..._devEmployees[idx], ...req.body };
      return res.json(_devEmployees[idx]);
    }

    if (isLead) {
      const me = await Employee.findOne({ email: userEmail });
      const target = await Employee.findById(id);
      if (!target) return res.status(404).json({ message: 'Not found' });
      if (!me?.teamName || target.teamName !== me.teamName) {
        return res.status(403).json({ message: 'Lead can update only team members' });
      }
      Object.assign(target, req.body);
      await target.save();
      return res.json(target);
    }

    const updated = await Employee.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteEmployee(req, res, next) {
  try {
    const id = req.params.id;
    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devEmployees.findIndex((e) => e._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      const removed = _devEmployees.splice(idx, 1)[0];
      removeDevUserByEmail(removed.email);
      return res.json(removed);
    }

    const removed = await Employee.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ message: 'Not found' });
    await User.deleteOne({ email: removed.email });
    res.json(removed);
  } catch (err) {
    next(err);
  }
}

async function myTeam(req, res, next) {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(400).json({ message: 'User email missing' });
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const me = _devEmployees.find((e) => e.email === email);
      if (!me || !me.teamName) {
        return res.json({ teamName: '', lead: null, members: [] });
      }
      const members = _devEmployees.filter((e) => e.teamName === me.teamName);
      const lead = members.find((m) => m.email === me.teamLeadEmail) || null;
      return res.json({ teamName: me.teamName, lead, members });
    }

    const me = await Employee.findOne({ email });
    if (!me || !me.teamName) {
      return res.json({ teamName: '', lead: null, members: [] });
    }

    const members = await Employee.find({ teamName: me.teamName }).sort({ name: 1 });
    const lead = members.find((m) => m.email === me.teamLeadEmail) || null;
    res.json({ teamName: me.teamName, lead, members });
  } catch (err) {
    next(err);
  }
}

module.exports = { listEmployees, createEmployee, updateEmployee, deleteEmployee, myTeam, _devEmployees };

