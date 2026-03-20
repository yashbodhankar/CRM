const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    roomType: { type: String, enum: ['office', 'customer-lead'], required: true },
    text: { type: String, required: true },
    senderName: String,
    senderEmail: String,
    senderRole: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
