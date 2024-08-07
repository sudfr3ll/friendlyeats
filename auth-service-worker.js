import { initializeApp } from "firebase/app";
import { getAuth, getIdToken } from "firebase/auth";
import { getInstallations, getToken } from "firebase/installations";

let firebaseApp = null;
let firebaseConfig = null;
const initializationPromise = new Promise((resolve, reject) => {
  self.addEventListener('install', event => {
    event.waitUntil(
      (async () => {
        try {
          const serializedFirebaseConfig = new URL(location).searchParams.get('firebaseConfig');
          if (!serializedFirebaseConfig) {
            throw new Error('Firebase Config object not found in service worker query string.');
          }
          
          firebaseConfig = JSON.parse(serializedFirebaseConfig);
          console.log("Service worker installed with Firebase config", firebaseConfig);

          firebaseApp = initializeApp(firebaseConfig);
          resolve();
        } catch (error) {
          reject(error);
        }
      })()
    );
  });
});

self.addEventListener("fetch", (event) => {
  const { origin } = new URL(event.request.url);
  if (origin !== self.location.origin) return;
  event.respondWith(
    initializationPromise
      .then(() => fetchWithFirebaseHeaders(event.request))
      .catch(() => new Response('Firebase initialization failed.', { status: 500 }))
  );
});

async function fetchWithFirebaseHeaders(request) {
  const auth = getAuth(firebaseApp);
  const installations = getInstallations(firebaseApp);
  const headers = new Headers(request.headers);

  try {
    const [authIdToken, installationToken] = await Promise.all([
      getAuthIdToken(auth),
      getToken(installations),
    ]);

    if (installationToken) headers.append("Firebase-Instance-ID-Token", installationToken);
    if (authIdToken) headers.append("Authorization", `Bearer ${authIdToken}`);

    const newRequest = new Request(request, { headers });
    return await fetch(newRequest);
  } catch (error) {
    console.error("Error fetching with Firebase headers:", error);
    return new Response('Failed to fetch', { status: 500 });
  }
}

async function getAuthIdToken(auth) {
  await auth.authStateReady();
  if (!auth.currentUser) return null;
  return await getIdToken(auth.currentUser);
}
