const Project = require('../models/Project');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const Task = require('../models/Task');
const { _devEmployees } = require('./employeeController');

let _devProjects = [];

function clampPercent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function sanitizeMilestones(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map((milestone) => {
      const rawSubtasks = Array.isArray(milestone?.subtasks) ? milestone.subtasks : [];
      const subtasks = rawSubtasks
        .map((subtask) => ({
          title: String(subtask?.title || '').trim(),
          weight: Math.max(0, Number(subtask?.weight ?? 1) || 0),
          completed: !!subtask?.completed,
          _id: subtask?._id
        }))
        .filter((subtask) => subtask.title);

      return {
        title: String(milestone?.title || '').trim(),
        weight: Math.max(0, Number(milestone?.weight ?? 1) || 0),
        completed: !!milestone?.completed,
        subtasks,
        _id: milestone?._id
      };
    })
    .filter((milestone) => milestone.title);
}

function milestoneProgress(milestone) {
  const subtasks = Array.isArray(milestone?.subtasks) ? milestone.subtasks : [];
  if (subtasks.length === 0) {
    return milestone?.completed ? 1 : 0;
  }

  const subtotalWeight = subtasks.reduce((sum, subtask) => sum + Math.max(0, Number(subtask.weight || 0)), 0);
  if (subtotalWeight === 0) {
    const doneCount = subtasks.filter((subtask) => subtask.completed).length;
    return subtasks.length ? doneCount / subtasks.length : 0;
  }

  const doneWeight = subtasks.reduce((sum, subtask) => {
    if (!subtask.completed) return sum;
    return sum + Math.max(0, Number(subtask.weight || 0));
  }, 0);
  return doneWeight / subtotalWeight;
}

function calculateCompletionFromMilestones(milestones) {
  if (!Array.isArray(milestones) || milestones.length === 0) return 0;

  const totalWeight = milestones.reduce((sum, milestone) => sum + Math.max(0, Number(milestone.weight || 0)), 0);
  if (totalWeight === 0) {
    const avg = milestones.reduce((sum, milestone) => sum + milestoneProgress(milestone), 0) / milestones.length;
    return clampPercent(avg * 100);
  }

  const weightedProgress = milestones.reduce((sum, milestone) => {
    const weight = Math.max(0, Number(milestone.weight || 0));
    return sum + (weight * milestoneProgress(milestone));
  }, 0);

  return clampPercent((weightedProgress / totalWeight) * 100);
}

function calculateCompletionFromTaskStats(taskStats) {
  const total = Number(taskStats?.totalTasks || 0);
  const completed = Number(taskStats?.completedTasks || 0);
  if (total <= 0) return null;
  return clampPercent((completed / total) * 100);
}

function normalizeCompletionReview(input) {
  const review = input || {};
  return {
    submittedByLeadEmail: String(review.submittedByLeadEmail || '').trim(),
    submittedAt: review.submittedAt ? new Date(review.submittedAt) : null,
    adminVerifiedByEmail: String(review.adminVerifiedByEmail || '').trim(),
    adminVerifiedAt: review.adminVerifiedAt ? new Date(review.adminVerifiedAt) : null,
    customerVerifiedByEmail: String(review.customerVerifiedByEmail || '').trim(),
    customerVerifiedAt: review.customerVerifiedAt ? new Date(review.customerVerifiedAt) : null
  };
}

function getCompletionReviewMeta(reviewLike) {
  const review = normalizeCompletionReview(reviewLike);
  const submitted = !!review.submittedAt;
  const adminVerified = !!review.adminVerifiedAt;
  const customerVerified = !!review.customerVerifiedAt;
  return {
    submitted,
    adminVerified,
    customerVerified,
    allVerified: submitted && adminVerified && customerVerified,
    processing: submitted && !(adminVerified && customerVerified)
  };
}

function resolveProjectCompletion(projectLike, milestones, taskStats) {
  const fromTasks = calculateCompletionFromTaskStats(taskStats);
  if (fromTasks !== null) return fromTasks;
  if (Array.isArray(milestones) && milestones.length > 0) {
    return calculateCompletionFromMilestones(milestones);
  }
  return clampPercent(projectLike?.completion || 0);
}

