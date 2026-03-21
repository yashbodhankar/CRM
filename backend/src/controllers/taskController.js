const Task = require('../models/Task');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Customer = require('../models/Customer');

let _devTasks = [];

function sanitizeTaskForCustomer(taskLike) {
  const task = taskLike?.toObject ? taskLike.toObject() : taskLike;
  if (!task) return task;
  const {
    assignedEmail,
    assignedEmails,
    assignedTo,
    ...safe
  } = task;
  return safe;
}

function normalizeEmailArray(raw) {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((email) => String(email || '').trim()).filter(Boolean)));
}

function getTaskAssignedEmails(task) {
  const fromArray = normalizeEmailArray(task?.assignedEmails || []);
  if (fromArray.length > 0) return fromArray;
  if (task?.assignedEmail) return [String(task.assignedEmail).trim()];
  return [];
}

function applyTaskAssignmentPayload(payload) {
  const hasAssignedEmails = Object.prototype.hasOwnProperty.call(payload || {}, 'assignedEmails');
  const hasAssignedEmail = Object.prototype.hasOwnProperty.call(payload || {}, 'assignedEmail');
  if (!hasAssignedEmails && !hasAssignedEmail) {
    return payload;
  }

  const assignedEmails = normalizeEmailArray(payload?.assignedEmails || []);
  const fallbackSingle = String(payload?.assignedEmail || '').trim();
  const resolved = assignedEmails.length > 0
    ? assignedEmails
    : (fallbackSingle ? [fallbackSingle] : []);

  payload.assignedEmails = resolved;
  payload.assignedEmail = resolved[0] || '';
  return payload;
}

