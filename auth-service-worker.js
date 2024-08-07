import { initializeApp } from "firebase/app";
import { getAuth, getIdToken } from "firebase/auth";
import { getInstallations, getToken } from "firebase/installations";

let firebaseApp = null;
let firebaseConfig = null;

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      // Extract Firebase config from query string
      const serializedFirebaseConfig = new URL(location).searchParams.get('firebaseConfig');
      if (!serializedFirebaseConfig) {
        throw new Error('Firebase Config object not found in service worker query string.');
      }
      
      firebaseConfig = JSON.parse(serializedFirebaseConfig);
      console.log("Service worker installed with Firebase config", firebaseConfig);

      // Initialize Firebase app
      firebaseApp = initializeApp(firebaseConfig);
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { origin } = new URL(event.request.url);
  if (origin !== self.location.origin) return;
  event.respondWith(fetchWithFirebaseHeaders(event.request));
});

async function fetchWithFirebaseHeaders(request) {
  if (!firebaseApp) {
    return new Response('Firebase app not initialized yet.', { status: 503 });
  }

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
