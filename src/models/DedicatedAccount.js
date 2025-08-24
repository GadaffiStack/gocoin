const mongoose = require('mongoose');

const dedicatedAccountSchema = new mongoose.Schema({
  customerId: { type: String, required: true },
  account_name: String,
  account_number: { type: String, required: true, unique: true },
  bank: Object,
  assigned: Boolean,
  currency: String,
  createdAt: { type: Date, default: Date.now },
  // ...other fields from Paystack response
});

module.exports = mongoose.model('DedicatedAccount', dedicatedAccountSchema);
