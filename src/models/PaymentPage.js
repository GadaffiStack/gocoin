const mongoose = require('mongoose');

const paymentPageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  amount: Number,
  currency: { type: String, default: 'NGN' },
  slug: String,
  id: { type: String, unique: true },
  integration: Number,
  domain: String,
  url: String,
  createdAt: { type: Date, default: Date.now },
  // ...other fields from Paystack response
});

module.exports = mongoose.model('PaymentPage', paymentPageSchema);
