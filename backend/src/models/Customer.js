const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: String,
    company: String,
    email: String,
    phone: String,
    address: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);

