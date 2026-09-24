import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import nodemailer from 'nodemailer';
import { z } from 'zod';

admin.initializeApp();

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const resendApiKey = defineSecret('RESEND_API_KEY');
const welcomeFromEmail = defineString('WELCOME_FROM_EMAIL', { default: 'AI Operations <onboarding@resend.dev>' });
const welcomeAppUrl = defineString('WELCOME_APP_URL', { default: 'http://localhost:5173' });
const smtpHost = defineString('SMTP_HOST', { default: '' });
const smtpPort = defineString('SMTP_PORT', { default: '587' });
const smtpSecure = defineString('SMTP_SECURE', { default: 'false' });
const smtpUser = defineString('SMTP_USER', { default: '' });
const smtpPassword = defineSecret('SMTP_PASSWORD');

const investigationOutputSchema = z.object({
  summary: z.string().min(1).max(2000),
  findings: z.array(z.string().min(1).max(500)).min(1).max(8),
  recommendations: z.array(z.string().min(1).max(500)).min(1).max(8),
  evidence: z.array(z.string().min(1).max(200)).max(12),
});

async function generateInvestigation(question: string, orgId: string) {
  const apiKey = geminiApiKey.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY is not configured.');

  const db = admin.firestore();
  const [risks, actions, documents] = await Promise.all([
    db.collection('risks').where('orgId', '==', orgId).limit(20).get(),
    db.collection('actions').where('orgId', '==', orgId).limit(20).get(),
    db.collection('documents').where('orgId', '==', orgId).limit(20).get(),
  ]);
  const evidence = {
    risks: risks.docs.map((item) => ({ id: item.id, ...item.data() })),
    actions: actions.docs.map((item) => ({ id: item.id, ...item.data() })),
    documents: documents.docs.map((item) => ({ id: item.id, name: item.data().name, type: item.data().type, status: item.data().status, department: item.data().department })),
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `You are the AI Operations Copilot. Answer the user's operational question using only the supplied organization evidence. Do not invent facts, hidden reasoning, or external actions. If evidence is incomplete, say so in the summary. Return only valid JSON matching this shape: {"summary":"string","findings":["string"],"recommendations":["string"],"evidence":["record or document IDs used"]}. User question: ${question}\nOrganization evidence: ${JSON.stringify(evidence)}` }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!response.ok) {
    console.error('Gemini investigation request failed', await response.text());
    throw new HttpsError('internal', 'Gemini could not complete the investigation.');
  }

  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new HttpsError('internal', 'Gemini returned an empty investigation.');
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new HttpsError('internal', 'Gemini returned an invalid investigation format.');
  }
  const parsed = investigationOutputSchema.safeParse(parsedJson);
  if (!parsed.success) throw new HttpsError('internal', 'Gemini returned an incomplete investigation.');
  return parsed.data;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

export const ping = onRequest((request, response) => {
  response.json({ ok: true, message: 'AI Operations Copilot functions ready.' });
});

export const sendWelcomeEmail = onCall({ secrets: [resendApiKey, smtpPassword] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');

  const email = request.auth.token.email;
  if (typeof email !== 'string' || !email) {
    throw new HttpsError('failed-precondition', 'A verified account email is required.');
  }

  const schema = z.object({ name: z.string().trim().min(1).max(120) });
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A recipient name is required.');

  const userRef = admin.firestore().collection('users').doc(request.auth.uid);
  const userSnapshot = await userRef.get();
  if (userSnapshot.data()?.welcomeEmailSentAt) return { sent: true, alreadySent: true };

  const subject = 'Welcome to AI Operations';
  const safeName = escapeHtml(parsed.data.name);
  const appUrl = welcomeAppUrl.value();
  const text = `Hi ${parsed.data.name},\n\nWelcome to AI Operations.\n\nYour workspace is ready for evidence-backed investigations, operational risks, and human-approved actions.\n\nNext steps:\n1. Complete your workspace setup.\n2. Connect your first data source.\n3. Ask Copilot your first operations question.\n\nOpen your workspace: ${appUrl}\n\nThe AI Operations team`;
  const html = `<div style="margin:0;background:#F4F4EE;padding:32px 16px;font-family:Arial,sans-serif;color:#17262A"><div style="max-width:560px;margin:0 auto;background:#FBFBF7;border:1px solid #E3E3DA;border-radius:16px;padding:36px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#1F5FA8">AI Operations</div><h1 style="margin:24px 0 8px;font-size:34px;line-height:1.05;color:#17262A">Welcome, ${safeName}.</h1><p style="font-size:17px;line-height:1.65;color:#55636A">Your workspace is ready for evidence-backed investigations, operational risks, and human-approved actions.</p><h2 style="margin:28px 0 12px;font-size:18px;color:#17262A">Your first three steps</h2><ol style="padding-left:22px;color:#55636A;line-height:1.8"><li>Complete your workspace setup.</li><li>Connect your first data source.</li><li>Ask Copilot your first operations question.</li></ol><p style="margin:28px 0"><a href="${appUrl}" style="display:inline-block;background:#1F5FA8;color:#fff;border-radius:10px;padding:13px 18px;text-decoration:none;font-weight:700">Open your workspace</a></p><p style="font-size:14px;line-height:1.6;color:#8A959A">The AI Operations team</p></div></div>`;
  const apiKey = resendApiKey.value();

  if (apiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: welcomeFromEmail.value(), to: [email], subject, text, html }),
    });
    if (!response.ok) {
      console.error('Welcome email provider rejected the request', await response.text());
      throw new HttpsError('internal', 'The welcome email could not be sent.');
    }
  } else if (smtpHost.value() && smtpUser.value() && smtpPassword.value()) {
    const transporter = nodemailer.createTransport({
      host: smtpHost.value(),
      port: Number(smtpPort.value()),
      secure: smtpSecure.value() === 'true',
      auth: { user: smtpUser.value(), pass: smtpPassword.value() },
    });
    await transporter.sendMail({ from: welcomeFromEmail.value(), to: email, subject, text, html });
  } else {
    console.warn('No RESEND_API_KEY or complete SMTP configuration is available; welcome email was skipped.');
    return { sent: false };
  }

  await userRef.set({ welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  return { sent: true };
});

