/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signOut,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { supabase } from '../supabase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resendVerification: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to Supabase Auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser({
          uid: session.user.id,
          id: session.user.id,
          email: session.user.email,
          displayName: session.user.user_metadata?.displayName || session.user.email?.split('@')[0] || 'Usuario',
          role: 'admin',
          emailVerified: true
        });
        setLoading(false);
      }
    });

    // 2. Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isGoogleUser = firebaseUser.providerData.some(p => p.providerId === 'google.com');
        if (!firebaseUser.emailVerified && !isGoogleUser) {
          // If already authenticated via Supabase, keep Supabase user
          const { data: sbData } = await supabase.auth.getSession();
          if (!sbData?.session) {
            setUser(null);
          }
          setLoading(false);
          return;
        }

        let role = 'admin';
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: 'admin',
              createdAt: serverTimestamp()
            });
          } else {
            role = userSnap.data().role || 'admin';
          }
        } catch (e) {
          console.warn('User profile sync notice:', e);
        }

        setUser({
          ...firebaseUser,
          uid: firebaseUser.uid,
          role
        });
      } else {
        // If Firebase is null, check if Supabase has an active session
        const { data: sbData } = await supabase.auth.getSession();
        if (sbData?.session?.user) {
          setUser({
            uid: sbData.session.user.id,
            id: sbData.session.user.id,
            email: sbData.session.user.email,
            displayName: sbData.session.user.user_metadata?.displayName || sbData.session.user.email?.split('@')[0] || 'Usuario',
            role: 'admin',
            emailVerified: true
          });
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    let supabaseSuccess = false;

    // Try Supabase first
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data?.user) {
        supabaseSuccess = true;
        setUser({
          uid: data.user.id,
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.user_metadata?.displayName || data.user.email?.split('@')[0] || 'Usuario',
          role: 'admin',
          emailVerified: true
        });
      }
    } catch (e) {
      console.warn('Supabase login notice:', e);
    }

    // Try Firebase
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified && !supabaseSuccess) {
        await signOut(auth);
        throw new Error('email_not_verified');
      }
    } catch (fbErr: any) {
      if (supabaseSuccess) {
        return; // Successfully logged in with Supabase!
      }
      throw fbErr;
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const register = async (email: string, password: string, name: string) => {
    // Register in Supabase
    try {
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { displayName: name }
        }
      });
    } catch (e) {
      console.warn('Supabase register notice:', e);
    }

    // Register in Firebase
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      await sendEmailVerification(userCredential.user);
      
      try {
        const userRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: email,
          displayName: name,
          role: 'admin',
          createdAt: serverTimestamp()
        });
      } catch (e) {}
    } catch (fbErr) {
      // If Firebase fails (e.g. quota), but Supabase created the user, auto-login with Supabase
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setUser({
          uid: data.session.user.id,
          id: data.session.user.id,
          email: data.session.user.email,
          displayName: name,
          role: 'admin',
          emailVerified: true
        });
        return;
      }
      throw fbErr;
    }
  };

  const logout = async () => {
    await Promise.allSettled([
      signOut(auth),
      supabase.auth.signOut()
    ]);
    setUser(null);
  };

  const resendVerification = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (!userCredential.user.emailVerified) {
      await sendEmailVerification(userCredential.user);
      await signOut(auth);
    } else {
      throw new Error('already_verified');
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await supabase.auth.resetPasswordForEmail(email);
    } catch (e) {}
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, resendVerification, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

