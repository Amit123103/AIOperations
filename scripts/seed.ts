import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const orgId = 'demo-manufacturing';
const adminEmail = process.env.SEED_ORG_ADMIN_EMAIL ?? 'admin@demo.local';

async function seed() {
  const orgRef = db.collection('organizations').doc(orgId);
  const orgDoc = await orgRef.get();

  if (!orgDoc.exists) {
    await orgRef.set({
      name: 'Apex Manufacturing',
      industry: 'Manufacturing',
      size: '500-1000',
      country: 'India',
      primaryUseCase: 'Production monitoring',
      createdAt: admin.firestore.Timestamp.now(),
      onboardingComplete: true,
      aiConfig: {
        model: 'gemini-2.5-flash',
        allowedDataDomains: ['production', 'inventory', 'maintenance', 'suppliers', 'sales'],
        permissions: {
          readData: true,
          createTasks: true,
          sendEmails: false,
          financialActions: false,
        },
      },
    });
  }

  const userRef = db.collection('users').doc('seed-admin');
  await userRef.set({
    name: 'Aditi S.',
    email: adminEmail,
    role: 'admin',
    department: 'Operations',
    status: 'active',
    orgId,
    lastActive: admin.firestore.Timestamp.now(),
    onboardingStep: 'complete',
  });

  const riskDocs = [
    {
      id: 'R-104',
      orgId,
      title: 'Motor inventory shortfall at Plant 3',
      severity: 'Critical',
      status: 'open',
      detectedAt: admin.firestore.Timestamp.now(),
      impact: '520 units short, 8 days remaining',
      assessment: 'Motor M-104 is the main bottleneck preventing production to reach plan.',
      recommendedActions: ['Create maintenance ticket', 'Escalate alternate supplier'],
      evidenceRefs: ['maintenance-report', 'inventory-ledger'],
    },
    {
      id: 'R-118',
      orgId,
      title: 'Supplier delay on packagings',
      severity: 'High',
      status: 'investigating',
      detectedAt: admin.firestore.Timestamp.now(),
      impact: '7-day delay threatens dispatch SLA',
      assessment: 'Supplier shipments are behind and may cut fulfillment buffer.',
      recommendedActions: ['Re-route supply', 'Confirm alternate vendor'],
      evidenceRefs: ['supplier-contract'],
    },
  ];

  for (const risk of riskDocs) {
    await db.collection('risks').doc(risk.id).set(risk);
  }

  const actions = [
    {
      id: 'ACT-2301',
      orgId,
      title: 'Create maintenance ticket for line 3 motor',
      type: 'maintenance',
      status: 'pending_approval',
      priority: 'high',
      reason: 'Repeated downtime spikes in the last 10 days',
      requestedBy: 'Nisha Shah',
      requiredPermission: 'approve',
      evidenceRefs: ['maintenance-report'],
      createdAt: admin.firestore.Timestamp.now(),
    },
    {
      id: 'ACT-2208',
      orgId,
      title: 'Reorder critical packaging materials',
      type: 'procurement',
      status: 'approved',
      priority: 'medium',
      reason: 'Supplier delay and inventory protection',
      requestedBy: 'Ananya Rao',
      requiredPermission: 'approve',
      evidenceRefs: ['supplier-contract'],
      createdAt: admin.firestore.Timestamp.now(),
    },
  ];

  for (const action of actions) {
    await db.collection('actions').doc(action.id).set(action);
  }

  const investigation = {
    id: 'INV-1024',
    orgId,
    question: 'Why did production fall this month?',
    status: 'completed',
    summary: 'The root cause is motor M-104 downtime, inventory shortfall, and supplier delay.',
    findings: [
      'Machine M-104 recorded 43 hours of downtime compared to 12 hours prior month.',
      'Motor stock is only 8 days remaining and 520 units short of the target buffer.',
      'Packaging supplier delay is 7 days, creating dispatch risk.',
    ],
    recommendations: ['Prioritize maintenance ticket M-104', 'Escalate packaging procurement', 'Rebalance production schedules'],
    evidence: ['maintenance-report', 'inventory-ledger', 'supplier-contract'],
    createdBy: 'seed-admin',
    createdAt: admin.firestore.Timestamp.now(),
  };
  await db.collection('investigations').doc(investigation.id).set(investigation);

  await db.collection('documents').doc('DOC-18').set({
    orgId,
    name: 'Maintenance Manual',
    type: 'PDF',
    department: 'Operations',
    storagePath: 'orgs/demo-manufacturing/documents/maintenance-manual.pdf',
    status: 'ready',
    chunkCount: 9,
    access: ['all'],
    uploadedBy: 'seed-admin',
  });

  await db.collection('documents').doc('DOC-12').set({
    orgId,
    name: 'Supplier Contract',
    type: 'DOCX',
    department: 'Procurement',
    storagePath: 'orgs/demo-manufacturing/documents/supplier-contract.docx',
    status: 'ready',
    chunkCount: 10,
    access: ['procurement'],
    uploadedBy: 'seed-admin',
  });

  await db.collection('notifications').add({
    orgId,
    userId: 'seed-admin',
    type: 'risk',
    title: 'Critical motor inventory risk',
    body: 'Line 3 is 520 units short with 8 days of stock remaining.',
    link: '/app/risks/R-104',
    read: false,
    createdAt: admin.firestore.Timestamp.now(),
  });

  await db.collection('auditLogs').add({
    orgId,
    ts: admin.firestore.Timestamp.now(),
    userId: 'seed-admin',
    event: 'seed',
    resource: 'organization',
    action: 'initialized',
    status: 'success',
    metadata: { demo: true },
  });

  console.log(`Seed data created for org ${orgId} with admin ${adminEmail}`);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