export const sendPasswordResetLink = onCall({ secrets: [resendApiKey, smtpPassword] }, async (request) => {
  const schema = z.object({ email: z.string().trim().email() });
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid email address is required.');

  let resetLink: string;
  try {
    resetLink = await admin.auth().generatePasswordResetLink(parsed.data.email, {
      url: `${welcomeAppUrl.value()}/login`,
      handleCodeInApp: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('user-not-found')) return { sent: true };
    console.error('Could not generate password reset link', error);
    throw new HttpsError('internal', 'The password reset email could not be prepared.');
  }

  const subject = 'Reset your AI Operations password';
  const text = `We received a request to reset your AI Operations password.\n\nReset your password here: ${resetLink}\n\nIf you did not request this, you can safely ignore this email.`;
  const html = `<div style="margin:0;background:#F4F4EE;padding:32px 16px;font-family:Arial,sans-serif;color:#17262A"><div style="max-width:560px;margin:0 auto;background:#FBFBF7;border:1px solid #E3E3DA;border-radius:16px;padding:36px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#1F5FA8">AI Operations</div><h1 style="margin:24px 0 12px;font-size:30px;color:#17262A">Reset your password.</h1><p style="font-size:16px;line-height:1.65;color:#55636A">We received a request to reset your AI Operations password.</p><p style="margin:28px 0"><a href="${resetLink}" style="display:inline-block;background:#1F5FA8;color:#fff;border-radius:10px;padding:13px 18px;text-decoration:none;font-weight:700">Reset password</a></p><p style="font-size:14px;line-height:1.6;color:#8A959A">If you did not request this, you can safely ignore this email.</p></div></div>`;
  const apiKey = resendApiKey.value();

  if (apiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: welcomeFromEmail.value(), to: [parsed.data.email], subject, text, html }),
    });
    if (!response.ok) throw new HttpsError('internal', 'The password reset email could not be sent.');
  } else if (smtpHost.value() && smtpUser.value() && smtpPassword.value()) {
    const transporter = nodemailer.createTransport({ host: smtpHost.value(), port: Number(smtpPort.value()), secure: smtpSecure.value() === 'true', auth: { user: smtpUser.value(), pass: smtpPassword.value() } });
    await transporter.sendMail({ from: welcomeFromEmail.value(), to: parsed.data.email, subject, text, html });
  } else {
    throw new HttpsError('failed-precondition', 'Configure SMTP or Resend before sending password reset emails.');
  }

  return { sent: true };
});