function inferStatus(currentStatus, completion, reviewLike) {
  if (currentStatus === 'on-hold') return 'on-hold';
  const reviewMeta = getCompletionReviewMeta(reviewLike);
  if (reviewMeta.processing) return 'ongoing';
  if (completion >= 100 && (!reviewMeta.submitted || reviewMeta.allVerified)) return 'completed';
  if (completion > 0 || reviewMeta.submitted) return 'ongoing';
  return 'planned';
}

async function getProjectTaskStats(projectId) {
  if (!projectId) return { totalTasks: 0, completedTasks: 0 };

  if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
    const { _devTasks } = require('./taskController');
    const tasks = (_devTasks || []).filter((task) => String(task.project || '') === String(projectId));
    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((task) => task.status === 'completed').length
    };
  }

  const [totalTasks, completedTasks] = await Promise.all([
    Task.countDocuments({ project: projectId }),
    Task.countDocuments({ project: projectId, status: 'completed' })
  ]);

  return { totalTasks, completedTasks };
}

async function attachProjectMeta(projectLike) {
  const project = projectLike?.toObject ? projectLike.toObject() : { ...projectLike };
  const milestones = sanitizeMilestones(project.milestones || []);
  const completionReview = normalizeCompletionReview(project.completionReview || {});
  const taskStats = await getProjectTaskStats(project._id);
  const completion = resolveProjectCompletion(project, milestones, taskStats);
  const status = inferStatus(project.status, completion, completionReview);

  return {
    ...project,
    milestones,
    completion,
    status,
    completionReview,
    completionReviewMeta: getCompletionReviewMeta(completionReview),
    taskStats
  };
}

async function recalculateAndPersistProject(projectDoc) {
  const milestones = sanitizeMilestones(projectDoc.milestones || []);
  projectDoc.milestones = milestones;
  const completionReview = normalizeCompletionReview(projectDoc.completionReview || {});
  const taskStats = await getProjectTaskStats(projectDoc._id);
  projectDoc.completion = resolveProjectCompletion(projectDoc, milestones, taskStats);
  projectDoc.status = inferStatus(projectDoc.status, projectDoc.completion, completionReview);
  await projectDoc.save();
  return projectDoc;
}

