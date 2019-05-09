
import React from "react";
import { BrowserRouter, Route } from 'react-router-dom';
import { Dimmer, Loader } from "semantic-ui-react";
import "./App.css";
import 'normalize.css';

import Dashboard from './common/Dashboard';
import Navbar from './common/Navbar';
import SignIn from './auth/SignIn';
import FirebaseApp from '../logic/FirebaseApp'
import PrivateRoute from "./PrivateRoute";

class App extends React.Component 
{
  state = 
  {
    loading: true, 
    authenticated: false, 
    user: null 
  };

  constructor(props) 
  {
    super(props);
  }
  componentWillMount() 
  {
    FirebaseApp.auth().onAuthStateChanged(user => 
    {
      if (user)
      {
        this.setState(
        {
          authenticated: true,
          currentUser: user,
          loading: false
        });
      } 
      else
      {
        this.setState(
        {
          authenticated: false,
          currentUser: null,
          loading: false
        });
      }
    });
  }
  render() 
  {
    const { authenticated, loading } = this.state;

    if (loading) 
    {
      return (
        <Dimmer active>
          <Loader>Loading...</Loader>
        </Dimmer>
      );
    }

    return (
      <BrowserRouter> 
        <Navbar/>
        <PrivateRoute exact path="/" component={Dashboard} authenticated={authenticated}/>
        <Route exact path="/signin" component={SignIn} />
      </BrowserRouter>
    );
  }
}

export default App;