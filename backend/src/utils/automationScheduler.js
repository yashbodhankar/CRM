const cron = require('node-cron');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Lead = require('../models/Lead');
const { notifyUsers } = require('./notify');

let started = false;

function startAutomationScheduler() {
  if (started) return;
  started = true;

  cron.schedule('0 * * * *', async () => {
    try {
      if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
        return;
      }

      const now = new Date();
      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + 1);

      const reminderTasks = await Task.find({
        status: { $ne: 'completed' },
        deadline: { $gte: now, $lte: nextDay }
      }).select('title assignedEmail assignedEmails _id');

      for (const task of reminderTasks) {
        const recipients = Array.from(new Set([
          ...(Array.isArray(task.assignedEmails) ? task.assignedEmails : []),
          task.assignedEmail
        ].filter(Boolean)));

        await notifyUsers(recipients, {
          title: 'Task reminder',
          message: `Upcoming task deadline: ${task.title}`,
          type: 'warning',
          meta: { taskId: String(task._id) }
        });
      }

      // Simple workflow automation: promote untouched "new" leads to "qualified" after 7 days.
      const staleDate = new Date(now);
      staleDate.setDate(staleDate.getDate() - 7);
      await Lead.updateMany(
        { status: 'new', createdAt: { $lt: staleDate } },
        { $set: { status: 'qualified' } }
      );
    } catch (err) {
      console.error('Automation scheduler error:', err.message);
    }
  });
}

module.exports = {
  startAutomationScheduler
};