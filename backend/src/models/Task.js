const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    assignedEmail: { type: String, index: true },
    assignedEmails: [{ type: String, index: true }],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    parentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    mainTaskTitle: String,
    isMainTask: { type: Boolean, default: true },
    createdByLeadEmail: String,
    sourceCustomerUpdateId: String,
    sourceType: {
      type: String,
      enum: ['manual', 'customer-feedback', 'project-initialization', 'subtask'],
      default: 'manual'
    },
    dailyDate: Date,
    deadline: Date,
    submitted: { type: Boolean, default: false },
    submittedAt: Date,
    completedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);

