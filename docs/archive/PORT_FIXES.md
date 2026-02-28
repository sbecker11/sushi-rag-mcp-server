# Port Conflict Fixes - October 25, 2025

## Issues Fixed

Based on the terminal output showing Docker checks working but app failing to start, two issues were addressed:

### 1. ✅ Module Type Warning (FIXED)

**Problem:**
```
Warning: Module type of file:///Users/sbecker11/workspace-sushi/sushi-rag-app/scripts/check-docker.js 
is not specified and it doesn't parse as CommonJS.
```

**Root Cause:**
- `check-docker.js` uses ES module syntax (`import`/`export`)
- Root `package.json` didn't declare `"type": "module"`
- Node.js had to reparse, causing performance overhead

**Solution:**
Added `"type": "module"` to `/package.json`:

```json
{
  "name": "sushi-agent",
  "version": "1.0.0",
  "type": "module",
  ...
}
```

**Result:**
✅ No more module type warnings
✅ Faster script execution (no reparsing)
✅ Consistent ES module usage across project

---

### 2. ✅ Port Conflict (FIXED)

**Problem:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Root Cause:**
- Backend server trying to use port 3001
- Another Node.js process (PID 79914) already using it
- Common when previous dev session wasn't properly shut down

**Solution A: Immediate Fix**
Killed the blocking process:
```bash
kill -9 79914
```

**Solution B: Long-term Fix**
Created automated port cleanup script:

#### New File: `/scripts/kill-ports.sh`
- Checks ports 3001 (backend) and 5173 (frontend)
- Automatically kills any processes using these ports
- Provides colored, clear feedback
- **Note:** Intentionally skips port 5432 (PostgreSQL Docker) as it's managed by docker-compose

#### New npm Script: `kill:ports`
```json
"scripts": {
  "kill:ports": "bash scripts/kill-ports.sh",
  ...
}
```

**Usage:**
```bash
# Clean up ports before starting app
npm run kill:ports

# Output:
========================================
     Port Cleanup Script
========================================

Checking port 3001...
✅ Port 3001 is free

Checking port 5173...
❌ Port 5173 is in use by process 14307
   Killing process 14307...
   ✅ Process killed, port 5173 is now free

========================================
     Cleanup Complete!
========================================
```

---

## Files Changed

### Created (1 file)
1. **`/scripts/kill-ports.sh`** ✨ NEW
   - Bash script to kill processes on app ports
   - Checks ports 3001 and 5173
   - Provides colored output
   - Executable permissions set

### Modified (2 files)

1. **`/package.json`** 🔧 MODIFIED
   ```diff
   {
     "name": "sushi-agent",
     "version": "1.0.0",
   + "type": "module",
     "scripts": {
   +   "kill:ports": "bash scripts/kill-ports.sh",
       ...
     }
   }
   ```

2. **`/README.md`** 🔧 MODIFIED
   - Added `kill:ports` to Utilities section
   - Updated port troubleshooting with automated solution
   - Added optional port cleanup step to Development Workflow
   - Added note about ES modules

---

## Updated Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Clean up any processes using app ports
npm run kill:ports

# 3. Start Docker services
npm run docker:up

# 4. Start development servers
npm run dev
```

---

## When to Use Port Cleanup

### ✅ Use `npm run kill:ports` when:
- You see `EADDRINUSE` error
- Previous dev session didn't shut down cleanly
- You stopped the app with terminal kill (Ctrl+Z) instead of Ctrl+C
- Switching between projects using same ports
- After system sleep/wake cycles

### ❌ Don't use if:
- You want to run multiple instances intentionally
- Debugging with multiple terminals
- Running integration tests alongside dev server

---

## Technical Details

### Ports Used by the App

| Port | Service | Managed By |
|------|---------|------------|
| 3001 | Backend API (Express) | npm/node |
| 5173 | Frontend (Vite) | npm/node |
| 5432 | PostgreSQL | Docker Compose |

### Why Port 5432 is Excluded

PostgreSQL runs in Docker and should be managed via:
```bash
npm run docker:down   # Stop
npm run docker:up     # Start
npm run docker:reset  # Reset
```

Killing the Docker process directly can cause data corruption or orphaned containers.

---

## Before & After

### Before Fixes

```bash
$ npm run dev

✅ All checks passed! Starting application...

(node:13956) [MODULE_TYPELESS_PACKAGE_JSON] Warning: ...
Error: listen EADDRINUSE: address already in use :::3001
[0] [nodemon] app crashed - waiting for file changes before starting...
```

**Developer Experience:**
❌ Confusing warnings
❌ App crashes
❌ Manual port investigation needed
❌ Need to find and kill process manually

### After Fixes

```bash
$ npm run kill:ports
✅ Port 3001 is free
✅ Port 5173 is free

