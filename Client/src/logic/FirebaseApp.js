import firebase from "firebase";
import 
{
    FIREBASE_KEY, 
    FIREBASE_DOMAIN, 
    FIREBASE_DATABASE, 
    FIREBASE_PROJECT_ID, 
    FIREBASE_STORAGE_BUCKET, 
    FIREBASE_SENDER_ID 
} from "babel-dotenv"

const FirebaseApp = firebase.initializeApp({
  apiKey: FIREBASE_KEY,
  authDomain: FIREBASE_DOMAIN,
  databaseURL: FIREBASE_DATABASE,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_SENDER_ID
});

export default FirebaseApp;