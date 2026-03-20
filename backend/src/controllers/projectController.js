const Project = require('../models/Project');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const { _devEmployees } = require('./employeeController');

let _devProjects = [];

function normalizeAssignedTeams(input) {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((team) => String(team || '').trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

async function listProjects(req, res, next) {
  try {
    const mine = req.query.mine === 'true';
    const userEmail = req.user?.email;
    const role = req.user?.role;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      let projects = _devProjects.slice();
      if (mine && userEmail) {
        if (role === 'customer') {
          projects = projects.filter((p) => p.customerEmail === userEmail);
        } else {
          const me = _devEmployees.find((emp) => emp.email === userEmail);
          projects = projects.filter((p) => {
            const alloc = Array.isArray(p.allocatedToEmails) ? p.allocatedToEmails : [];
            const teams = Array.isArray(p.assignedTeams) ? p.assignedTeams : [];
            return (
              alloc.includes(userEmail) ||
              p.teamLeadEmail === userEmail ||
              (me?.teamName && (teams.includes(me.teamName) || p.teamName === me.teamName))
            );
          });
        }
      }
      return res.json(projects.reverse());
    }

    const query = {};
    if (mine && userEmail) {
      if (role === 'customer') {
        const customer = await Customer.findOne({ email: userEmail });
        query.$or = [{ customerEmail: userEmail }];
        if (customer?._id) {
          query.$or.push({ client: customer._id });
        }
      } else {
        const me = await Employee.findOne({ email: userEmail });
        query.$or = [
          { allocatedToEmails: userEmail },
          { teamLeadEmail: userEmail }
        ];
        if (me?.teamName) {
          query.$or.push({ teamName: me.teamName });
          query.$or.push({ assignedTeams: me.teamName });
        }
      }
    }

    const projects = await Project.find(query)
      .populate('client', 'name company email')
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    next(err);
  }
}

async function createProject(req, res, next) {
  try {
    const payload = {
      ...req.body,
      assignedTeams: normalizeAssignedTeams(req.body?.assignedTeams)
    };

    if ((!payload.teamName || !String(payload.teamName).trim()) && payload.assignedTeams.length > 0) {
      payload.teamName = payload.assignedTeams[0];
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const project = { _id: `dev_${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      _devProjects.push(project);
      return res.status(201).json(project);
    }
    const project = await Project.create(payload);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
}

async function updateProject(req, res, next) {
  try {
    const id = req.params.id;
    const payload = {
      ...req.body,
      assignedTeams: normalizeAssignedTeams(req.body?.assignedTeams)
    };

    if ((!payload.teamName || !String(payload.teamName).trim()) && payload.assignedTeams.length > 0) {
      payload.teamName = payload.assignedTeams[0];
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devProjects.findIndex(p => p._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      _devProjects[idx] = { ..._devProjects[idx], ...payload };
      return res.json(_devProjects[idx]);
    }
    const project = await Project.findByIdAndUpdate(id, payload, { new: true });
    if (!project) return res.status(404).json({ message: 'Not found' });
    res.json(project);
  } catch (err) {
    next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    const id = req.params.id;
    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devProjects.findIndex(p => p._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      const removed = _devProjects.splice(idx, 1)[0];
      return res.json(removed);
    }
    const project = await Project.findByIdAndDelete(id);
    if (!project) return res.status(404).json({ message: 'Not found' });
    res.json(project);
  } catch (err) {
    next(err);
  }
}

module.exports = { listProjects, createProject, updateProject, deleteProject, _devProjects };

