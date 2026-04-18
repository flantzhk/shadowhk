// src/services/firebase.js — Firebase SDK (compat mode)
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/analytics';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBl8PRFr84XLNZNxfSg7LpVekjh5lvBWRI",
  authDomain: "shadowspeak-22f04.firebaseapp.com",
  projectId: "shadowspeak-22f04",
  storageBucket: "shadowspeak-22f04.firebasestorage.app",
  messagingSenderId: "332784610142",
  appId: "1:332784610142:web:0dfaf945993e735ef03dcf",
  // measurementId must be added from Firebase console → Project settings → Your apps
  // Analytics events are silently no-ops until this is set.
  // measurementId: "G-XXXXXXXXXX",
};

if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);

const fbAuth = firebase.auth();
const fbDb = firebase.firestore();

// Analytics — graceful fallback if measurementId is not yet configured
let fbAnalytics = null;
try {
  fbAnalytics = firebase.analytics();
} catch (_) {
  // Analytics not available until measurementId is added to FIREBASE_CONFIG
}

fbDb.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') console.warn("Firestore persistence: multiple tabs open");
  else if (err.code === 'unimplemented') console.warn("Firestore persistence: not supported in this browser");
});

export { firebase, fbAuth, fbDb, fbAnalytics };
export default firebase;
