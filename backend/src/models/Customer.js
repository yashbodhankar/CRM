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
    }
  },
  { timestamps: true }
);

customerSchema.index({ name: 1, email: 1, status: 1 });

module.exports = mongoose.model('Customer', customerSchema);

