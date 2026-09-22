/**
 * Static file server for the production build.
 *
 * The whole application runs in the browser — this process serves files and
 * nothing else. There is no database, no session state and no user data on the
 * server, which is what keeps the deployment free to run.
 */

import express from 'express'
import compression from 'compression'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const PORT = Number(process.env.PORT) || 8080
const HOST = process.env.HOST || '0.0.0.0'

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html is missing — run "npm run build" before starting the server.')
  process.exit(1)
}

const app = express()
app.disable('x-powered-by')
app.use(compression())

// Conservative security headers. No external calls are made beyond Google
// Fonts, so the policy can stay tight.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  )
  next()
})

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() })
})

// Fingerprinted assets are safe to cache forever; index.html never is.
app.use(
  '/assets',
  express.static(path.join(DIST, 'assets'), {
    immutable: true,
    maxAge: '1y',
    fallthrough: true,
  }),
)

app.use(
  express.static(DIST, {
    index: false,
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
    },
  }),
)

// Single-page app: every other GET returns the shell.
app.get('*', (req, res) => {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed')
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(DIST, 'index.html'))
})

const server = app.listen(PORT, HOST, () => {
  console.log(`Ottawa Underwriting listening on http://${HOST}:${PORT}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received — shutting down`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
