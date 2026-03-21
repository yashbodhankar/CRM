const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: String,
    customerEmail: { type: String, index: true },
    value: { type: Number, default: 0 },
    stage: {
      type: String,
      enum: ['new', 'qualified', 'proposal', 'negotiation', 'converted', 'won', 'lost'],
      default: 'new'
    },
    ownerEmail: { type: String, index: true },
    expectedCloseDate: Date,
    notes: String
  },
  { timestamps: true }
);

dealSchema.index({ stage: 1, createdAt: -1 });

module.exports = mongoose.model('Deal', dealSchema);