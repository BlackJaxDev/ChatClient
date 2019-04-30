import React from "react";
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from './redux/configureStore';
import "./App.css";

import Dashboard from './Dashboard'
import Navbar from './Navbar'
import SignIn from './SignIn'

const store = configureStore();

class App extends React.Component 
{
  constructor(props) 
  {
    super(props);
  }
  render() 
  {
    return (
      <Router> 
        <Provider store={store}>
          <Navbar/>
          <Switch>
            <Route exact path="/" component={Dashboard} />
            <Route path="/signin" component={SignIn} />
          </Switch>
        </Provider>
      </Router>
    );
  }
}

export default App;