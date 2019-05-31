import React from "react";
import { Route, Redirect } from "react-router-dom";
import PropTypes from "prop-types";
import { FirebaseContext } from '../logic/FirebaseApp';

const PrivateRoute = ({
  component: Component,
  firebase,
  ...rest
}) => (
  <Route
    {...rest}
    render={props =>
      firebase.auth().currentUser === null ? (
        <Redirect to="/signin" />
      ) : (
        <Component firebase={firebase} {...props} {...rest} />
      )
    }
  />
);

PrivateRoute.propTypes = {
  component: PropTypes.func.isRequired
};

export default PrivateRoute;