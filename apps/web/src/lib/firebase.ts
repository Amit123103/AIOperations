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
import { collection, doc, deleteDoc, getDoc, getDocs, getFirestore, limit, onSnapshot, query, setDoc, serverTimestamp, where, type Unsubscribe } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

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
const storage = getStorage(app)

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

export { app, auth, db, storage, googleProvider, appleProvider, firebaseAi, firebaseAiModel }

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
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as T & { id: string }))
    items.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
      return bTime - aTime
    })
    onData(items)
  }, (err) => {
    console.error(`[Firestore Subscription Error: ${collectionName}]`, err)
    onError(err)
  })
}

export function subscribeToDocument<T>(collectionName: string, id: string, onData: (item: (T & { id: string }) | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, collectionName, id), (snapshot) => {
    onData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T & { id: string }) : null)
  }, (err) => {
    console.error(`[Firestore Document Error: ${collectionName}/${id}]`, err)
    onError(err)
  })
}

export async function completeOnboarding(user: User) {
  await setDoc(doc(db, 'users', user.uid), { onboardingComplete: true, updatedAt: serverTimestamp() }, { merge: true })
}

export async function saveOrganizationProfile(user: User, profile: { name: string; industry: string; size: string; country: string }) {
  // If user already has an orgId, keep it; otherwise create one based on their user id
  const existingDoc = await getDoc(doc(db, 'users', user.uid)).catch(() => null)
  const existingOrgId = existingDoc?.data()?.orgId
  const orgId = existingOrgId || `org_${user.uid.slice(0, 10)}`
  await setDoc(doc(db, 'users', user.uid), { orgId, role: 'admin', organization: profile, updatedAt: serverTimestamp() }, { merge: true })
  await setDoc(doc(db, 'organizations', orgId), {
    name: profile.name,
    industry: profile.industry,
    size: profile.size,
    country: profile.country,
    ownerId: user.uid,
    updatedAt: serverTimestamp(),
  }, { merge: true }).catch(() => undefined)
}

export async function saveTeamInvites(user: User, invites: Array<{ email: string; role: string }>) {
  await setDoc(doc(db, 'users', user.uid), { invites, updatedAt: serverTimestamp() }, { merge: true })
}

