import { Platform } from "react-native";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDBYVrP43hHn4fffoRqoqk0BpOK4VL1vhQ",
  authDomain: "reminds-me-614f0.firebaseapp.com",
  projectId: "reminds-me-614f0",
  storageBucket: "reminds-me-614f0.firebasestorage.app",
  messagingSenderId: "1049516906692",
  appId: "1:1049516906692:web:f730ae2e83d1659774d191",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Native (iOS/Android) par login session AsyncStorage mein persist hoti hai - isi
// wajah se user dobara app kholte waqt logged-in hi rehta hai (koi expiry nahi).
// Web par Firebase khud browser storage use kar leta hai, initializeAuth ki zaroorat nahi.
export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

export const db = getFirestore(app);