async function getCustomerProjectIds(userEmail) {
  if (!userEmail) return [];

  if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
    const { _devProjects } = require('./projectController');
    return (_devProjects || [])
      .filter((p) => p.customerEmail === userEmail)
      .map((p) => String(p._id));
  }

  const customer = await Customer.findOne({ email: userEmail }).select('_id');
  const query = { $or: [{ customerEmail: userEmail }] };
  if (customer?._id) {
    query.$or.push({ client: customer._id });
  }
  const projects = await Project.find(query).select('_id');
  return projects.map((p) => String(p._id));
}

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
    const isCustomer = req.user?.role === 'customer';

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      let tasks = _devTasks.slice();

      if (isCustomer) {
        const customerProjectIds = await getCustomerProjectIds(userEmail);
        tasks = tasks
          .filter((t) => t.project && customerProjectIds.includes(String(t.project)))
          .map(sanitizeTaskForCustomer);
      } else if (mine && userEmail) {
        tasks = tasks.filter((t) => getTaskAssignedEmails(t).includes(userEmail));
      } else if (team && isLead && userEmail) {
        const teamEmails = await getTeamEmailsForUser(userEmail);
        tasks = tasks.filter((t) => {
          const assigned = getTaskAssignedEmails(t);
          return assigned.some((email) => teamEmails.includes(email)) || t.createdByLeadEmail === userEmail;
        });
      }
      if (daily) {
        tasks = tasks.filter((t) => isSameDay(t.dailyDate || t.deadline));
      }
      return res.json(tasks.reverse());
    }

    const query = {};
    if (isCustomer) {
      const customerProjectIds = await getCustomerProjectIds(userEmail);
      query.project = { $in: customerProjectIds };
    } else if (mine && userEmail) {
      query.$or = [{ assignedEmail: userEmail }, { assignedEmails: userEmail }];
    } else if (team && isLead && userEmail) {
      const teamEmails = await getTeamEmailsForUser(userEmail);
      query.$or = [
        { assignedEmail: { $in: teamEmails } },
        { assignedEmails: { $in: teamEmails } },
        { createdByLeadEmail: userEmail }
      ];
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
      .populate('parentTask', 'title')
      .sort({ createdAt: -1 });

    if (isCustomer) {
      return res.json(tasks.map(sanitizeTaskForCustomer));
    }

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

async function createTask(req, res, next) {
  try {
    const isLead = req.user?.role === 'lead';
    const userEmail = req.user?.email;
    const payload = applyTaskAssignmentPayload({ ...req.body });

    if (isLead) {
      const teamEmails = await getTeamEmailsForUser(userEmail);
      if (payload.assignedEmails.length > 0) {
        const invalid = payload.assignedEmails.filter((email) => !teamEmails.includes(email));
        if (invalid.length > 0) {
          return res.status(403).json({ message: 'Lead can assign tasks only to team members' });
        }
      }
      payload.createdByLeadEmail = userEmail;

      if (payload.parentTask) {
        let parentTask = null;
        if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
          parentTask = _devTasks.find((task) => String(task._id) === String(payload.parentTask));
        } else {
          parentTask = await Task.findById(payload.parentTask).select('title');
        }
        if (!parentTask) {
          return res.status(400).json({ message: 'Parent (main) task not found' });
        }
        payload.mainTaskTitle = parentTask.title;
        payload.isMainTask = false;
        if (!payload.sourceType || payload.sourceType === 'manual') {
          payload.sourceType = 'subtask';
        }
      } else {
        payload.isMainTask = true;
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

    const patch = applyTaskAssignmentPayload({ ...req.body });

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devTasks.findIndex(t => t._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });

      if (isEmployee) {
        if (!getTaskAssignedEmails(_devTasks[idx]).includes(userEmail)) {
          return res.status(403).json({ message: 'You can update only your assigned tasks' });
        }
        _devTasks[idx] = applyEmployeeTaskUpdate(_devTasks[idx], patch);
      } else if (isLead) {
        const teamEmails = await getTeamEmailsForUser(userEmail);
        const existingAssigned = getTaskAssignedEmails(_devTasks[idx]);
        if (!existingAssigned.some((email) => teamEmails.includes(email)) && _devTasks[idx].createdByLeadEmail !== userEmail) {
          return res.status(403).json({ message: 'Lead can update only team tasks' });
        }
        const invalidAssigned = (patch.assignedEmails || []).filter((email) => !teamEmails.includes(email));
        if (invalidAssigned.length > 0) {
          return res.status(403).json({ message: 'Lead can assign only to team members' });
        }
        if (patch.parentTask) {
          const parentTask = _devTasks.find((task) => String(task._id) === String(patch.parentTask));
          if (!parentTask) {
            return res.status(400).json({ message: 'Parent (main) task not found' });
          }
          patch.mainTaskTitle = parentTask.title;
          patch.isMainTask = false;
        }
        _devTasks[idx] = { ..._devTasks[idx], ...patch };
      } else {
        _devTasks[idx] = { ..._devTasks[idx], ...patch };
      }

      return res.json(_devTasks[idx]);
    }

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Not found' });

    if (isEmployee) {
      if (!getTaskAssignedEmails(task).includes(userEmail)) {
        return res.status(403).json({ message: 'You can update only your assigned tasks' });
      }
      applyEmployeeTaskUpdate(task, patch);
      await task.save();
      return res.json(task);
    }

    if (isLead) {
      const teamEmails = await getTeamEmailsForUser(userEmail);
      const existingAssigned = getTaskAssignedEmails(task);
      if (!existingAssigned.some((email) => teamEmails.includes(email)) && task.createdByLeadEmail !== userEmail) {
        return res.status(403).json({ message: 'Lead can update only team tasks' });
      }
      const invalidAssigned = (patch.assignedEmails || []).filter((email) => !teamEmails.includes(email));
      if (invalidAssigned.length > 0) {
        return res.status(403).json({ message: 'Lead can assign only to team members' });
      }

      if (patch.parentTask) {
        const parentTask = await Task.findById(patch.parentTask).select('title');
        if (!parentTask) {
          return res.status(400).json({ message: 'Parent (main) task not found' });
        }
        patch.mainTaskTitle = parentTask.title;
        patch.isMainTask = false;
      }
    }

    Object.assign(task, patch);
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
        const assigned = getTaskAssignedEmails(_devTasks[idx]);
        if (!assigned.some((email) => teamEmails.includes(email)) && _devTasks[idx].createdByLeadEmail !== userEmail) {
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
      const assigned = getTaskAssignedEmails(task);
      if (!assigned.some((email) => teamEmails.includes(email)) && task.createdByLeadEmail !== userEmail) {
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

module.exports = { listTasks, createTask, updateTask, deleteTask, _devTasks };

