import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const processes = [
  spawn(process.execPath, ['--watch', 'src/server/dev.ts'], { cwd, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1'], {
    cwd, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }
  })
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  processes.forEach(child => child.kill());
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
processes.forEach(child => {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 0));
});
