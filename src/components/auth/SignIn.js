import React from "react";
import { Divider, Grid, Segment } from 'semantic-ui-react';
import "./SignIn.css";
import FirebaseApp from "../../logic/FirebaseApp";
import SignInView from "./SignInView";
import SignUpView from "./SignUpView";

class SignIn extends React.Component 
{
  constructor(props) 
  {
    super(props);
  }
  render() 
  {
    return (
      <div className="component-sign-in">
        <Segment placeholder>
          <Grid columns={2} relaxed='very' stackable>
            <Grid.Column>
              <SignInView onSubmit={this.handleSignIn} />
            </Grid.Column>
            <Grid.Column verticalAlign='middle'>
              <SignUpView onSubmit={this.handleSignUp} />
            </Grid.Column>
          </Grid>
          <Divider vertical>Or</Divider>
        </Segment>
      </div>
    );
  }
  handleSignIn = async event => 
  {
    event.preventDefault();
    const { email, password } = event.target.elements;
    try 
    {
      const user = await FirebaseApp.auth().createUserWithEmailAndPassword(email.value, password.value);
      this.props.history.push("/");
    }
    catch (error) 
    {
      alert(error);
    }
  }
  handleSignUp = async event => 
  {
    event.preventDefault();
    const { email, password } = event.target.elements;
    try 
    {
      const user = await FirebaseApp.auth().createUserWithEmailAndPassword(email.value, password.value);
      this.props.history.push("/");
    }
    catch (error) 
    {
      alert(error);
    }
  }
}

export default SignIn;