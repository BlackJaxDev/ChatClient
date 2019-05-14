import React from "react";
import "./Dashboard.css";
import { Button } from "semantic-ui-react";

class Dashboard extends React.Component 
{
  state = 
  {
    user: {
      username: "",
      avatarURL: "",
      friendUsernames: [],
      servers: [],
    }
  };

  render()
  {
    return (
      <div className="component-dashboard">
        
      </div>
    );
  }
}

export default Dashboard;