function normalizeAssignedTeams(input) {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((team) => String(team || '').trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

function canLeadAccessProject(projectLike, leadEmail, leadTeamName) {
  const email = String(leadEmail || '').trim();
  if (!email || !projectLike) return false;
  if (String(projectLike.teamLeadEmail || '').trim() === email) return true;

  const allocated = Array.isArray(projectLike.allocatedToEmails) ? projectLike.allocatedToEmails : [];
  if (allocated.includes(email)) return true;

  const assignedTeams = normalizeAssignedTeams(projectLike.assignedTeams || []);
  const primaryTeam = String(projectLike.teamName || '').trim();
  const teamName = String(leadTeamName || '').trim();
  if (!teamName) return false;

  return assignedTeams.includes(teamName) || primaryTeam === teamName;
}

async function getTeamNameByEmail(email) {
  const userEmail = String(email || '').trim();
  if (!userEmail) return '';

  if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
    const match = (_devEmployees || []).find((emp) => emp.email === userEmail);
    return String(match?.teamName || '').trim();
  }

  const employee = await Employee.findOne({ email: userEmail }).select('teamName');
  return String(employee?.teamName || '').trim();
}

function normalizeTaskStatusFromCompleted(completed) {
  return completed ? 'completed' : 'pending';
}

function buildLeadAssignment(projectLike) {
  const leadEmail = String(projectLike?.teamLeadEmail || '').trim();
  if (!leadEmail) {
    return { assignedEmail: '', assignedEmails: [], createdByLeadEmail: '' };
  }
  return {
    assignedEmail: leadEmail,
    assignedEmails: [leadEmail],
    createdByLeadEmail: leadEmail
  };
}

async function createInitializationTasksForProject(projectLike) {
  const milestones = sanitizeMilestones(projectLike?.milestones || []);
  if (milestones.length === 0) return;

  const assignment = buildLeadAssignment(projectLike);

  if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
    const { _devTasks } = require('./taskController');

    milestones.forEach((milestone) => {
      const mainTaskId = `dev_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const mainTask = {
        _id: mainTaskId,
        title: milestone.title,
        description: `Initialization task for milestone: ${milestone.title}`,
        project: projectLike._id,
        ...assignment,
        isMainTask: true,
        sourceType: 'project-initialization',
        status: normalizeTaskStatusFromCompleted(milestone.completed),
        priority: 'high',
        createdAt: new Date().toISOString()
      };
      _devTasks.push(mainTask);

      (milestone.subtasks || []).forEach((subtask) => {
        _devTasks.push({
          _id: `dev_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: subtask.title,
          description: `Subtask of: ${milestone.title}`,
          project: projectLike._id,
          ...assignment,
          parentTask: mainTaskId,
          mainTaskTitle: milestone.title,
          isMainTask: false,
          sourceType: 'project-initialization',
          status: normalizeTaskStatusFromCompleted(subtask.completed),
          priority: 'medium',
          createdAt: new Date().toISOString()
        });
      });
    });
    return;
  }

  for (const milestone of milestones) {
    const mainTask = await Task.create({
      title: milestone.title,
      description: `Initialization task for milestone: ${milestone.title}`,
      project: projectLike._id,
      ...assignment,
      isMainTask: true,
      sourceType: 'project-initialization',
      status: normalizeTaskStatusFromCompleted(milestone.completed),
      priority: 'high'
    });

    if (Array.isArray(milestone.subtasks) && milestone.subtasks.length > 0) {
      const subtaskDocs = milestone.subtasks.map((subtask) => ({
        title: subtask.title,
        description: `Subtask of: ${milestone.title}`,
        project: projectLike._id,
        ...assignment,
        parentTask: mainTask._id,
        mainTaskTitle: milestone.title,
        isMainTask: false,
        sourceType: 'project-initialization',
        status: normalizeTaskStatusFromCompleted(subtask.completed),
        priority: 'medium'
      }));
      if (subtaskDocs.length > 0) {
        await Task.insertMany(subtaskDocs);
      }
    }
  }
}

