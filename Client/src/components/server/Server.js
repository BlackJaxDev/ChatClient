import React from "react";
import "./Server.css";
import ServerUsers from "./ServerUsers";

class Server extends React.Component 
{
  constructor(props) 
  {
    super(props);
  }

  render() 
  {
    return (
      <div className="component-server">
        <ServerUsers></ServerUsers>
      </div>
    );
  }
}

export default Server;