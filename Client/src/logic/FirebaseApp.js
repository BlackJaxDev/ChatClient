import React from 'react';
import firebase from "firebase/app";
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

const Firebase = firebase.initializeApp(config);
const FirebaseContext = React.createContext(null);

export default Firebase;
export { FirebaseContext };