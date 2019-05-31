
import React from "react";
import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom';
import { Dimmer, Loader } from "semantic-ui-react";
import "./App.css";
import 'normalize.css';
import Firebase from '../logic/FirebaseApp';
import Dashboard from './common/Dashboard';
import SignIn from './auth/SignIn';
import SignUp from './auth/SignUp';
import PrivateRoute from "./PrivateRoute";
import GuestRoute from "./GuestRoute";
import Page404 from './server/404';

class App extends React.Component 
{
  constructor(props) 
  {
    super(props);
    this.state = 
    {
      loading: true
    };
  }
  componentWillMount() 
  {
    Firebase.auth().onAuthStateChanged(user => 
    {
      if (user)
      {
        console.log("User logged in: " + user.email);
        this.setState(
        {
          loading: false
        });
      } 
      else
      {
        console.log("User logged out.");
        this.setState(
        {
          loading: false
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
        <Switch>
          <PrivateRoute exact path="/" firebase={Firebase} component={Dashboard} />
          <GuestRoute exact path="/signin" firebase={Firebase} component={SignIn} />
          <GuestRoute exact path="/signup" firebase={Firebase} component={SignUp} />
          <Route component={Page404} />
        </Switch>
      </BrowserRouter>
    );
  }
}

export default App;