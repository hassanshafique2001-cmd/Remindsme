import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../utils/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Jab tak Firebase yeh check kar raha hai ke pehle se koi session save hai ya
  // nahi, "initializing" true rehta hai - taake Profile screen galti se "signed
  // out" state flash na kare.
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  async function signUp(email, password, profile) {
    // Lowercase karke save karte hain taake Shared Bills mein email se user
    // dhoondhna case-sensitivity ki wajah se fail na ho.
    const normalizedEmail = email.trim().toLowerCase();
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    // Naam aur phone sirf profile info ke tor par Firestore mein save hote hain -
    // koi SMS/OTP verification nahi hai.
    await setDoc(doc(db, "users", credential.user.uid), {
      email: normalizedEmail,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      createdAt: new Date().toISOString(),
    });
  }

  async function signIn(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, initializing, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
