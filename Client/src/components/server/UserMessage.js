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
      <li className="component-user-message">
        <Header as='h2'>{props.name}</Header>
        &nbsp;
        <Header as='h3'>{props.time}</Header>
        <p>{props.message}</p>
      </li>
    );
  }
}

export default UserMessage;