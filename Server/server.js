'use strict';

require("dotenv").config();

var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var url = require('url');
var admin = require('firebase-admin');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = process.env.PORT || 3001;
app.set('port', port);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var MessageModel = mongoose.model('Message', {
    name : String,
    message : String
}, 'messages');
var UserModel = mongoose.model('User', {
    uid : String,
    notifs : [{
        date: Date,
        message: String,
    }],
}, 'users');
var ServerModel = mongoose.model('Server', {
    serverName : String,
    channels : Array,
}, 'servers');

//example.com/api/server/settings/cool
app.get('/api/server/settings/:name', function(req, res)
{
    const params = req.params; //params = {name:"cool"}
    var serverName = params.name;
    ServerChannelModel.find({ serverName: serverName, channelName: channelName });
})
//example.com/api/server/cool/best_channel
app.get('/api/server/:serverName/:channelName', function(req, res)
{
    const params = req.params; //params = {serverName:"cool", channelName:"best_channel"}
    var serverName = params.serverName;
    var channelName = params.channelName;
    ServerModel.find({ serverName: serverName });
})
//example.com/api/user/erg4634fhrtujf
app.get('/api/user/:uid', function(req, res)
{
    const params = req.params; //params = {uid:"erg4634fhrtujf"}
    var user = UserModel.find({ uid: params.uid });
    res.send(user);
})
app.get('/api/messages/:user/:otherUser', (req, res) =>
{
    //Return only the messages from this user to the other, not the other's messages to this user
    MessageModel.find({ }, (err, messages) => 
    {
        res.send(messages);
    })
})
app.post('/api/messages/:user/:otherUser', async (req, res) => 
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
        console.log('Message posted');
    }
})
app.post('/api/create/user/:uid', async (req, res) => 
{
    var uid = req.params.uid;
    var user = new UserModel(
    {
        uid: uid,
        notifs: [
            {
                date: new Date(),
                message: "Hello this is a test notification"
            }
        ] 
    });

    await user.save(); //Saves to database

    res.sendStatus(200);
})
app.post('/api/create/server/:serverName/:uidOwner', async (req, res) => 
{
    
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