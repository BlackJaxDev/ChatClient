import React from "react";
import { Grid, Segment, Form, Button, Message } from 'semantic-ui-react';
import "./SignIn.css";
import { FirebaseContext } from '../../logic/FirebaseApp';
import firebase from 'firebase/app';
import 'firebase/auth';
import { Link } from 'react-router-dom';
import authMessages from './authMessages.json';
import axios from "axios";

class SignUp extends React.Component 
{
  state = 
  {
    email: '',
    password: '',
    photoURL: '',
    displayName: '',
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
  handleSignUp = (event) =>
  {
    event.preventDefault();
    this.props.firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(() =>
    {
      this.props.firebase.auth().createUserWithEmailAndPassword(this.state.email, this.state.password)
      .then(() =>
      {
        console.log("Sending email verification.");
        firebase.auth().currentUser.sendEmailVerification();
      })
      .then(() => 
      {
        console.log("Creating user in database.");
        axios.post('http://localhost:3001/api/create/user/' + firebase.auth().currentUser.uid)
          .then((response) =>
          {
            console.log(response);
          })
          .catch((error) =>
          {
            console.log(error);
          });
          console.log("Updating profile.");
          firebase.auth().currentUser.updateProfile(
          {
            displayName: this.state.displayName,
            photoURL: this.state.photoURL
          });
          this.props.history.push("/");
      })
      .catch((error) =>
      {
        var errorCode = error.code;
        var msg = errorCode + ': ' + error.message;
        Object.keys(authMessages).forEach((code) => {
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
                <Form inverted onSubmit={this.handleSignUp}>
                  <Form.Input icon='mail outline' iconPosition='left' name="email" label='Email' onChange={this.handleTextChange} />
                  <Form.Input icon='lock' iconPosition='left' name="password" label='Password' type='password' onChange={this.handleTextChange}  />
                  <Form.Input icon='user circle' iconPosition='left' name="displayName" label='Username' onChange={this.handleTextChange} />
                  <Form.Input icon='picture' iconPosition='left' name="photoURL" label='Avatar URL' onChange={this.handleTextChange}  />
                  <Button content='Create Account' type="submit" primary />
                </Form>
                Or <Link to='/signin'>sign in</Link>
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
export default SignUp;