async function createTaskFromCustomerUpdate(projectLike, updateLike) {
  const comment = String(updateLike?.comment || '').trim();
  if (!comment) return;

  const assignment = buildLeadAssignment(projectLike);
  const updateId = String(updateLike?._id || '');

  if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
    const { _devTasks } = require('./taskController');
    _devTasks.push({
      _id: `dev_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: `Customer improvement: ${comment.slice(0, 60)}`,
      description: comment,
      project: projectLike._id,
      ...assignment,
      isMainTask: true,
      sourceType: 'customer-feedback',
      sourceCustomerUpdateId: updateId,
      status: 'pending',
      priority: 'high',
      createdAt: new Date().toISOString()
    });
    return;
  }

  if (updateId) {
    const existing = await Task.findOne({
      project: projectLike._id,
      sourceType: 'customer-feedback',
      sourceCustomerUpdateId: updateId
    }).select('_id');
    if (existing) return;
  }

  await Task.create({
    title: `Customer improvement: ${comment.slice(0, 60)}`,
    description: comment,
    project: projectLike._id,
    ...assignment,
    isMainTask: true,
    sourceType: 'customer-feedback',
    sourceCustomerUpdateId: updateId || undefined,
    status: 'pending',
    priority: 'high'
  });
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
      const enriched = await Promise.all(projects.reverse().map(attachProjectMeta));
      return res.json(enriched);
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
    const enriched = await Promise.all(projects.map(attachProjectMeta));
    res.json(enriched);
  } catch (err) {
    next(err);
  }
}

async function createProject(req, res, next) {
  try {
    const milestones = sanitizeMilestones(req.body?.milestones || []);
    const assignedTeams = normalizeAssignedTeams(req.body?.assignedTeams);
    const payload = {
      ...req.body,
      assignedTeams,
      milestones,
      completionReview: normalizeCompletionReview(req.body?.completionReview || {}),
      completion: milestones.length > 0
        ? calculateCompletionFromMilestones(milestones)
        : clampPercent(req.body?.completion || 0)
    };

    payload.status = inferStatus(payload.status, payload.completion, payload.completionReview);

    if ((!payload.teamName || !String(payload.teamName).trim()) && payload.assignedTeams.length > 0) {
      payload.teamName = payload.assignedTeams[0];
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const project = { _id: `dev_${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      _devProjects.push(project);
      await createInitializationTasksForProject(project);
      return res.status(201).json(await attachProjectMeta(project));
    }
    const project = await Project.create(payload);
    await createInitializationTasksForProject(project);
    res.status(201).json(await attachProjectMeta(project));
  } catch (err) {
    next(err);
  }
}

async function updateProject(req, res, next) {
  try {
    const id = req.params.id;
    const payload = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assignedTeams')) {
      payload.assignedTeams = normalizeAssignedTeams(req.body?.assignedTeams);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'completionReview')) {
      payload.completionReview = normalizeCompletionReview(req.body?.completionReview || {});
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devProjects.findIndex(p => p._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });

      const current = { ..._devProjects[idx] };
      if (Object.prototype.hasOwnProperty.call(payload, 'milestones')) {
        payload.milestones = sanitizeMilestones(payload.milestones || []);
        payload.completion = payload.milestones.length > 0
          ? calculateCompletionFromMilestones(payload.milestones)
          : clampPercent(payload.completion ?? current.completion ?? 0);
      } else if (Object.prototype.hasOwnProperty.call(payload, 'completion')) {
        payload.completion = clampPercent(payload.completion || 0);
      }

      const merged = { ...current, ...payload };
      if ((!merged.teamName || !String(merged.teamName).trim()) && Array.isArray(merged.assignedTeams) && merged.assignedTeams.length > 0) {
        merged.teamName = merged.assignedTeams[0];
      }
      merged.status = inferStatus(merged.status, merged.completion || 0, merged.completionReview || {});
      _devProjects[idx] = merged;
      return res.json(await attachProjectMeta(_devProjects[idx]));
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Not found' });

    Object.assign(project, payload);
    if (Object.prototype.hasOwnProperty.call(payload, 'milestones')) {
      project.milestones = sanitizeMilestones(payload.milestones || []);
      project.completion = project.milestones.length > 0
        ? calculateCompletionFromMilestones(project.milestones)
        : clampPercent(project.completion || 0);
    } else if (Object.prototype.hasOwnProperty.call(payload, 'completion')) {
      project.completion = clampPercent(payload.completion || 0);
    }

    if ((!project.teamName || !String(project.teamName).trim()) && Array.isArray(project.assignedTeams) && project.assignedTeams.length > 0) {
      project.teamName = project.assignedTeams[0];
    }

    project.status = inferStatus(project.status, project.completion || 0, project.completionReview || {});
    await project.save();
    res.json(await attachProjectMeta(project));
  } catch (err) {
    next(err);
  }
}

async function addCustomerProjectUpdate(req, res, next) {
  try {
    const id = req.params.id;
    const comment = String(req.body?.comment || '').trim();
    if (!comment) {
      return res.status(400).json({ message: 'Comment is required' });
    }

    const email = req.user?.email;
    const name = req.user?.name;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devProjects.findIndex((p) => p._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });
      if (_devProjects[idx].customerEmail !== email) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const updates = Array.isArray(_devProjects[idx].customerUpdates) ? _devProjects[idx].customerUpdates : [];
      updates.unshift({
        _id: `dev_update_${Date.now()}`,
        comment,
        createdByEmail: email,
        createdByName: name,
        createdAt: new Date().toISOString()
      });
      _devProjects[idx].customerUpdates = updates;
      await createTaskFromCustomerUpdate(_devProjects[idx], updates[0]);
      return res.json(await attachProjectMeta(_devProjects[idx]));
    }

    const customer = await Customer.findOne({ email }).select('_id');
    const query = {
      _id: id,
      $or: [{ customerEmail: email }]
    };
    if (customer?._id) {
      query.$or.push({ client: customer._id });
    }

    const project = await Project.findOne(query);
    if (!project) {
      return res.status(404).json({ message: 'Project not found for this customer' });
    }

    project.customerUpdates.unshift({
      comment,
      createdByEmail: email,
      createdByName: name
    });

    await project.save();
    await createTaskFromCustomerUpdate(project, project.customerUpdates[0]);
    return res.json(await attachProjectMeta(project));
  } catch (err) {
    next(err);
  }
}

