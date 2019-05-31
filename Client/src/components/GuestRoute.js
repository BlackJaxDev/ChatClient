import React from "react";
import { Route, Redirect } from "react-router-dom";
import PropTypes from "prop-types";
import { FirebaseContext } from '../logic/FirebaseApp';

const GuestRoute = ({
    component: Component, 
    firebase,
    ...rest
  }) => (
  <Route
    {...rest}
    render={props =>
      firebase.auth().currentUser === null ? (
        <Component firebase={firebase} {...props} />
      ) : (
        <Redirect to="/"/>
      )
    }
  />
);

GuestRoute.propTypes = {
  component: PropTypes.func.isRequired
};

export default GuestRoute;