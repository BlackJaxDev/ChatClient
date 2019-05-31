import React from "react";
import { Grid, Segment, Form, Button, Message } from 'semantic-ui-react';
import "./SignIn.css";
import { FirebaseContext } from '../../logic/FirebaseApp';
import firebase from 'firebase/app';
import 'firebase/auth';
import { Link } from 'react-router-dom';
import authMessages from './authMessages.json';

class SignIn extends React.Component 
{
  state = 
  {
    email: '',
    password: '',
    message: null,
  }

  constructor(props) 
  {
    super(props);
  }

  handleTextChange = (e) => 
  {
    this.setState({ [event.target.name]: e.target.value })
  }
  handleSignIn = (event) =>
  {
    event.preventDefault();
    this.props.firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(() =>
    {
      this.props.firebase.auth().signInWithEmailAndPassword(this.state.email, this.state.password).then(() =>
      {
        console.log("Signed in successfully.");
      })
      .catch((error) =>
      {
        var errorCode = error.code;
        var msg = errorCode + ': ' +  error.message;
        Object.keys(authMessages).forEach(function(code) {
          if (code === errorCode)
            msg = authMessages[code];
        });
        this.setState({message: msg});
        console.log(this.state.message);
      });
    });
  }
  render() 
  {
    return (
      <div className="component-sign-in">
        <Segment inverted placeholder>
          <Grid>
            <Grid.Row centered>
              <Grid.Column width={6} verticalAlign='middle'>
                <Form inverted onSubmit={this.handleSignIn}>
                  <Form.Input icon='mail outline' iconPosition='left' name="email" label='Email' onChange={this.handleTextChange} />
                  <Form.Input icon='lock' iconPosition='left' name="password" label='Password' type='password' onChange={this.handleTextChange}  />
                  <Button content='Log In' type="submit" primary />
                </Form>
                Or <Link to='/signup'>sign up</Link>
                {this.state.message != null && 
                <React.Fragment>
                  <Message warning>
                    <Message.Header>What the heckadoodle?</Message.Header>
                    <p>{this.state.message}</p>
                  </Message>
                </React.Fragment>}
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Segment>
      </div>
    );
  }
}
export default SignIn;