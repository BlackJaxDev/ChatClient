const express = require('express');
const User = require('../models/User');

const router = express.Router();

router.get('/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    res.send(user);
  } catch (error) {
    res.sendStatus(500);
  }
});

router.post('/:uid', async (req, res) => {
  try {
    const user = new User({
      uid: req.params.uid,
      notifs: [
        {
          date: new Date(),
          message: 'Hello this is a test notification',
        },
      ],
    });

    await user.save();
    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
});

module.exports = router;
