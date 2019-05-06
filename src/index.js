'use strict';

require('dotenv').config();
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

import React from 'react';
import ReactDOM from 'react-dom';

import App from './components/App';
import * as serviceWorker from './logic/serviceWorker';

var port = process.env.PORT || 3000;
app.set('port', port);

var mongoose = require('mongoose');
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var schema = new mongoose.Schema(
{
    name : String,
    message : String
});
var MessageModel = mongoose.model('Message', schema);

app.get('/messages', (req, res) =>
{
    MessageModel.find({ }, (err, messages) => 
    {
        res.send(messages);
    })
})
app.post('/messages', async (req, res) => 
{
    try
    {
        var message = new MessageModel(req.body);
        await message.save(); //Saves to database

        io.emit('message', req.body);
        res.sendStatus(200);
    }
    catch (error)
    {
        res.sendStatus(500);
        return console.log('error', error);
    }
    finally
    {
        console.log('Message posted')
    }
})

io.on('connection', function(socket)
{
    console.log('Client ' + socket.id + ' connected.');
    socket.on('disconnect', function()
    {
        console.log('Client ' + socket.id + ' disconnected.');
    });
});

mongoose.connect(process.env.DB_URL, { useNewUrlParser: true });
const db = mongoose.connection;  
db.on('error', () =>
{
    console.error('Failed to connect to MongoDB.');  
});  
db.once('open', () =>
{
    console.log("Connected to MongoDB successfully.");
    var server = http.listen(port, () => 
    {
        console.log('Server is running on port', server.address().port);
    });
});

ReactDOM.render(<App />, document.getElementById('content'));
serviceWorker.unregister();