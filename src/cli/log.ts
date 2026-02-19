import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import type { RunLogEntry } from '../workflows/utils.js';

export async function runLogCommand(args: string[]): Promise<void> {
  const lastIdx = args.indexOf('--last');
  const count = lastIdx !== -1 && args[lastIdx + 1] ? parseInt(args[lastIdx + 1], 10) : 10;

  const logPath = path.join(os.homedir(), '.unitai', 'run-log.jsonl');

  if (!fs.existsSync(logPath)) {
    console.log('No runs yet. Run a workflow first.');
    return;
  }

  const entries: RunLogEntry[] = [];
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }
  }

  const recent = entries.slice(-count);

  if (recent.length === 0) {
    console.log('No runs yet.');
    return;
  }

  console.log(`\nLast ${recent.length} workflow runs:\n`);

  for (const entry of recent) {
    const ts = new Date(entry.ts).toLocaleString();
    const totalSec = Math.round(entry.totalDurationMs / 1000);
    const status = entry.success ? '✅' : '❌';
    const backends = [...new Set(entry.phases.map((p) => p.backend))].join(', ');

    console.log(`${status} [${ts}] ${entry.workflow} — ${totalSec}s — backends: ${backends}`);
    for (const phase of entry.phases) {
      const pSec = Math.round(phase.durationMs / 1000);
      const pStatus = phase.success ? '✓' : '✗';
      console.log(
        `   ${pStatus} ${phase.name} (${phase.backend}, ${pSec}s)${phase.error ? ` ERROR: ${phase.error}` : ''}`
      );
    }
    console.log('');
  }
}