async function submitProjectCompletion(req, res, next) {
  try {
    const id = req.params.id;
    const leadEmail = req.user?.email;
    const leadTeamName = await getTeamNameByEmail(leadEmail);

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devProjects.findIndex((p) => p._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });

      if (!canLeadAccessProject(_devProjects[idx], leadEmail, leadTeamName)) {
        return res.status(403).json({ message: 'Lead can submit completion only for assigned projects' });
      }

      const preview = await attachProjectMeta(_devProjects[idx]);
      if (Number(preview.completion || 0) < 100) {
        return res.status(400).json({ message: 'Project completion must be 100% before lead submission' });
      }

      _devProjects[idx].completionReview = {
        submittedByLeadEmail: leadEmail,
        submittedAt: new Date().toISOString(),
        adminVerifiedByEmail: '',
        adminVerifiedAt: null,
        customerVerifiedByEmail: '',
        customerVerifiedAt: null
      };
      _devProjects[idx].status = 'ongoing';
      return res.json(await attachProjectMeta(_devProjects[idx]));
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Not found' });

    if (!canLeadAccessProject(project, leadEmail, leadTeamName)) {
      return res.status(403).json({ message: 'Lead can submit completion only for assigned projects' });
    }

    const taskStats = await getProjectTaskStats(project._id);
    const milestones = sanitizeMilestones(project.milestones || []);
    const completion = resolveProjectCompletion(project, milestones, taskStats);
    if (completion < 100) {
      return res.status(400).json({ message: 'Project completion must be 100% before lead submission' });
    }

    project.completionReview = {
      submittedByLeadEmail: leadEmail,
      submittedAt: new Date(),
      adminVerifiedByEmail: '',
      adminVerifiedAt: null,
      customerVerifiedByEmail: '',
      customerVerifiedAt: null
    };
    project.completion = completion;
    project.status = inferStatus(project.status, completion, project.completionReview);
    await project.save();

    return res.json(await attachProjectMeta(project));
  } catch (err) {
    next(err);
  }
}

async function verifyProjectCompletion(req, res, next) {
  try {
    const id = req.params.id;
    const role = req.user?.role;
    const userEmail = req.user?.email;

    if (role !== 'admin' && role !== 'customer') {
      return res.status(403).json({ message: 'Only admin or customer can verify completion' });
    }

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devProjects.findIndex((p) => p._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });

      if (role === 'customer' && _devProjects[idx].customerEmail !== userEmail) {
        return res.status(403).json({ message: 'Customer can verify only own projects' });
      }

      const review = normalizeCompletionReview(_devProjects[idx].completionReview || {});
      if (!review.submittedAt) {
        return res.status(400).json({ message: 'Lead has not submitted this project for completion yet' });
      }

      const nowIso = new Date().toISOString();
      if (role === 'admin') {
        review.adminVerifiedAt = nowIso;
        review.adminVerifiedByEmail = userEmail;
      } else {
        review.customerVerifiedAt = nowIso;
        review.customerVerifiedByEmail = userEmail;
      }

      _devProjects[idx].completionReview = review;
      const preview = await attachProjectMeta(_devProjects[idx]);
      _devProjects[idx].completion = preview.completion;
      _devProjects[idx].status = preview.status;
      return res.json(preview);
    }

    let project;
    if (role === 'customer') {
      const customer = await Customer.findOne({ email: userEmail }).select('_id');
      const query = {
        _id: id,
        $or: [{ customerEmail: userEmail }]
      };
      if (customer?._id) {
        query.$or.push({ client: customer._id });
      }
      project = await Project.findOne(query);
    } else {
      project = await Project.findById(id);
    }

    if (!project) return res.status(404).json({ message: 'Not found' });

    const review = normalizeCompletionReview(project.completionReview || {});
    if (!review.submittedAt) {
      return res.status(400).json({ message: 'Lead has not submitted this project for completion yet' });
    }

    const now = new Date();
    if (role === 'admin') {
      review.adminVerifiedAt = now;
      review.adminVerifiedByEmail = userEmail;
    } else {
      review.customerVerifiedAt = now;
      review.customerVerifiedByEmail = userEmail;
    }

    const taskStats = await getProjectTaskStats(project._id);
    const milestones = sanitizeMilestones(project.milestones || []);
    const completion = resolveProjectCompletion(project, milestones, taskStats);

    project.completionReview = review;
    project.completion = completion;
    project.status = inferStatus(project.status, completion, review);
    await project.save();

    return res.json(await attachProjectMeta(project));
  } catch (err) {
    next(err);
  }
}

