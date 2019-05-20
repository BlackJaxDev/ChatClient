import React from 'react';
import app from "firebase/app";
import 'firebase/auth';
import 
{
    FIREBASE_KEY, 
    FIREBASE_DOMAIN, 
    FIREBASE_DATABASE, 
    FIREBASE_PROJECT_ID, 
    FIREBASE_STORAGE_BUCKET, 
    FIREBASE_SENDER_ID 
} from "babel-dotenv";

const config =
{
  apiKey: FIREBASE_KEY,
  authDomain: FIREBASE_DOMAIN,
  databaseURL: FIREBASE_DATABASE,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_SENDER_ID
};

class Firebase
{
  constructor()
  {
    app.initializeApp(config);
    this.auth = app.auth();
  }

  createUserWithEmailAndPassword = (email, password) =>
    this.auth.createUserWithEmailAndPassword(email, password);

  signInWithEmailAndPassword = (email, password) =>
    this.auth.signInWithEmailAndPassword(email, password);

  signOut = () => 
    this.auth.signOut();

  passwordReset = email => 
    this.auth.sendPasswordResetEmail(email);

  passwordUpdate = password =>
    this.auth.currentUser.updatePassword(password);
}

const FirebaseContext = React.createContext(null);

export default Firebase;
export { FirebaseContext };