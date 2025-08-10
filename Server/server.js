'use strict';

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');

const messagesRouter = require('./routes/messages');
const usersRouter = require('./routes/users');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const server = http.createServer(app);
const io = socketIO(server);

const port = process.env.PORT || 3001;

app.use('/api/messages', messagesRouter(io));
app.use('/api/user', usersRouter);

io.on('connection', socket => {
  console.log(`Client ${socket.id} connected.`);
  socket.on('disconnect', () => {
    console.log(`Client ${socket.id} disconnected.`);
  });
});

mongoose.connect(process.env.DB_URL, { useNewUrlParser: true });
const db = mongoose.connection;

db.on('error', () => {
  console.error('Failed to connect to MongoDB.');
});

db.once('open', () => {
  console.log('Connected to MongoDB successfully.');
  server.listen(port, () => {
    console.log('Server is running on port', port);
  });
});
