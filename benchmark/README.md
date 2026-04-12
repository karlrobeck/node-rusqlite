# Benchmark Results

## Latest Benchmark Results

**System Information:**
- CPU: AMD Ryzen 5 PRO 2400G with Radeon Vega Graphics
- Runtime: Deno 2.7.12 (x86_64-unknown-linux-gnu)

### Results Table

| Operation | Library | Time/Iteration | Iterations/sec | Min | Max | p75 | p99 |
|-----------|---------|---|---|---|---|---|---|
| INSERT | node-rusqlite | 11.0 ms | 90.9 | 6.9 ms | 23.0 ms | 11.3 ms | 23.0 ms |
| INSERT | node-sqlite | 9.2 ms | 108.5 | 6.5 ms | 11.9 ms | 10.4 ms | 11.9 ms |
| **SELECT** | **node-rusqlite** | **153.1 µs** | **6,530** | **105.2 µs** | **294.9 µs** | **170.7 µs** | **294.9 µs** |
| **SELECT** | **node-sqlite** | **58.8 µs** | **17,010** | **44.3 µs** | **114.1 µs** | **61.4 µs** | **114.1 µs** |
| UPDATE | node-rusqlite | 10.1 ms | 99.0 | 5.8 ms | 14.1 ms | 11.1 ms | 14.1 ms |
| UPDATE | node-sqlite | 9.5 ms | 105.2 | 5.5 ms | 12.0 ms | 10.4 ms | 12.0 ms |
| DELETE | node-rusqlite | 9.7 ms | 102.9 | 5.9 ms | 17.1 ms | 10.6 ms | 17.1 ms |
| DELETE | node-sqlite | 9.4 ms | 106.1 | 5.6 ms | 14.0 ms | 10.2 ms | 14.0 ms |

### Summary

- **INSERT**: node-sqlite is 1.19x faster
- **SELECT**: node-sqlite is 2.61x faster
- **UPDATE**: node-sqlite is 1.06x faster
- **DELETE**: node-sqlite is 1.03x faster

---

## How to Run Benchmarks

### Quick Start

Run all benchmarks with:

```bash
deno bench -A benchmark/node.bench.ts
```

### Basic Commands

#### Run benchmarks with permissions
```bash
deno bench -A benchmark/node.bench.ts
```

The `-A` flag grants all necessary permissions for file I/O and native bindings.

#### Run with specific filters
```bash
deno bench -A benchmark/node.bench.ts --filter "INSERT"
```

Filter for specific operations (INSERT, SELECT, UPDATE, DELETE, etc.)

#### Run with custom iterations
```bash
deno bench -A benchmark/node.bench.ts --no-clear
```

Keep results between runs without clearing.

### Output Formats

#### As JSON
```bash
deno bench -A benchmark/node.bench.ts --json > results.json
```

Capture results as JSON for further analysis or visualization.

#### With statistics
```bash
deno bench -A benchmark/node.bench.ts --unstable-v8-stats
```

Include V8 engine statistics (if available).

### Understanding the Output

Each test group displays:

| Column | Meaning |
|--------|---------|
| `benchmark` | Test name and library being tested |
| `time/iter (avg)` | Average time per operation (ms or µs) |
| `iter/s` | Operations per second |
| `(min … max)` | Minimum and maximum time range |
| `p75` | 75th percentile (3 out of 4 operations) |
| `p99` | 99th percentile (99 out of 100 operations) |

The summary shows relative performance comparison between libraries.

### Advanced Usage

#### Filter by exact benchmark name
```bash
deno bench -A benchmark/node.bench.ts --filter "node-rusqlite - INSERT"
```

#### Run once (no warmup)
```bash
deno bench -A benchmark/node.bench.ts --allow-none
```

#### Custom warmup runs
```bash
deno bench -A benchmark/node.bench.ts 2>&1 | head -20
```

View just the first 20 lines of output.