async function updateMilestoneCompletion(req, res, next) {
  try {
    const { id, milestoneId } = req.params;
    const completed = !!req.body?.completed;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devProjects.findIndex((p) => p._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });

      const milestones = sanitizeMilestones(_devProjects[idx].milestones || []);
      const milestone = milestones.find((m) => String(m._id) === String(milestoneId));
      if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

      milestone.completed = completed;
      if (Array.isArray(milestone.subtasks) && milestone.subtasks.length > 0) {
        milestone.subtasks = milestone.subtasks.map((subtask) => ({ ...subtask, completed }));
      }

      _devProjects[idx].milestones = milestones;
      _devProjects[idx].completion = calculateCompletionFromMilestones(milestones);
      _devProjects[idx].status = inferStatus(_devProjects[idx].status, _devProjects[idx].completion, _devProjects[idx].completionReview || {});
      return res.json(await attachProjectMeta(_devProjects[idx]));
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Not found' });

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    milestone.completed = completed;
    if (Array.isArray(milestone.subtasks) && milestone.subtasks.length > 0) {
      milestone.subtasks.forEach((subtask) => {
        subtask.completed = completed;
      });
    }

    await recalculateAndPersistProject(project);
    return res.json(await attachProjectMeta(project));
  } catch (err) {
    next(err);
  }
}

async function updateSubtaskCompletion(req, res, next) {
  try {
    const { id, milestoneId, subtaskId } = req.params;
    const completed = !!req.body?.completed;

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const idx = _devProjects.findIndex((p) => p._id === id);
      if (idx === -1) return res.status(404).json({ message: 'Not found' });

      const milestones = sanitizeMilestones(_devProjects[idx].milestones || []);
      const milestone = milestones.find((m) => String(m._id) === String(milestoneId));
      if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

      const subtask = (milestone.subtasks || []).find((s) => String(s._id) === String(subtaskId));
      if (!subtask) return res.status(404).json({ message: 'Subtask not found' });

      subtask.completed = completed;
      milestone.completed = milestoneProgress(milestone) >= 1;
      _devProjects[idx].milestones = milestones;
      _devProjects[idx].completion = calculateCompletionFromMilestones(milestones);
      _devProjects[idx].status = inferStatus(_devProjects[idx].status, _devProjects[idx].completion, _devProjects[idx].completionReview || {});
      return res.json(await attachProjectMeta(_devProjects[idx]));
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Not found' });

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    const subtask = milestone.subtasks.id(subtaskId);
    if (!subtask) return res.status(404).json({ message: 'Subtask not found' });

    subtask.completed = completed;
    milestone.completed = milestoneProgress(milestone) >= 1;
    await recalculateAndPersistProject(project);

    return res.json(await attachProjectMeta(project));
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

module.exports = {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  addCustomerProjectUpdate,
  submitProjectCompletion,
  verifyProjectCompletion,
  updateMilestoneCompletion,
  updateSubtaskCompletion,
  _devProjects
};

