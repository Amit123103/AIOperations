import { getAnalytics, isSupported } from 'firebase/analytics'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  getAuth,
  getRedirectResult,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  type AuthProvider,
  type User,
} from 'firebase/auth'
import { collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, query, setDoc, serverTimestamp, where, type Unsubscribe } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY
if (appCheckSiteKey) {
  if (import.meta.env.DEV) {
    const debugGlobal = globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }
    debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

const firebaseAi = getAI(app, { backend: new GoogleAIBackend() })
const firebaseAiModel = getGenerativeModel(firebaseAi, { model: 'gemini-2.5-flash' })

void isSupported().then((supported) => {
  if (supported) getAnalytics(app)
})

void setPersistence(auth, browserLocalPersistence)

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

const appleProvider = new OAuthProvider('apple.com')
appleProvider.addScope('email')
appleProvider.addScope('name')

export { app, auth, db, googleProvider, appleProvider, firebaseAi, firebaseAiModel }

export async function ensureUserProfile(user: User, name?: string) {
  const profileRef = doc(db, 'users', user.uid)
  const existingProfile = await getDoc(profileRef)
  await setDoc(
    profileRef,
    {
      uid: user.uid,
      email: user.email ?? '',
      displayName: name || user.displayName || 'AI Operations user',
      photoURL: user.photoURL ?? null,
      provider: user.providerData[0]?.providerId ?? 'password',
      updatedAt: serverTimestamp(),
      ...(existingProfile.exists() ? {} : { createdAt: serverTimestamp(), onboardingComplete: false }),
    },
    { merge: true },
  )
}

export async function getUserProfile(user: User) {
  const snapshot = await getDoc(doc(db, 'users', user.uid))
  return snapshot.data() as { onboardingComplete?: boolean; role?: string; orgId?: string } | undefined
}

export async function getCurrentOrgId() {
  const user = auth.currentUser
  if (!user) return undefined
  // Read orgId from Firestore user profile (works on free tier without Cloud Functions)
  const profile = await getDoc(doc(db, 'users', user.uid))
  return typeof profile.data()?.orgId === 'string' ? profile.data()!.orgId : undefined
}

export function subscribeToOrgCollection<T>(collectionName: string, orgId: string, onData: (items: Array<T & { id: string }>) => void, onError: (error: Error) => void): Unsubscribe {
  const collectionQuery = query(collection(db, collectionName), where('orgId', '==', orgId))
  return onSnapshot(collectionQuery, (snapshot) => {
    onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as T & { id: string })))
  }, onError)
}

export function subscribeToDocument<T>(collectionName: string, id: string, onData: (item: (T & { id: string }) | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, collectionName, id), (snapshot) => {
    onData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T & { id: string }) : null)
  }, onError)
}

export async function completeOnboarding(user: User) {
  await setDoc(doc(db, 'users', user.uid), { onboardingComplete: true, updatedAt: serverTimestamp() }, { merge: true })
}

export async function saveOrganizationProfile(user: User, profile: { name: string; industry: string; size: string; country: string }) {
  // Save org data directly to Firestore (no Cloud Functions needed)
  await setDoc(doc(db, 'users', user.uid), { orgId: 'demo-manufacturing', role: 'admin', organization: profile, updatedAt: serverTimestamp() }, { merge: true })
}

export async function requestPasswordReset(email: string) {
  // Use client-side Firebase Auth directly (works on free tier)
  await sendPasswordResetEmail(auth, email, {
    url: `${window.location.origin}/login`,
    handleCodeInApp: false,
  })
}

