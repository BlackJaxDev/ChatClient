const express = require('express');
const Message = require('../models/Message');

module.exports = function(io) {
  const router = express.Router();

    const { user, otherUser } = req.params;
    Message.find({
      $or: [
        { from: user, to: otherUser },
        { from: otherUser, to: user }
      ]
    }, (err, messages) => {
      if (err) {
        res.sendStatus(500);
        console.log('error', err);
        return;
      }
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
