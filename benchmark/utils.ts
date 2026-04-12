import { performance } from "node:perf_hooks";
import * as fs from "node:fs";
import * as path from "node:path";

export interface BenchmarkResult {
  name: string;
  nodeResSqlite: { time: number; memory: number };
  nodeSqlite: { time: number; memory: number };
  ratio: number;
  memoryDelta: number;
}

export interface MemorySnapshot {
  heapUsed: number;
  external: number;
  timestamp: number;
}

/**
 * Capture current memory state
 */
export function captureMemory(): MemorySnapshot {
  try {
    // Use Node.js memory usage
    const mem = (globalThis as any).process?.memoryUsage?.() ||
      { heapUsed: 0, external: 0 };
    return {
      heapUsed: mem.heapUsed,
      external: mem.external,
      timestamp: performance.now(),
    };
  } catch {
    return { heapUsed: 0, external: 0, timestamp: performance.now() };
  }
}

/**
 * Calculate memory delta in MB between two snapshots
 */
export function memoryDelta(
  before: MemorySnapshot,
  after: MemorySnapshot,
): number {
  return (after.heapUsed - before.heapUsed) / 1024 / 1024;
}

/**
 * Create a temporary database path
 */
export function getTempDbPath(name: string): string {
  const tmpDir = "/tmp/node-rusqlite-bench";
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return path.join(
    tmpDir,
    `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.db`,
  );
}

/**
 * Clean up temporary database files
 */
export function cleanupDb(dbPath: string): void {
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * High-resolution timer wrapper
 */
export class Timer {
  private start: number;

  constructor() {
    this.start = performance.now();
  }

  elapsed(): number {
    return performance.now() - this.start;
  }

  reset(): void {
    this.start = performance.now();
  }
}

/**
 * Test data generator
 */
export interface TestUser {
  id: number;
  name: string;
  email: string;
  age: number;
}

export function generateTestUsers(count: number): TestUser[] {
  const users: TestUser[] = [];
  const names = [
    "Alice",
    "Bob",
    "Charlie",
    "Diana",
    "Eve",
    "Frank",
    "Grace",
    "Henry",
  ];
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "example.com"];

  for (let i = 1; i <= count; i++) {
    users.push({
      id: i,
      name: names[i % names.length] + " " + i,
      email: `user${i}@${domains[i % domains.length]}`,
      age: 20 + (i % 50),
    });
  }
  return users;
}

/**
 * Format results for display
 */
export function formatResults(results: BenchmarkResult[]): void {
  console.log("\n" + "=".repeat(100));
  console.log("BENCHMARK RESULTS: node:sqlite vs node-rusqlite");
  console.log("=".repeat(100));

  // Sort by performance ratio (fastest wins first)
  const sorted = [...results].sort((a, b) => {
    if (a.ratio !== b.ratio) {
      return a.ratio - b.ratio;
    }
    return a.nodeResSqlite.time - b.nodeResSqlite.time;
  });

  console.log(
    "%-50s | %-15s | %-15s | %-10s | %-12s |",
    "Operation",
    "node:sqlite",
    "node-rusqlite",
    "Ratio",
    "Memory Δ",
  );
  console.log("-".repeat(100));

  for (const result of sorted) {
    const ratiomsg = result.ratio > 1
      ? `${result.ratio.toFixed(2)}x slower`
      : `${(1 / result.ratio).toFixed(2)}x faster`;

    const memMsg = result.memoryDelta > 0
      ? `+${result.memoryDelta.toFixed(2)}MB`
      : `${result.memoryDelta.toFixed(2)}MB`;

    console.log(
      "%-50s | %13.2f ms | %13.2f ms | %-10s | %12s |",
      result.name,
      result.nodeResSqlite.time,
      result.nodeSqlite.time,
      ratiomsg,
      memMsg,
    );
  }

  console.log("=".repeat(100) + "\n");

  // Summary
  const avgRatio = results.reduce((sum, r) => sum + r.ratio, 0) /
    results.length;
  console.log(`Average ratio: ${avgRatio.toFixed(2)}x`);
  console.log(
    `Faster: ${results.filter((r) => r.ratio < 1).length} / ${results.length}`,
  );
  console.log(
    `Slower: ${results.filter((r) => r.ratio > 1).length} / ${results.length}`,
  );

  const avgMemDelta = results.reduce((sum, r) => sum + r.memoryDelta, 0) /
    results.length;
  console.log(`Average memory delta: ${avgMemDelta.toFixed(2)}MB\n`);
}

/**
 * Delay helper for async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
