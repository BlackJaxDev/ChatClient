import React from "react";
import "./Dashboard.css";
import { Button } from "semantic-ui-react";
import { Route, Switch, Redirect } from "react-router-dom";

import Profile from '../server/Profile';
import Server from '../server/Server';
import Navbar from './Navbar';
import Home from './Home';

class Dashboard extends React.Component 
{
  render()
  {
    return (
      <div className="component-dashboard">
        <Navbar firebase={this.props.firebase}/>
        <Switch>
          <Route exact path="/user/:user" component={Profile} />
          <Route exact path="/server/:server" component={Server} />
          <Route component={Home} />
        </Switch>
      </div>
    );
  }
}

export default Dashboard;