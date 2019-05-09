import React from "react";
import "./Server.css";
import ServerUsers from "./ServerUsers";
import MessageList from "./MessageList";

import { Button, Icon, Form, TextArea } from "semantic-ui-react";
import axios from 'axios';
import io from 'socket.io-client';
const socket = io('http://localhost:3001');

class Server extends React.Component 
{  
  state = 
  {
    message: null,
    messages:[]
  };
  constructor(props) 
  {
    super(props);
  }
  componentDidMount()
  {
    socket.on('message', append);
    axios.get('/messages')
    .then(function (response) 
    {
      console.log(response);
      response.data.forEach(append);
    })
    .catch(function (error)
    {
      console.log(error);
    })
    .finally(function ()
    {

    });
  }
  append(message)
  {
    var timestamp = (new Date()).getTime();
    this.state.messages[message.name + ' - ' + timestamp] = message.message;
  }
  send()
  {
    axios.post('/messages', 
    {
      name: 'TestUser',
      message: this.state.message
    })
    .then(function (response) 
    {
      console.log(response);
      this.state.message = null;
    })
    .catch(function (error)
    {
      console.log(error);
    });
  }
  render() 
  {
    return (
      <div className="component-server">
        <ServerUsers/>
        <MessageList messages={this.state.messages}/>
        <Form>
          <TextArea placeholder='Type a message...' style={{ minHeight: 100 }} onChange={(e, { value }) => this.state.message=value}  />
        </Form>
        <Button icon onClick={this.send}>
          <Icon name='level up alternate' />
        </Button>
      </div>
    );
  }
}

export default Server;