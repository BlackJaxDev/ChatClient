import React from "react";
import "./App.css";
import Server from "./Server";

class App extends React.Component 
{
  constructor(props) 
  {
    super(props);
    this.state = { authenticated: null };
    this.checkAuthentication = this.checkAuthentication.bind(this);
    this.checkAuthentication();
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
  }
  async checkAuthentication() 
  {
    const authenticated = await this.props.auth.isAuthenticated();
    if (authenticated !== this.state.authenticated) 
    {
      this.setState({ authenticated });
    }
  }
  componentDidUpdate()
  {
    this.checkAuthentication();
  }
  async login() 
  {
    // Redirect to '/' after login
    this.props.auth.login('/');
  }
  async logout() 
  {
    // Redirect to '/' after logout
    this.props.auth.logout('/');
  }
  render() 
  {
    if (this.state.authenticated === null)
      return null;
    
    return this.state.authenticated ? (

      //Logged in
      <div className="component-app">
        <Server></Server>
      </div>

    ) : (

      //Logged out
      <div className="component-app">
        <Server></Server>
      </div>

    );
  }
}

export default App;