export async function startInvestigation(question: string) {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication required.')

  const orgId = await getCurrentOrgId()
  if (!orgId) throw new Error('Organization not found. Complete onboarding first.')

  const investigationId = `INV-${Date.now()}`
  const investigationRef = doc(db, 'investigations', investigationId)

  // Create the investigation document in Firestore
  await setDoc(investigationRef, {
    orgId,
    question,
    status: 'running',
    steps: [
      { label: 'Understanding the request', status: 'in_progress', ts: new Date().toISOString() },
      { label: 'Collecting evidence', status: 'pending', ts: new Date().toISOString() },
      { label: 'Assessing risk and opportunity', status: 'pending', ts: new Date().toISOString() },
      { label: 'Drafting recommendation', status: 'pending', ts: new Date().toISOString() },
    ],
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  })

  try {
    // Gather org evidence from Firestore
    const [risksSnap, actionsSnap, documentsSnap] = await Promise.all([
      getDocs(query(collection(db, 'risks'), where('orgId', '==', orgId), limit(20))),
      getDocs(query(collection(db, 'actions'), where('orgId', '==', orgId), limit(20))),
      getDocs(query(collection(db, 'documents'), where('orgId', '==', orgId), limit(20))),
    ])

    const evidence = {
      risks: risksSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
      actions: actionsSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
      documents: documentsSnap.docs.map((item) => ({ id: item.id, name: item.data().name, type: item.data().type, status: item.data().status, department: item.data().department })),
    }

    // Use Firebase AI (Gemini) directly from the browser — no Cloud Functions needed
    const prompt = `You are the AI Operations Copilot. Answer the user's operational question using only the supplied organization evidence. Do not invent facts, hidden reasoning, or external actions. If evidence is incomplete, say so in the summary. Return only valid JSON matching this shape: {"summary":"string","findings":["string"],"recommendations":["string"],"evidence":["record or document IDs used"]}. User question: ${question}\nOrganization evidence: ${JSON.stringify(evidence)}`

    const result = await firebaseAiModel.generateContent(prompt)
    const text = result.response.text()

    let parsed: { summary: string; findings: string[]; recommendations: string[]; evidence: string[] }
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { summary: text, findings: ['Investigation completed.'], recommendations: ['Review the summary above.'], evidence: [] }
    }

    await setDoc(investigationRef, { ...parsed, status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })
  } catch (error) {
    console.error('[Investigation] Failed:', error)
    await setDoc(investigationRef, { status: 'failed', error: error instanceof Error ? error.message : 'Investigation failed.', updatedAt: serverTimestamp() }, { merge: true })
    throw error
  }

  return investigationId
}

export async function createAccount(email: string, password: string, name: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() })
  await ensureUserProfile(credential.user, name)
  return credential.user
}

export async function signInWithPassword(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  await ensureUserProfile(credential.user)
  return credential.user
}

export async function signInWithSocialProvider(provider: AuthProvider) {
  try {
    const credential = await signInWithPopup(auth, provider)
    await ensureUserProfile(credential.user)
    return { user: credential.user, isNewUser: getAdditionalUserInfo(credential)?.isNewUser === true }
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : ''
    if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, provider)
      return { user: null, isNewUser: false }
    }
    throw error
  }
}

export async function resolveRedirectSignIn() {
  const credential = await getRedirectResult(auth)
  if (!credential) return null
  await ensureUserProfile(credential.user)
  return { user: credential.user, isNewUser: getAdditionalUserInfo(credential)?.isNewUser === true }
}

export async function sendWelcomeEmail(_user: User) {
  // Welcome email requires Cloud Functions (Blaze plan). On free tier, skip silently.
  console.info('[Firebase] Welcome email skipped — Cloud Functions not available on free tier.')
}

export function firebaseErrorMessage(error: unknown) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : ''
  // Log the actual error for debugging in browser DevTools
  console.error('[Firebase Error]', code || 'unknown', error)
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/invalid-email': 'Enter a valid work email address.',
    'auth/user-not-found': 'No account was found for this email address.',
    'auth/popup-closed-by-user': 'The sign-in window was closed before completing sign-in.',
    'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase yet.',
    'auth/unauthorized-domain': 'This domain is not authorized for sign-in. Add it in the Firebase Console under Authentication → Settings → Authorized domains.',
    'auth/network-request-failed': 'A network error occurred. Check your internet connection and try again.',
    'auth/too-many-requests': 'Too many unsuccessful attempts. Please wait a moment and try again.',
    'auth/user-disabled': 'This account has been disabled. Contact support for help.',
    'auth/requires-recent-login': 'Please sign in again to complete this action.',
    'auth/invalid-api-key': 'The Firebase API key is invalid. Check your environment configuration.',
    'auth/app-deleted': 'The Firebase app has been deleted or misconfigured.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase API key is not valid. Check your environment configuration.',
  }
  return messages[code] || `Something went wrong (${code || 'unknown error'}). Please try again.`
}
