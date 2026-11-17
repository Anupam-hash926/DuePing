import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const backendDir = resolve(frontendDir, '..', 'backend')
const pythonCandidates = [
  process.platform === 'win32'
    ? join(backendDir, '.venv', 'Scripts', 'python.exe')
    : join(backendDir, '.venv', 'bin', 'python'),
]
const python = process.env.PYTHON
  ?? pythonCandidates.find((candidate) => existsSync(candidate))
  ?? (process.platform === 'win32' ? 'python' : 'python3')
const apiPort = process.env.DUEPING_E2E_API_PORT ?? '8000'
const tempDir = mkdtempSync(join(tmpdir(), 'dueping-e2e-'))
const databasePath = join(tempDir, 'dueping.db').replaceAll('\\', '/')
const databaseUrl = `sqlite:///${databasePath}`
const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DUEPING_ENABLE_RESET: '1',
  PYTHONPATH: [backendDir, process.env.PYTHONPATH].filter(Boolean).join(delimiter),
}

const seed = spawnSync(python, ['-m', 'app.infrastructure.seed'], {
  cwd: backendDir,
  env: environment,
  stdio: 'inherit',
})

if (seed.error) {
  rmSync(tempDir, { recursive: true, force: true })
  throw seed.error
}
if (seed.status !== 0) {
  rmSync(tempDir, { recursive: true, force: true })
  process.exit(seed.status ?? 1)
}

const server = spawn(
  python,
  ['-m', 'uvicorn', 'app.api.main:app', '--host', '127.0.0.1', '--port', apiPort],
  { cwd: backendDir, env: environment, stdio: 'inherit' }
)

let cleaned = false
const cleanup = () => {
  if (cleaned) return
  cleaned = true
  rmSync(tempDir, { recursive: true, force: true })
}

server.on('error', (error) => {
  cleanup()
  console.error('Unable to start the DuePing E2E backend:', error)
  process.exitCode = 1
})
server.on('exit', (code) => {
  cleanup()
  process.exitCode = code ?? 1
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal))
}
