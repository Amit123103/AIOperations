import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '')

  return {
    plugins: [
      react(),
      {
        name: 'api-dev-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/api/send-welcome' && req.method === 'POST') {
              let bodyStr = ''
              req.on('data', (chunk) => { bodyStr += chunk })
              req.on('end', async () => {
                try {
                  const { email, name, appUrl } = JSON.parse(bodyStr || '{}')
                  const resendKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY
                  if (!resendKey || resendKey === 'your-resend-api-key') {
                    console.info('[Dev Server] send-welcome called, but RESEND_API_KEY is not set in .env yet.')
                    res.writeHead(200, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ success: false, warning: 'RESEND_API_KEY not configured in .env' }))
                    return
                  }

                  const fromEmail = env.WELCOME_FROM_EMAIL && !env.WELCOME_FROM_EMAIL.includes('your-domain.com')
                    ? env.WELCOME_FROM_EMAIL
                    : 'AI Operations <onboarding@resend.dev>'
                  const recipientName = name && name.trim() ? name.trim() : email.split('@')[0]
                  const workspaceUrl = appUrl || 'http://localhost:5173'

                  const resendResp = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${resendKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      from: fromEmail,
                      to: [email],
                      subject: `Welcome to AI Operations, ${recipientName}! 🚀`,
                      html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
                          <h2 style="color: #0f172a; margin-top: 0;">Welcome to AI Operations, ${recipientName}! 👋</h2>
                          <p style="color: #475569; font-size: 16px; line-height: 1.6;">Your operations workspace is ready for real-time AI investigations, root-cause diagnostics, and autonomous actions.</p>
                          <p style="margin: 28px 0;"><a href="${workspaceUrl}" style="background-color: #1F5FA8; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; display: inline-block;">Open Workspace &rarr;</a></p>
                          <p style="font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 28px;">&copy; AI Operations Platform</p>
                        </div>
                      `,
                    }),
                  })

                  const data = await resendResp.json()
                  res.writeHead(resendResp.status, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify(data))
                } catch (e: any) {
                  res.writeHead(500, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ error: e.message }))
                }
              })
              return
            }

            if (req.url === '/api/send-reset' && req.method === 'POST') {
              let bodyStr = ''
              req.on('data', (chunk) => { bodyStr += chunk })
              req.on('end', async () => {
                try {
                  const { email, resetUrl } = JSON.parse(bodyStr || '{}')
                  const resendKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY
                  if (!resendKey || resendKey === 'your-resend-api-key') {
                    res.writeHead(200, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ success: false, warning: 'RESEND_API_KEY not configured' }))
                    return
                  }
                  const fromEmail = env.WELCOME_FROM_EMAIL && !env.WELCOME_FROM_EMAIL.includes('your-domain.com')
                    ? env.WELCOME_FROM_EMAIL
                    : 'AI Operations <onboarding@resend.dev>'
                  const link = resetUrl || 'http://localhost:5173/login'

                  const resendResp = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${resendKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      from: fromEmail,
                      to: [email],
                      subject: 'Reset your AI Operations password',
                      html: `
                        <div style="font-family: sans-serif; padding: 24px; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
                          <h3>Reset your password</h3>
                          <p>Click below to reset your AI Operations password:</p>
                          <p><a href="${link}" style="background: #1F5FA8; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a></p>
                        </div>
                      `,
                    }),
                  })

                  const data = await resendResp.json()
                  res.writeHead(resendResp.status, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify(data))
                } catch (e: any) {
                  res.writeHead(500, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ error: e.message }))
                }
              })
              return
            }

            next()
          })
        },
      },
    ],
    envDir: '../..',
  }
})
