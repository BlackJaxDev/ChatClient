import React from "react";
import { Button, Form } from 'semantic-ui-react';

const SignUpView = ({ onSubmit }) => {
  return (
    <Form onSubmit={onSubmit}>
      <Header as="h3">Create Account</Header>
      <Form.Input icon='user' iconPosition='left' name="Email" label='Email' placeholder='Email' />
      <Form.Input icon='lock' iconPosition='left' name="Password" label='Password' placeholder='Password' type='password' />
      <Button content='Sign Up' type="submit" primary />
    </Form>
  );
}

export default SignUpView;