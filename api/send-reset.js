// Serverless function for Vercel: /api/send-reset
export default async function handler(req, res) {
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
    const { email, resetUrl } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey || resendKey === 'your-resend-api-key') {
      return res.status(200).json({
        success: false,
        warning: 'RESEND_API_KEY not set.',
      });
    }

    const fromEmail = process.env.WELCOME_FROM_EMAIL && !process.env.WELCOME_FROM_EMAIL.includes('your-domain.com')
      ? process.env.WELCOME_FROM_EMAIL
      : 'AI Operations <onboarding@resend.dev>';

    const link = resetUrl || 'https://ai-operations.vercel.app/login';
    const subject = 'Reset your AI Operations password';
    const text = `We received a request to reset your AI Operations password.\n\nReset your password here: ${link}\n\nIf you did not request this, you can safely ignore this email.`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 40px 32px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);">
    <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #1F5FA8; margin-bottom: 24px;">
      AI Operations
    </div>
    <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 16px;">
      Reset your password
    </h1>
    <p style="font-size: 16px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
      We received a request to reset the password for your AI Operations account. Click the button below to proceed:
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}" style="display: inline-block; background-color: #1F5FA8; color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 12px;">
        Reset My Password
      </a>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 24px 0 0; border-top: 1px solid #f1f5f9; padding-top: 20px;">
      If you did not make this request, you can safely ignore this email. Your password will remain unchanged.
    </p>
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
      return res.status(resendResponse.status).json({ success: false, error: resendData });
    }

    return res.status(200).json({ success: true, id: resendData.id });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
