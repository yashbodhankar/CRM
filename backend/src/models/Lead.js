const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    customerName: String,
    email: String,
    phone: String,
    source: String,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'negotiation', 'converted', 'won', 'lost'],
      default: 'new'
    },
    expectedValue: Number
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);

