// Serverless function for Vercel: /api/send-welcome
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { email, name, appUrl } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey || resendKey === 'your-resend-api-key') {
      console.warn('[API/send-welcome] RESEND_API_KEY is not configured.');
      return res.status(200).json({
        success: false,
        warning: 'RESEND_API_KEY is not configured in environment variables. Add RESEND_API_KEY to your Vercel or .env file to dispatch live emails.',
      });
    }

    const fromEmail = process.env.WELCOME_FROM_EMAIL && !process.env.WELCOME_FROM_EMAIL.includes('your-domain.com')
      ? process.env.WELCOME_FROM_EMAIL
      : 'AI Operations <onboarding@resend.dev>';

    const recipientName = name && name.trim() ? name.trim() : email.split('@')[0];
    const workspaceUrl = appUrl || process.env.APP_URL || 'https://ai-operations.vercel.app';

    const subject = `Welcome to AI Operations, ${recipientName}! 🚀`;
    const text = `Hi ${recipientName},\n\nWelcome to AI Operations.\n\nYour workspace is ready for real-time AI investigations, operational risk intelligence, and human-approved actions.\n\nGet started here: ${workspaceUrl}\n\n— The AI Operations Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AI Operations</title>
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 40px 32px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);">
    
    <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #1F5FA8; margin-bottom: 24px;">
      ⚡ AI Operations Copilot
    </div>

    <h1 style="font-size: 30px; font-weight: 800; color: #0f172a; margin: 0 0 16px; line-height: 1.25;">
      Welcome, ${recipientName}! 👋
    </h1>

    <p style="font-size: 16px; color: #475569; line-height: 1.65; margin: 0 0 28px;">
      Your enterprise operations workspace is ready. AI Operations continuously analyzes your systems, identifies emerging operational risks, and assists your team with evidence-backed recommendations.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; margin-bottom: 32px;">
      <div style="font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 16px;">
        3 Quick Steps to Get the Most Out of Your Workspace
      </div>
      
      <div style="margin-bottom: 14px; font-size: 15px; color: #334155; line-height: 1.5;">
        <strong style="color: #1F5FA8;">1.</strong> <strong>Complete Workspace Setup:</strong> Name your organization and configure operational thresholds.
      </div>
      
      <div style="margin-bottom: 14px; font-size: 15px; color: #334155; line-height: 1.5;">
        <strong style="color: #1F5FA8;">2.</strong> <strong>Connect Documents & Telemetry:</strong> Upload runbooks, SLAs, and technical architectures for context.
      </div>

      <div style="font-size: 15px; color: #334155; line-height: 1.5;">
        <strong style="color: #1F5FA8;">3.</strong> <strong>Ask Copilot Anything:</strong> Run your first operations query or trigger root-cause investigations.
      </div>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${workspaceUrl}" style="display: inline-block; background-color: #1F5FA8; color: #ffffff; font-weight: 700; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(31, 95, 168, 0.35);">
        Launch Workspace &rarr;
      </a>
    </div>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 36px; font-size: 13px; color: #94a3b8; line-height: 1.6;">
      <p style="margin: 0 0 8px;">Need help? You can reply directly to this email or contact support.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} AI Operations Platform. All rights reserved.</p>
    </div>

  </div>
</body>
</html>
`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        text,
        html,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('[API/send-welcome] Resend response error:', resendData);
      return res.status(resendResponse.status).json({ success: false, error: resendData });
    }

    return res.status(200).json({ success: true, id: resendData.id });
  } catch (err) {
    console.error('[API/send-welcome] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
