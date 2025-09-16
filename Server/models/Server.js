const mongoose = require('mongoose');

const ServerSchema = new mongoose.Schema({
  serverName: String,
  channels: Array,
});

module.exports = mongoose.model('Server', ServerSchema, 'servers');
