# Bug Fix: TUI Exiting Immediately

## Issue

The TUI was exiting immediately after launch, preventing any user interaction. Users would see the screen flash briefly and then return to the command prompt without being able to navigate or mark hunks.

## Root Cause

The bug was introduced when adding the "All hunks reviewed" completion feature. The problem was in the TUI constructor calling `this.render()` **before** the UI components were appended to the screen.

### Problematic Code Flow

```typescript
constructor(...) {
  this.screen = blessed.screen({...});
  this.allHunks = this.flattenHunks();
  this.diffView = this.createDiffView();
  this.statusBar = this.createStatusBar();
  this.setupKeyBindings();
  this.render(); // ❌ PROBLEM: Rendering before components are appended!
}

async start() {
  this.screen.append(this.diffView);   // Components appended AFTER render
  this.screen.append(this.statusBar);
  this.render(); // Second render
  // ...
}
```

### Why This Caused Immediate Exit

When `render()` was called in the constructor:
1. UI components existed but weren't attached to the screen yet
2. blessed's rendering system tried to render detached components
3. This put blessed into an invalid state
4. The screen would initialize, flash, and immediately clean up/exit
5. No user input could be processed

### Additional Contributing Factor

The quit key handler was also changed to `async`, which could cause timing issues with blessed's event system:

```typescript
this.screen.key(['escape', 'q', 'C-c'], async () => {
  await this.quit();
});
```

While not the primary cause, async key handlers may not be properly awaited by blessed's event system.

## The Fix

### 1. Remove Constructor Render

Removed the premature `render()` call from the constructor:

**Before:**
```typescript
constructor(...) {
  // ... setup code ...
  this.render(); // ❌ Called too early
}
```

**After:**
```typescript
constructor(...) {
  // ... setup code ...
  // No render here - let start() handle it
}
```

### 2. Proper Render Order in start()

Now rendering only happens in `start()` after components are properly appended:

```typescript
async start() {
  // Append components to screen first
  this.screen.append(this.diffView);
  this.screen.append(this.statusBar);

  // Now it's safe to render
  this.render();

  // Keep event loop alive
  return new Promise(() => {});
}
```

### 3. Simplified Quit Handler

Changed the quit key handler from async back to sync:

**Before:**
```typescript
this.screen.key(['escape', 'q', 'C-c'], async () => {
  await this.quit();
});
```

**After:**
```typescript
this.screen.key(['escape', 'q', 'C-c'], () => {
  this.quit(); // Fire and forget
});
```

The `quit()` method is async but doesn't need to be awaited in the key handler context since it just exits the process after a small delay.

## Verification

### E2E Tests Added

Added comprehensive E2E tests to catch this regression:

1. **Test: "should not exit immediately and accept user input"**
   - Verifies TUI stays open for minimum expected duration
   - Tests that user can send multiple keystrokes
   - Ensures output is generated

2. **Test: "should allow marking a hunk before exiting"**
   - Specifically targets the regression
   - Marks a hunk and verifies it was saved
   - Proves TUI stayed open long enough for interaction

### Test Results

All 24 tests pass:
- 10 unit tests
- 14 E2E tests

## Impact

This fix ensures:
- ✅ TUI launches properly and stays open
- ✅ Users can navigate between hunks
- ✅ Users can mark/unmark hunks
- ✅ TUI only exits when user presses 'q' or all hunks are reviewed
- ✅ "All hunks reviewed" completion message still works correctly

## Lessons Learned

1. **Order matters with UI frameworks**: Always append components before rendering
2. **Constructor initialization**: Keep constructors minimal; defer complex initialization to start/init methods
3. **Test coverage**: E2E tests are crucial for catching UI interaction bugs
4. **Async handlers**: Be cautious with async event handlers in callback-based frameworks

## Files Changed

- [`src/ui/tui.ts`](src/ui/tui.ts#L32) - Removed constructor render call
- [`src/ui/tui.ts`](src/ui/tui.ts#L100) - Made quit handler sync
- [`tests/e2e-tui.test.ts`](tests/e2e-tui.test.ts#L76-111) - Added regression tests
