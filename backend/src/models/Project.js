const mongoose = require('mongoose');

const projectSubtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    weight: { type: Number, min: 0, default: 1 },
    completed: { type: Boolean, default: false }
  },
  { _id: true }
);

const projectMilestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    weight: { type: Number, min: 0, default: 1 },
    completed: { type: Boolean, default: false },
    subtasks: { type: [projectSubtaskSchema], default: [] }
  },
  { _id: true }
);

const customerUpdateSchema = new mongoose.Schema(
  {
    comment: { type: String, required: true, trim: true },
    createdByEmail: { type: String, trim: true },
    createdByName: { type: String, trim: true }
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const completionReviewSchema = new mongoose.Schema(
  {
    submittedByLeadEmail: { type: String, trim: true },
    submittedAt: Date,
    adminVerifiedByEmail: { type: String, trim: true },
    adminVerifiedAt: Date,
    customerVerifiedByEmail: { type: String, trim: true },
    customerVerifiedAt: Date
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: String,
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerEmail: String,
    allocatedToEmails: [{ type: String }],
    assignedTeams: [{ type: String }],
    teamName: String,
    teamLeadEmail: String,
    spocName: String,
    spocEmail: String,
    spocPhone: String,
    startDate: Date,
    endDate: Date,
    completion: { type: Number, min: 0, max: 100, default: 0 },
    milestones: { type: [projectMilestoneSchema], default: [] },
    customerUpdates: { type: [customerUpdateSchema], default: [] },
    completionReview: { type: completionReviewSchema, default: {} },
    status: {
      type: String,
      enum: ['planned', 'ongoing', 'completed', 'on-hold'],
      default: 'planned'
    },
    budget: Number
  },
  { timestamps: true }
);

projectSchema.index({ customerEmail: 1 });
projectSchema.index({ client: 1 });

module.exports = mongoose.model('Project', projectSchema);

