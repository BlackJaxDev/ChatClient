import React from "react";
import "./ServerUsers.css";

class ServerUsers extends React.Component 
{
  state = {users: []}
  
  constructor(props) 
  {
    super(props);
  }

  componentDidMount()
  {
    fetch('/users')
      .then(res => res.json())
      .then(users => this.setState({ users }));
  }

  render() 
  {
    return (
      <div className="component-server-users">
        {this.state.users.map(user => 
        <div key={user.id} className="user-display">
          {user.username}
        </div>
        )}
      </div>
    );
  }
}

export default ServerUsers;