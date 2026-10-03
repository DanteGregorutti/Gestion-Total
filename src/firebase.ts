/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK for Authentication only (Firestore permanently disabled)
let app: any;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.error('Failed to initialize Firebase Auth. Check your configuration.', e);
  app = { options: {}, name: '[DEFAULT]', automaticDataCollectionEnabled: false } as any;
}

export const auth = getAuth(app);

// Firestore is completely decommissioned per user request to avoid quota exhaustion.
// All database operations are 100% handled via Supabase (PostgreSQL) and LocalStorage.
export const db = null as any;
