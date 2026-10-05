/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
let app: any;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.error('Failed to initialize Firebase Auth. Check your configuration.', e);
  app = { options: {}, name: '[DEFAULT]', automaticDataCollectionEnabled: false } as any;
}

export const auth = getAuth(app);

// Initialize Firestore targeting the configured database
let firestoreDb: any = null;
try {
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  firestoreDb = dbId ? getFirestore(app, dbId) : getFirestore(app);
} catch (e) {
  console.warn('Firestore initialization warning:', e);
}

export const db = firestoreDb;

