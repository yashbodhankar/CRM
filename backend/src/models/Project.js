const mongoose = require('mongoose');

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
    status: {
      type: String,
      enum: ['planned', 'ongoing', 'completed', 'on-hold'],
      default: 'planned'
    },
    budget: Number
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);

