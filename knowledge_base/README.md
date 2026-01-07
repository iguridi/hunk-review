# Knowledge Base

This directory contains comprehensive technical documentation about the reviewed-patch project's test architecture, isolation strategy, and implementation decisions.

## Contents

### Core Documentation

- **[Quick Reference](quick-reference.md)** - Fast lookup for common commands and patterns ⚡
- [Test Architecture](test-architecture.md) - Overview of the test suite structure
- [Test Isolation](test-isolation.md) - How tests are isolated to prevent interference
- [E2E Testing](e2e-testing.md) - End-to-end testing with process spawning
- [Concurrency Limitations](concurrency-limitations.md) - Why `--concurrent` has limitations
- [File Operations](file-operations.md) - How file writes and polling work in tests

### Supporting Documentation

- [Implementation Decisions](implementation-decisions.md) - Key architectural decisions and trade-offs
- [Test Evolution](test-evolution.md) - Development history and lessons learned
- [Code Verification](code-verification.md) - Cross-reference between docs and actual code

## Quick Reference

### Running Tests

```bash
# Standard test run (recommended)
bun test

# With concurrent flag (has limitations, see concurrency-limitations.md)
bun test --concurrent
```

### Test Results
- **Without `--concurrent`**: ✅ All 13 tests pass (~2.6s)
- **With `--concurrent`**: ⚠️ E2E tests may fail due to subprocess interference

## Key Insights

1. **Unit tests are fully isolated** - Each test creates its own temp directory with unique IDs
2. **E2E tests spawn subprocesses** - These cannot run truly concurrently with other tests
3. **File polling is used** - `waitForFile()` polls for file existence instead of fixed delays
4. **No shared state** - All `beforeEach`/`afterEach` hooks removed for true isolation

See individual documents for detailed information.
