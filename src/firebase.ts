/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
let app: any;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.error('Failed to initialize Firebase. Check your configuration.', e);
  // Create a dummy app to prevent top-level crashes
  app = { options: {}, name: '[DEFAULT]', automaticDataCollectionEnabled: false } as any;
}

export const auth = getAuth(app);

// Initialize Firestore with reliable persistent local cache and auto-detect long polling
let firestoreInstance: any;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({}),
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (err) {
  try {
    // If persistent cache is restricted (e.g. sandboxed iframe or private browsing), fall back to memory cache
    firestoreInstance = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
  } catch (err2) {
    // Fallback if Firestore was already started/initialized
    firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

// Suppress internal Firestore assertion errors (ca9, b815) in capture phase to prevent uncaught window exceptions
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = event?.message || String(event?.error || '');
    if (msg.includes('ca9') || msg.includes('b815') || (msg.includes('Unexpected state') && msg.includes('FIRESTORE'))) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      console.warn('[Firestore] Handled internal assertion event safely:', msg);
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason?.message || String(event?.reason || '');
    if (reason.includes('ca9') || reason.includes('b815') || (reason.includes('Unexpected state') && reason.includes('FIRESTORE'))) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      console.warn('[Firestore] Handled internal assertion rejection safely:', reason);
    }
  }, true);
}

export const db = firestoreInstance;
