import React from 'react';
import FirebaseContext from './FirebaseApp';

export const WithFirebase = Component => props => (
  <FirebaseContext.Consumer>
    {firebase => <Component {...props} firebase={firebase} />}
  </FirebaseContext.Consumer>
);