const Task = require('../models/Task');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

let _devTasks = [];

function isSameDay(dateLike, compare = new Date()) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  return (
    d.getFullYear() === compare.getFullYear() &&
    d.getMonth() === compare.getMonth() &&
    d.getDate() === compare.getDate()
  );
}

function applyEmployeeTaskUpdate(task, body) {
  if (typeof body.submitted === 'boolean') {
    task.submitted = body.submitted;
    task.submittedAt = body.submitted ? new Date() : null;
  }
  if (body.status === 'completed' || body.status === 'in-progress' || body.status === 'pending') {
    task.status = body.status;
    task.completedAt = body.status === 'completed' ? new Date() : null;
  }
  return task;
}

async function getTeamEmailsForUser(email) {
  if (!email) return [];

  if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
    const { _devEmployees } = require('./employeeController');
    const me = (_devEmployees || []).find((e) => e.email === email);
    if (!me?.teamName) return [email];
    return (_devEmployees || [])
      .filter((e) => e.teamName === me.teamName)
      .map((e) => e.email)
      .filter(Boolean);
  }

  const me = await Employee.findOne({ email });
  if (!me?.teamName) return [email];
  const members = await Employee.find({ teamName: me.teamName }).select('email');
  return members.map((m) => m.email).filter(Boolean);
}

async function listTasks(req, res, next) {
  try {
    const mine = req.query.mine === 'true';
    const team = req.query.team === 'true';
    const daily = req.query.daily === 'true';
    const userEmail = req.user?.email;
    const isLead = req.user?.role === 'lead';

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      let tasks = _devTasks.slice();
      if (mine && userEmail) {
        tasks = tasks.filter((t) => t.assignedEmail === userEmail);
      } else if (team && isLead && userEmail) {
        const teamEmails = await getTeamEmailsForUser(userEmail);
        tasks = tasks.filter((t) => teamEmails.includes(t.assignedEmail));
      }
      if (daily) {
        tasks = tasks.filter((t) => isSameDay(t.dailyDate || t.deadline));
      }
      return res.json(tasks.reverse());
    }

    const query = {};
    if (mine && userEmail) {
      query.assignedEmail = userEmail;
    } else if (team && isLead && userEmail) {
      const teamEmails = await getTeamEmailsForUser(userEmail);
      query.assignedEmail = { $in: teamEmails };
    }
    if (daily) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query.dailyDate = { $gte: start, $lt: end };
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate('project', 'name')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

async function createTask(req, res, next) {
  try {
    const isLead = req.user?.role === 'lead';
    const userEmail = req.user?.email;
    const payload = { ...req.body };

    if (isLead) {
      const teamEmails = await getTeamEmailsForUser(userEmail);
      if (!payload.assignedEmail || !teamEmails.includes(payload.assignedEmail)) {
        return res.status(403).json({ message: 'Lead can assign tasks only to team members' });
      }
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const task = { _id: `dev_${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      _devTasks.push(task);
      return res.status(201).json(task);
    }
    const task = await Task.create(payload);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

async function updateTask(req, res, next) {
  try {
    const id = req.params.id;
    const isEmployee = req.user?.role === 'employee';
    const isLead = req.user?.role === 'lead';
    const userEmail = req.user?.email;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devTasks.findIndex(t => t._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });

      if (isEmployee) {
        if (_devTasks[idx].assignedEmail !== userEmail) {
          return res.status(403).json({ message: 'You can update only your assigned tasks' });
        }
        _devTasks[idx] = applyEmployeeTaskUpdate(_devTasks[idx], req.body);
      } else if (isLead) {
        const teamEmails = await getTeamEmailsForUser(userEmail);
        if (!teamEmails.includes(_devTasks[idx].assignedEmail)) {
          return res.status(403).json({ message: 'Lead can update only team tasks' });
        }
        if (req.body.assignedEmail && !teamEmails.includes(req.body.assignedEmail)) {
          return res.status(403).json({ message: 'Lead can assign only to team members' });
        }
        _devTasks[idx] = { ..._devTasks[idx], ...req.body };
      } else {
        _devTasks[idx] = { ..._devTasks[idx], ...req.body };
      }

      return res.json(_devTasks[idx]);
    }

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Not found' });

    if (isEmployee) {
      if (task.assignedEmail !== userEmail) {
        return res.status(403).json({ message: 'You can update only your assigned tasks' });
      }
      applyEmployeeTaskUpdate(task, req.body);
      await task.save();
      return res.json(task);
    }

    if (isLead) {
      const teamEmails = await getTeamEmailsForUser(userEmail);
      if (!teamEmails.includes(task.assignedEmail)) {
        return res.status(403).json({ message: 'Lead can update only team tasks' });
      }
      if (req.body.assignedEmail && !teamEmails.includes(req.body.assignedEmail)) {
        return res.status(403).json({ message: 'Lead can assign only to team members' });
      }
    }

    Object.assign(task, req.body);
    await task.save();
    res.json(task);
  } catch (err) {
    next(err);
  }
}

async function deleteTask(req, res, next) {
  try {
    const id = req.params.id;
    const isLead = req.user?.role === 'lead';
    const userEmail = req.user?.email;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devTasks.findIndex(t => t._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      if (isLead) {
        const teamEmails = await getTeamEmailsForUser(userEmail);
        if (!teamEmails.includes(_devTasks[idx].assignedEmail)) {
          return res.status(403).json({ message: 'Lead can delete only team tasks' });
        }
      }
      const removed = _devTasks.splice(idx, 1)[0];
      return res.json(removed);
    }

    if (isLead) {
      const task = await Task.findById(id);
      if (!task) return res.status(404).json({ message: 'Not found' });
      const teamEmails = await getTeamEmailsForUser(userEmail);
      if (!teamEmails.includes(task.assignedEmail)) {
        return res.status(403).json({ message: 'Lead can delete only team tasks' });
      }
      await task.deleteOne();
      return res.json(task);
    }

    const task = await Task.findByIdAndDelete(id);
    if (!task) return res.status(404).json({ message: 'Not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
}

module.exports = { listTasks, createTask, updateTask, deleteTask };

