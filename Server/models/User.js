const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  date: Date,
  message: String,
});

const UserSchema = new mongoose.Schema({
  uid: String,
  notifs: [NotificationSchema],
});

module.exports = mongoose.model('User', UserSchema, 'users');
