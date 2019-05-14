
import React from "react";
import firebase from "firebase";
import { BrowserRouter, Route } from 'react-router-dom';
import { Dimmer, Loader } from "semantic-ui-react";
import "./App.css";
import 'normalize.css';

import Dashboard from './common/Dashboard';
import Navbar from './common/Navbar';
import SignIn from './auth/SignIn';
import FirebaseApp from '../logic/FirebaseApp';
import PrivateRoute from "./PrivateRoute";

class App extends React.Component 
{
  constructor(props) 
  {
    super(props);
    this.state = 
    {
      loading: true,
      authenticated: false,
      user: null
    };
  }
  componentWillMount() 
  {
    console.log("App will mount.");
    FirebaseApp.auth().onAuthStateChanged(user => 
    {
      if (user)
      {
        console.log("User logged in: " + user.email);
        this.setState(
        {
          loading: false,
          authenticated: true,
          user: user
        });
      } 
      else
      {
        console.log("User logged out.");
        this.setState(
        {
          loading: false,
          authenticated: false,
          user: null
        });
      }
    });
  }
  render() 
  {
    if (this.state.loading) 
    {
      return (
        <Dimmer active>
          <Loader>Loading...</Loader>
        </Dimmer>
      );
    }

    return (
      <BrowserRouter> 
        <Navbar authenticated={this.state.authenticated}/>
        <PrivateRoute exact path="/" component={Dashboard} authenticated={this.state.authenticated}/>
        <Route exact path="/signin" component={SignIn} authenticated={this.state.authenticated} />
        <Route exact path="/user/:user" component={Profile} authenticated={this.state.authenticated} />
        <Route exact path="/server/:server" component={Server} authenticated={this.state.authenticated} />
        <Redirect from="/user" to="/" />
        <Redirect from="/server" to="/" />
      </BrowserRouter>
    );
  }
}

export default App;