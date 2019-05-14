import React from "react";
import { Divider, Grid, Segment, Form, Button } from 'semantic-ui-react';
import "./SignIn.css";
import FirebaseApp from "../../logic/FirebaseApp";

class SignIn extends React.Component 
{
  state = 
  {
    email: '',
    password: ''
  }
  constructor(props) 
  {
    super(props);
    this.handleSignUp = this.handleSignUp.bind(this);
    this.handleSignIn = this.handleSignIn.bind(this);
    this.handleTextChange = this.handleTextChange.bind(this);
  }
  handleTextChange = (e) => {
    this.setState({ [event.target.name]: e.target.value })
  }
  handleSignIn(event)
  {
    event.preventDefault();
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(function() 
    {
      FirebaseApp.auth().signInWithEmailAndPassword(this.state.email, this.state.password);
      this.props.history.push("/");
    })
    .catch(function(error) 
    {
      //var errorCode = error.code;
      var errorMessage = error.message;
      alert(errorMessage);
    });
  }
  handleSignUp(event)
  {
    event.preventDefault();
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(function() 
    {
      FirebaseApp.auth().createUserWithEmailAndPassword(this.state.email, this.state.password);
      this.props.history.push("/");
    })
    .catch(function(error) 
    {
      //var errorCode = error.code;
      var errorMessage = error.message;
      alert(errorMessage);
    });
  }
  render() 
  {
    return (
      this.props.authenticated ? (
        <Redirect to="/"/>
      ) : (
        <div className="component-sign-in">
          <Form onSubmit={this.handleSignIn}>
            <Form.Input icon='user' iconPosition='left' name="email" label='Email' placeholder='Email' onChange={this.handleTextChange} />
            <Form.Input icon='lock' iconPosition='left' name="password" label='Password' placeholder='Password' type='password' onChange={this.handleTextChange}  />
            <Segment placeholder>
              <Grid columns={2} relaxed='very' stackable>
                <Grid.Column>
                  <Button content='Log In' type="submit" primary />
                </Grid.Column>
                <Grid.Column verticalAlign='middle'>
                  <Button content='Create Account' onClick={this.handleSignUp} />
                </Grid.Column>
              </Grid>
              <Divider vertical>Or</Divider>
            </Segment>
          </Form>
        </div>
      )
    );
  }
}

export default SignIn;