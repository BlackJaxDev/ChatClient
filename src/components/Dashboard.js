import React from "react";
import "./Dashboard.css";
import { Button } from "semantic-ui-react";

class Dashboard extends React.Component 
{
  render()
  {
    return (
      <div className="component-dashboard">
        <Button label="Cool Button"></Button>
      </div>
    );
  }
}

export default Dashboard;