export async function uploadDocument(file: File, department: string = 'General'): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication required.')
  const orgId = await getCurrentOrgId()
  if (!orgId) throw new Error('Organization not found. Complete onboarding first.')

  const documentId = `DOC-${Date.now()}`
  const storagePath = `orgs/${orgId}/documents/${documentId}/${file.name}`
  const storageRef = ref(storage, storagePath)

  // Upload file to Firebase Storage
  await uploadBytes(storageRef, file)
  const downloadURL = await getDownloadURL(storageRef)

  // Determine type from extension
  const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE'
  const typeMap: Record<string, string> = { PDF: 'PDF', DOCX: 'DOCX', DOC: 'DOCX', XLSX: 'XLSX', XLS: 'XLSX', CSV: 'CSV', TXT: 'TXT', JSON: 'JSON', PNG: 'Image', JPG: 'Image', JPEG: 'Image' }
  const docType = typeMap[ext] || ext

  // Create Firestore document record
  await setDoc(doc(db, 'documents', documentId), {
    orgId,
    name: file.name,
    type: docType,
    department: department || 'General',
    status: 'Ready',
    uploaded: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    storagePath,
    downloadURL,
    fileSize: file.size,
    chunkCount: Math.max(1, Math.ceil(file.size / 2048)),
    access: ['All Org'],
    uploadedBy: user.uid,
    uploaderName: user.displayName || user.email || 'Workspace User',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Log audit event
  await addAuditLog(orgId, user, 'upload', documentId, `Uploaded ${file.name} to ${department || 'General'}`)

  return documentId
}

export async function deleteDocument(documentId: string) {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication required.')
  const orgId = await getCurrentOrgId()
  if (!orgId) throw new Error('Organization not found.')

  // Try to delete from storage
  const docSnap = await getDoc(doc(db, 'documents', documentId))
  if (docSnap.exists() && docSnap.data()?.storagePath) {
    try {
      await deleteObject(ref(storage, docSnap.data().storagePath))
    } catch { /* file may not exist in storage */ }
  }

  await deleteDoc(doc(db, 'documents', documentId))
  await addAuditLog(orgId, user, 'delete', documentId, `Deleted document ${documentId}`)
}

export async function createRisk(risk: {
  title: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  impact: string
  recommendation: string
}): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication required.')
  const orgId = await getCurrentOrgId()
  if (!orgId) throw new Error('Organization not found.')

  const riskId = `R-${Math.floor(100 + Math.random() * 900)}`
  await setDoc(doc(db, 'risks', riskId), {
    orgId,
    title: risk.title.trim(),
    severity: risk.severity,
    status: 'Open',
    impact: risk.impact.trim(),
    recommendation: risk.recommendation.trim(),
    createdBy: user.uid,
    creatorName: user.displayName || user.email || 'User',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await addAuditLog(orgId, user, 'create_risk', riskId, `Created risk: ${risk.title}`)
  return riskId
}

export async function updateRisk(riskId: string, updates: Partial<{
  status: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  impact: string
  recommendation: string
}>) {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication required.')
  const orgId = await getCurrentOrgId()
  if (!orgId) throw new Error('Organization not found.')

  await setDoc(doc(db, 'risks', riskId), {
    ...updates,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await addAuditLog(orgId, user, 'update_risk', riskId, `Updated risk ${riskId}`)
}

export async function createAction(action: {
  title: string
  reason: string
  priority?: string
}): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication required.')
  const orgId = await getCurrentOrgId()
  if (!orgId) throw new Error('Organization not found.')

  const actionId = `ACT-${Math.floor(2000 + Math.random() * 9000)}`
  await setDoc(doc(db, 'actions', actionId), {
    orgId,
    title: action.title.trim(),
    reason: action.reason.trim(),
    priority: action.priority || 'Medium',
    status: 'pending_approval',
    requestedBy: user.displayName || user.email || 'Workspace User',
    requestedById: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await addAuditLog(orgId, user, 'create_action', actionId, `Created action: ${action.title}`)
  return actionId
}

export async function updateActionStatus(actionId: string, status: 'approved' | 'rejected' | 'completed') {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication required.')
  const orgId = await getCurrentOrgId()
  if (!orgId) throw new Error('Organization not found.')

  await setDoc(doc(db, 'actions', actionId), {
    status,
    reviewedBy: user.displayName || user.email || 'Workspace User',
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await addAuditLog(orgId, user, 'action_review', actionId, `Changed action status to ${status}`)
}

export async function updateUserProfile(data: { displayName?: string; department?: string }) {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication required.')

  if (data.displayName && data.displayName.trim()) {
    await updateProfile(user, { displayName: data.displayName.trim() })
  }

  await setDoc(doc(db, 'users', user.uid), {
    displayName: data.displayName?.trim() || user.displayName || '',
    department: data.department?.trim() || 'Operations',
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function updateOrganizationSettings(profile: { name?: string; industry?: string; size?: string; country?: string }) {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication required.')
  const orgId = await getCurrentOrgId()
  if (!orgId) throw new Error('Organization not found.')

  await setDoc(doc(db, 'organizations', orgId), {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await setDoc(doc(db, 'users', user.uid), {
    organization: profile,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await addAuditLog(orgId, user, 'update_settings', orgId, 'Updated organization settings')
}

export async function addAuditLog(orgId: string, user: User, event: string, resource: string, detail: string) {
  const logId = `LOG-${Date.now()}`
  await setDoc(doc(db, 'auditLogs', logId), {
    orgId,
    time: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
    user: user.displayName || user.email || 'System',
    userId: user.uid,
    event,
    resource,
    detail,
    status: 'success',
    createdAt: serverTimestamp(),
  }).catch(() => undefined)
}

export async function requestPasswordReset(email: string) {
  const cleanEmail = email.trim()
  if (!cleanEmail) throw new Error('Email is required.')

  // 1. Send via Firebase Auth directly without brittle actionCodeSettings to prevent unauthorized-continue-uri errors
  try {
    await sendPasswordResetEmail(auth, cleanEmail)
    console.info('[Firebase Auth] Password reset email sent to:', cleanEmail)
    return { sent: true }
  } catch (error: any) {
    console.warn('[Firebase Auth] Standard reset attempt failed, retrying with continue URL:', error?.code || error)
    // Retry with continue URL
    try {
      await sendPasswordResetEmail(auth, cleanEmail, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      })
      return { sent: true }
    } catch (fallbackError) {
      // Try sending via serverless API if available
      try {
        const resp = await fetch('/api/send-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, resetUrl: `${window.location.origin}/login` }),
        })
        if (resp.ok) {
          const resData = await resp.json()
          if (resData.success) return { sent: true }
        }
      } catch {
        // ignore
      }
      throw error
    }
  }
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
    const isNewFromAuth = getAdditionalUserInfo(credential)?.isNewUser === true
    const profileRef = doc(db, 'users', credential.user.uid)
    const existingSnap = await getDoc(profileRef)
    const isNewUser = isNewFromAuth || !existingSnap.exists() || existingSnap.data()?.welcomeEmailSent !== true

    await ensureUserProfile(credential.user)
    return { user: credential.user, isNewUser }
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
  const isNewFromAuth = getAdditionalUserInfo(credential)?.isNewUser === true
  const profileRef = doc(db, 'users', credential.user.uid)
  const existingSnap = await getDoc(profileRef)
  const isNewUser = isNewFromAuth || !existingSnap.exists() || existingSnap.data()?.welcomeEmailSent !== true

  await ensureUserProfile(credential.user)
  return { user: credential.user, isNewUser }
}

export async function sendWelcomeEmail(user: User) {
  if (!user.email) return

  try {
    const profileRef = doc(db, 'users', user.uid)
    const profileSnap = await getDoc(profileRef)
    if (profileSnap.exists() && profileSnap.data()?.welcomeEmailSent === true) {
      console.info('[Email] Welcome email already marked as sent for:', user.email)
      return
    }

    const name = user.displayName || user.email.split('@')[0] || 'there'

    // 1. Dispatch greeting email via /api/send-welcome (Vercel serverless function or dev server)
    try {
      const response = await fetch('/api/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name,
          appUrl: window.location.origin,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          console.info('[Email] Welcome email successfully dispatched to:', user.email)
        } else if (result.warning) {
          console.warn('[Email]', result.warning)
        }
      }
    } catch (apiError) {
      console.warn('[Email] /api/send-welcome request error:', apiError)
    }

    // Record welcomeEmailSent status in Firestore to avoid duplicate sends
    await setDoc(
      profileRef,
      {
        welcomeEmailSent: true,
        welcomeEmailSentAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (err) {
    console.warn('[Email] Welcome email processing warning:', err)
  }
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
    'auth/missing-email': 'Please provide an email address.',
    'auth/user-not-found': 'No account was found for this email address.',
    'auth/popup-closed-by-user': 'The sign-in window was closed before completing sign-in.',
    'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase yet.',
    'auth/unauthorized-domain': 'This domain is not authorized for sign-in. Add it in the Firebase Console under Authentication → Settings → Authorized domains.',
    'auth/unauthorized-continue-uri': 'This domain is not authorized for password reset. Check Firebase Console → Authentication → Authorized domains.',
    'auth/invalid-continue-uri': 'The password reset return link is invalid.',
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
