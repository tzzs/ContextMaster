# Agent Guidelines for ContextMaster

## Build & Run Commands

```bash
# Development (requires admin privileges)
npm start

# Build
npm run build
npm run package
npm run make

# Lint
npm run lint

# Rebuild native modules (after Node/Electron version changes)
npx electron-rebuild
```

## Code Style Guidelines

### TypeScript
- Strict mode enabled
- Use `type` for object shapes, `interface` for extensible contracts
- Prefer explicit return types on public methods
- Use `readonly` for immutable properties

### Imports (grouped in this order)
1. Node built-ins (`path`, `fs`, etc.)
2. External packages (`electron`, `better-sqlite3`)
3. Internal absolute imports (`@shared/*`, `@main/*`)
4. Relative imports (`./`, `../`)

### Naming Conventions
- `PascalCase`: Classes, interfaces, types, enums
- `camelCase`: Variables, functions, methods, properties
- `UPPER_SNAKE_CASE`: Constants, enum values
- Private fields: use `private` modifier, no `_` prefix
- IPC channels: `SCREAMING_SNAKE_CASE` in `shared/ipc-channels.ts`

### Error Handling
- Use `IpcResult<T>` pattern for IPC returns: `{ success: true, data: T } | { success: false, error: string }`
- Wrap IPC handlers with `wrapHandler()` (see `main/utils/ipcWrapper.ts`)
- Use `electron-log` for logging; never log secrets
- Prefer `try/catch` with specific error messages

### Registry Operations
- All registry writes must create a rollback point first
- Disable entries via `LegacyDisable` string value
- Enable entries by deleting `LegacyDisable` value
- Requires admin privileges (UAC manifest configured)

### Database (better-sqlite3)
- Use WAL mode enabled
- Synchronous API (database operations are blocking)
- Repository pattern in `main/data/repositories/`

### Architecture
```
src/
├── shared/     # Types, enums, IPC channel constants
├── main/       # Main process: services, data, IPC handlers
├── preload/    # contextBridge exposure
└── renderer/   # Renderer process: pages, API bridge
```

## Testing Notes
- No test framework configured; run `npm start` for manual testing
- Must run as Administrator on Windows

## Key Files
- `src/shared/ipc-channels.ts`: IPC channel definitions
- `src/shared/types.ts`: Core type definitions
- `src/main/utils/ipcWrapper.ts`: IPC handler wrapper
- `forge.config.ts`: Electron Forge configuration
