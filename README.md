# AI Operations Copilot

AI Operations Copilot is a multi-tenant enterprise operations intelligence app designed for manufacturing and operations teams. It combines AI-powered investigations, document intelligence, risk detection, and permission-aware action workflows.

## Project structure

- apps/web: React 18 + Vite + TypeScript front-end
- functions: Firebase Cloud Functions (Node 20)
- firestore.rules: Firestore access rules
- firestore.indexes.json: Firestore index definitions
- storage.rules: Firebase Storage rules
- firebase.json: Hosting, functions, and emulator config
- scripts/seed.ts: Demo tenant seed script

## Quick start

1. Install dependencies:
   ```bash
   npm install
   npm install --prefix functions
   npm install --prefix apps/web
   ```
2. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```
3. Confirm the Firebase web config in `apps/web/src/lib/firebase.ts` and the admin e-mail used by the seed script.
4. Start the front-end locally:
   ```bash
   npm run dev
   ```
5. Start the Firebase emulators:
   ```bash
   firebase emulators:start --only auth,firestore,functions,storage,hosting
   ```

## Firebase deployment checklist

1. Create or select a Firebase project.
2. Enable Authentication, Firestore, Storage, Functions, and Hosting.
3. In Authentication > Sign-in method, enable Email/Password and Google.
4. Configure Apple sign-in in Firebase and Apple Developer, including the Services ID, team ID, key ID, private key, and approved redirect URL.
5. Add every local and production hostname to Authentication > Settings > Authorized domains.
6. In Firebase Console, open **AI Services > AI Logic**, choose the Gemini Developer API, and complete the required API setup.
7. Register the web app with Firebase App Check using reCAPTCHA v3. Put the site key in the root `.env` as `VITE_FIREBASE_APPCHECK_SITE_KEY`. During local development the app enables the App Check debug provider; register the printed debug token in Firebase Console under App Check > Apps.
8. Set the Gemini API key as a server-only secret:
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
9. Configure welcome email delivery. Copy `functions/.env.example` to `functions/.env`, set the SMTP values and a verified sender address, then set the password as a Firebase secret. The default `onboarding@resend.dev` sender is suitable only for Resend testing.
   ```bash
   firebase functions:secrets:set RESEND_API_KEY
   firebase functions:secrets:set SMTP_PASSWORD
   ```
   Set `WELCOME_FROM_EMAIL=AI Operations <onboarding@your-domain.com>` in `functions/.env` before deploying. Resend is preferred when `RESEND_API_KEY` exists; otherwise the Function uses SMTP.
10. Deploy rules and indexes:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
11. Deploy functions:
   ```bash
   firebase deploy --only functions
   ```
12. Build the web app and deploy hosting:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```
13. Seed demo data:
   ```bash
   npx tsx scripts/seed.ts
   ```

The browser initializes Firebase AI Logic with the Gemini Developer API backend and App Check when configured. Copilot requests continue through the authenticated Cloud Function so organization evidence is scoped server-side and `GEMINI_API_KEY` never ships to the browser.

## Admin control model

The app intentionally does not ship an admin dashboard. Instead, admins manage organization-level configuration directly from the Firebase Console:

- Firebase Authentication: change a user email, role, and status
- Firestore: edit org docs, invites, and user role documents
- Storage: manage the uploaded document bucket
- Audit logs: review append-only event history in the auditLogs collection

During onboarding, the first user created for a new organization is treated as the admin, and custom claims are synced on user write.

## Demo flow

The included seed data is designed to reproduce the manufacturing scenario in the brief:

- Production dropped from 82,400 to 67,600 units (-18%)
- Revenue is ₹1.82 Cr with an 11.4% improvement
- Critical risks and open actions already exist
- A sample investigation and action flow are ready for the dashboard and Copilot

## Note on live deployment

This workspace includes the full project scaffolding and app implementation, but a live Hosting URL and production deployment cannot be completed without a valid Firebase project ID, billing plan, and Gemini API key. The configuration is ready for those values to be added and deployed from a real Firebase project.

## Troubleshooting

- If the app fails to load data, verify the Firebase web config in .env and the project naming in .firebaserc.
- If Gemini calls fail, confirm GEMINI_API_KEY is set and available to the functions runtime.
- If Firestore rules reject requests, confirm the user has an orgId and matching custom claims.
- If uploads fail, ensure the Storage rules and Bucket permissions were deployed.
