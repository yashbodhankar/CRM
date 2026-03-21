const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: String,
    company: String,
    email: String,
    phone: String,
    address: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'lead'],
      default: 'active'
    },
    documents: {
      type: [
        {
          fileName: String,
          originalName: String,
          mimeType: String,
          size: Number,
          path: String,
          uploadedByEmail: String,
          uploadedAt: Date
        }
      ],
      default: []
    },
    interactions: {
      type: [
        {
          type: {
            type: String,
            enum: ['call', 'email', 'meeting', 'note'],
            default: 'note'
          },
          title: { type: String, required: true, trim: true },
          details: { type: String, trim: true },
          happenedAt: { type: Date, default: Date.now },
          createdByEmail: String
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

customerSchema.index({ name: 1, email: 1, status: 1 });
customerSchema.index({ 'interactions.happenedAt': -1 });

module.exports = mongoose.model('Customer', customerSchema);

