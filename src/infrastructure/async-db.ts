/**
 * Async Database Wrapper using Worker Threads
 *
 * Wraps better-sqlite3 in worker threads to provide async/await interface
 * while maintaining the performance benefits of better-sqlite3.
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);

// --- Worker Thread Implementation ---

if (!isMainThread) {
  const db = new Database(workerData.dbPath);
  const preparedStatements = new Map<string, Database.Statement>();

  parentPort?.on('message', (msg: { type: string; sql: string; params: any[]; correlationId: number }) => {
    try {
      let result: any;
      switch (msg.type) {
        case 'exec':
          db.exec(msg.sql);
          result = null;
          break;

        case 'prepare_run': {
          let stmt = preparedStatements.get(msg.sql);
          if (!stmt) {
            stmt = db.prepare(msg.sql);
            preparedStatements.set(msg.sql, stmt);
          }
          result = stmt.run(...msg.params);
          break;
        }

        case 'prepare_get': {
          let stmt = preparedStatements.get(msg.sql);
          if (!stmt) {
            stmt = db.prepare(msg.sql);
            preparedStatements.set(msg.sql, stmt);
          }
          result = stmt.get(...msg.params);
          break;
        }

        case 'prepare_all': {
          let stmt = preparedStatements.get(msg.sql);
          if (!stmt) {
            stmt = db.prepare(msg.sql);
            preparedStatements.set(msg.sql, stmt);
          }
          result = stmt.all(...msg.params);
          break;
        }

        case 'close':
          db.close();
          preparedStatements.clear();
          result = null;
          break;

        default:
          throw new Error(`Unknown db operation: ${msg.type}`);
      }
      parentPort?.postMessage({ correlationId: msg.correlationId, data: result });
    } catch (error: any) {
      parentPort?.postMessage({ correlationId: msg.correlationId, error: error.message });
    }
  });
}

// --- Main Thread Class ---

export class AsyncDatabase {
  private worker: Worker;
  private correlationId = 0;
  private openRequests = new Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }>();

  constructor(dbPath: string) {
    this.worker = new Worker(__filename, {
      workerData: { dbPath }
    });

    this.worker.on('message', (msg: { correlationId: number; data?: any; error?: string }) => {
      const request = this.openRequests.get(msg.correlationId);
      if (request) {
        this.openRequests.delete(msg.correlationId);
        if (msg.error) {
          request.reject(new Error(msg.error));
        } else {
          request.resolve(msg.data);
        }
      }
    });

    this.worker.on('error', (err) => {
      console.error('AsyncDatabase worker error:', err);
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`AsyncDatabase worker stopped with exit code ${code}`);
      }
    });
  }

  private sendRequest<T>(type: string, sql: string, params: any[] = []): Promise<T> {
    const correlationId = this.correlationId++;
    return new Promise<T>((resolve, reject) => {
      this.openRequests.set(correlationId, { resolve, reject });
      this.worker.postMessage({ type, sql, params, correlationId });
    });
  }

  execAsync(sql: string): Promise<void> {
    return this.sendRequest('exec', sql);
  }

  runAsync(sql: string, params: any[] = []): Promise<Database.RunResult> {
    return this.sendRequest('prepare_run', sql, params);
  }

  getAsync<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return this.sendRequest('prepare_get', sql, params);
  }

  allAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.sendRequest('prepare_all', sql, params);
  }

  async closeAsync(): Promise<void> {
    const closePromise = new Promise<void>(resolve => {
      this.worker.on('exit', () => resolve());
    });
    this.worker.postMessage({ type: 'close', correlationId: -1 });
    await closePromise;
  }
}
