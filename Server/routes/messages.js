const express = require('express');
const Message = require('../models/Message');

module.exports = function(io) {
  const router = express.Router();

  router.get('/:user/:otherUser', (req, res) => {
    Message.find({}, (err, messages) => {
      res.send(messages);
    });
  });

  router.post('/:user/:otherUser', async (req, res) => {
    try {
      const message = new Message(req.body);
      await message.save();
      io.emit('message', req.body);
      res.sendStatus(200);
    } catch (error) {
      res.sendStatus(500);
      console.log('error', error);
    }
  });

  return router;
};
