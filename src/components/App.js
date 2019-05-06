
import React from "react";
import { BrowserRouter, Switch, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import configureStore from './redux/configureStore';
import "./App.css";
import 'normalize.css';

import Dashboard from './common/Dashboard';
import Navbar from './common/Navbar';
import SignIn from './auth/SignIn';

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
      <Provider store={store}>
        <BrowserRouter> 
          <Navbar/>
          <Switch>
            <Route exact path="/" component={Dashboard} />
            <Route exact path="/signin" component={SignIn} />
          </Switch>
        </BrowserRouter>
      </Provider>
    );
  }
}

export default App;