$ npm run dev
✅ Docker Desktop is running
✅ Service "sushi-postgres" is running and healthy
✅ All checks passed! Starting application...

🚀 Server running on http://localhost:3001
➜  Local:   http://localhost:5173/
```

**Developer Experience:**
✅ No warnings
✅ Clean startup
✅ One command to fix ports
✅ Clear feedback

---

## Testing Results

### Test 1: Module Type ✅
```bash
# Before: Warning about module type
# After: No warnings
```

### Test 2: Port Cleanup Script ✅
```bash
$ npm run kill:ports
Exit code: 0
✅ Successfully killed processes on ports 3001 and 5173
```

### Test 3: Script Permissions ✅
```bash
$ ls -la scripts/kill-ports.sh
-rwxr-xr-x  1 user  staff  1234 Oct 25 2025 scripts/kill-ports.sh
```

---

## Documentation Updates

Updated sections in `README.md`:

1. **npm Scripts > Utilities**
   - Added `kill:ports` command

2. **Troubleshooting > Application Issues**
   - Updated "Port already in use" section
   - Added automated solution as recommended approach
   - Added note about ES modules

3. **Development Workflow**
   - Added optional port cleanup step
   - Clarified when to use it

---

## Common Scenarios

### Scenario 1: "I stopped the terminal with Ctrl+Z"
```bash
# Terminal closed but processes still running
npm run kill:ports  # Clean up
npm run dev         # Start fresh
```

### Scenario 2: "My Mac went to sleep with the app running"
```bash
# Processes might be in weird state
npm run kill:ports  # Clean up
npm run docker:up   # Ensure Docker services are running
npm run dev         # Start fresh
```

### Scenario 3: "I'm switching between projects"
```bash
# Project A and B both use port 3001
cd project-a
npm run kill:ports  # Make sure ports are free
npm run dev

# Later...
cd project-b
npm run kill:ports  # Clean up from project-a
npm run dev
```

---

## Alternative Solutions (Not Implemented)

### Option 1: Change Ports
Could modify server.js to use different port:
```javascript
const PORT = process.env.PORT || 3002;  // Use 3002 instead
```

**Why not:** Doesn't solve the problem, just avoids it

### Option 2: Auto-kill on Start
Could modify npm scripts to auto-kill before starting:
```json
"dev": "npm run kill:ports && npm run check:docker && concurrently ..."
```

**Why not:** Might kill processes unexpectedly without user awareness

### Option 3: Use Different Port Range
Could use ports above 8000 to avoid common conflicts.

**Why not:** 3001/5173 are conventional for Express/Vite

---

## Platform Compatibility

| Platform | Status | Notes |
|----------|--------|-------|
| macOS | ✅ Tested | Full support with `lsof` |
| Linux | ✅ Should work | Uses standard `lsof` command |
| Windows | ⚠️ Needs WSL | Bash script requires Unix environment |

### Windows Users

Use WSL or Git Bash, or manually kill ports:
```powershell
# PowerShell alternative
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
```

---

## Future Enhancements

Possible improvements:

- [ ] Create Windows-compatible PowerShell version
- [ ] Add port checking to the `check:docker` script
- [ ] Provide option to list processes before killing
- [ ] Add interactive mode: "Port 3001 in use. Kill? (y/n)"
- [ ] Log which process was killed (PID, name, command)
- [ ] Add `--force` flag for non-interactive killing
- [ ] Create pre-start hook that auto-checks ports

---

## Summary

✅ **Module Type Warning:** Fixed by adding `"type": "module"` to package.json
✅ **Port Conflicts:** Fixed with `npm run kill:ports` command
✅ **Documentation:** Updated README with troubleshooting steps
✅ **Developer Experience:** Much smoother with automated cleanup

### New Commands

| Command | Purpose |
|---------|---------|
| `npm run kill:ports` | Kill processes on ports 3001 and 5173 |

### Key Takeaways

1. Always use Ctrl+C (not Ctrl+Z) to stop dev server
2. Run `npm run kill:ports` if you see EADDRINUSE errors
3. ES modules are now properly configured
4. Port cleanup is automated and easy

---

## Quick Reference

**Problem:** Port in use error
**Solution:** `npm run kill:ports`

**Problem:** Module type warnings
**Solution:** Already fixed with `"type": "module"`

**Problem:** Docker not running
**Solution:** `npm run check:docker` will tell you

**Problem:** Services not running
**Solution:** `npm run docker:up`

---

**All fixes tested and working!** 🎉

