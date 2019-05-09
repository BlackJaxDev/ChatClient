import React from "react";
import "./MessageList.css";
import UserMessage from "./UserMessage";

import { Button, Icon, Form, TextArea } from "semantic-ui-react";

class MessageList extends React.Component 
{
  render() 
  {
    return (
      <div className="component-message-list">
        <ul>
        {
          Object.keys(this.props.messages).map(function(key) 
          {
            return <UserMessage name="" time="" message={this.props.messages[key]}></UserMessage>
          }.bind(this))
        }
        </ul>
      </div>
    );
  }
}

export default MessageList;