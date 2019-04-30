import firebase from "firebase";
import 
{
    REACT_APP_FIREBASE_KEY, 
    REACT_APP_FIREBASE_DOMAIN, 
    REACT_APP_FIREBASE_DATABASE, 
    REACT_APP_FIREBASE_PROJECT_ID, 
    REACT_APP_FIREBASE_STORAGE_BUCKET, 
    REACT_APP_FIREBASE_SENDER_ID 
} from "babel-dotenv"

const FirebaseApp = firebase.initializeApp({
  apiKey: REACT_APP_FIREBASE_KEY,
  authDomain: REACT_APP_FIREBASE_DOMAIN,
  databaseURL: REACT_APP_FIREBASE_DATABASE,
  projectId: REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: REACT_APP_FIREBASE_SENDER_ID
});

export default FirebaseApp;