export const startInvestigation = onCall({ secrets: [geminiApiKey] }, async (request) => {
  const user = request.auth;
  if (!user) throw new HttpsError('unauthenticated', 'Authentication required.');

  const schema = z.object({ question: z.string().min(3).max(500) });
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Question is required.');
  }

  const db = admin.firestore();
  const orgId = user.token.orgId as string | undefined;
  if (!orgId) throw new HttpsError('failed-precondition', 'User is not attached to an organization.');

  const investigationId = `INV-${Date.now()}`;
  const investigationRef = db.collection('investigations').doc(investigationId);
  await investigationRef.set({
    orgId,
    question: parsed.data.question,
    status: 'running',
    steps: [
      { label: 'Understanding the request', status: 'in_progress', ts: admin.firestore.Timestamp.now() },
      { label: 'Collecting evidence', status: 'pending', ts: admin.firestore.Timestamp.now() },
      { label: 'Assessing risk and opportunity', status: 'pending', ts: admin.firestore.Timestamp.now() },
      { label: 'Drafting recommendation', status: 'pending', ts: admin.firestore.Timestamp.now() },
    ],
    createdBy: user.uid,
    createdAt: admin.firestore.Timestamp.now(),
  });

  try {
    const result = await generateInvestigation(parsed.data.question, orgId);
    await investigationRef.update({ ...result, status: 'completed', completedAt: admin.firestore.Timestamp.now(), updatedAt: admin.firestore.Timestamp.now() });
    return { investigationId, status: 'completed', message: 'Investigation completed.' };
  } catch (error) {
    await investigationRef.update({ status: 'failed', error: error instanceof HttpsError ? error.message : 'Investigation failed.', updatedAt: admin.firestore.Timestamp.now() });
    throw error;
  }
});

export const onUserWrite = onCall(async (request) => {
  const user = request.auth;
  if (!user) throw new HttpsError('unauthenticated', 'Authentication required.');

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(user.uid).get();
  const payload = userDoc.data() ?? {};

  await admin.auth().setCustomUserClaims(user.uid, {
    orgId: payload.orgId ?? null,
    role: payload.role ?? 'employee',
    onboardingComplete: Boolean(payload.onboardingComplete),
  });

  return { ok: true };
});

export const detectAnomalies = onDocumentWritten('metrics/{metricId}', async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();

  if (!after || !before) return;

  const change = Number(after.values?.[0] ?? 0) - Number(before.values?.[0] ?? 0);
  if (change >= 0) return;

  const db = admin.firestore();
  await db.collection('risks').add({
    orgId: after.orgId,
    title: `Metric drift in ${after.domain ?? 'operations'}`,
    severity: 'high',
    status: 'open',
    detectedAt: admin.firestore.Timestamp.now(),
    impact: `Anomaly detected with a change of ${change}.`,
    evidenceRefs: [],
    recommendation: 'Review operations and validate if the trend is temporary.',
  });
});

export const runNaturalLanguageAnalytics = onCall(async (request) => {
  const user = request.auth;
  if (!user) throw new HttpsError('unauthenticated', 'Authentication required.');

  const analyticsSchema = z.object({
    metric: z.enum(['production','revenue','inventory','downtime']).default('production'),
    period: z.enum(['30d','90d','ytd']).default('30d'),
    compare: z.enum(['previous','baseline']).default('previous'),
    question: z.string().min(4),
  });

  const parsed = analyticsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'The analytics request is invalid.');
  }

  return {
    summary: `The ${parsed.data.metric} metric is trending lower than the ${parsed.data.compare} period in the selected ${parsed.data.period} window.`,
    rows: [
      { label: 'Production', value: 67600, delta: -18 },
      { label: 'Revenue', value: '₹1.82 Cr', delta: 11.4 },
    ],
    chart: [
      { name: 'Jan', value: 82 },
      { name: 'Feb', value: 78 },
      { name: 'Mar', value: 67 },
    ],
  };
});

export const writeAudit = onCall(async (request) => {
  const user = request.auth;
  if (!user) throw new HttpsError('unauthenticated', 'Authentication required.');
  const db = admin.firestore();
  const payload = request.data ?? {};

  await db.collection('auditLogs').add({
    orgId: payload.orgId ?? user.token.orgId ?? 'demo-org',
    ts: admin.firestore.Timestamp.now(),
    userId: user.uid,
    event: payload.event ?? 'unknown',
    resource: payload.resource ?? 'system',
    action: payload.action ?? 'unknown',
    status: payload.status ?? 'success',
    metadata: payload.metadata ?? {},
  });

  return { ok: true };
});

export const createAction = onCall(async (request) => {
  const user = request.auth;
  if (!user) throw new HttpsError('unauthenticated', 'Authentication required.');

  const schema = z.object({ title: z.string().min(2), type: z.string().min(1), requiredPermission: z.enum(['approve','execute']) });
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Action payload is invalid.');
  }

  const db = admin.firestore();
  const actionId = `ACT-${Date.now()}`;

  await db.collection('actions').doc(actionId).set({
    orgId: user.token.orgId ?? 'demo-org',
    title: parsed.data.title,
    type: parsed.data.type,
    status: 'pending_approval',
    reason: 'AI proposed action based on investigation evidence.',
    requestedBy: user.uid,
    requiredPermission: parsed.data.requiredPermission,
    createdAt: admin.firestore.Timestamp.now(),
    executionSteps: [],
    evidenceRefs: [],
    priority: 'high',
  });

  return { actionId, status: 'pending_approval' };
});

export const api = onRequest((request, response) => {
  response.json({ status: 'ok', name: 'AI Operations Copilot API' });
});

