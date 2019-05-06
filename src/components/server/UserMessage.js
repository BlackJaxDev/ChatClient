import React from "react";
import "./UserMessage.css";

class UserMessage extends React.Component 
{
  constructor(props) 
  {
    super(props);
  }

  render() 
  {
    return (
      <div className="component-user-message">
      <Header as='h2'>{props.userName}</Header>
      &nbsp;
      <Header as='h3'>{props.sendTime}</Header>
      <p>{props.message}</p>
      </div>
    );
  }
}

export default UserMessage;