// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAWOudxkojCDm60YG9XayMiSNAimK8CN3w",
  authDomain: "team-wishlist-9f81a.firebaseapp.com",
  databaseURL: "https://team-wishlist-9f81a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "team-wishlist-9f81a",
  storageBucket: "team-wishlist-9f81a.firebasestorage.app",
  messagingSenderId: "875697133213",
  appId: "1:875697133213:web:955c3bc5ae069c6f356674",
  measurementId: "G-PGC9DMWB5C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
