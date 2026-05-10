# ContextMaster - Certification Notes (Short Version)

## Administrator Privileges
This application requires administrator privileges because it needs to read and write to the Windows Registry to manage context menu entries. Please test by running "as administrator".

## Restricted Capability Justification
We use `runFullTrust` because direct registry access is required for managing Windows context menus - this is our core functionality. We only modify context menu related registry keys.

## Testing Steps
1. Run as administrator
2. Navigate through different menu scenarios (Desktop, Files, Folders, Drives)
3. Toggle entries on/off - verify they become disabled/enabled
4. Check Operation History page
5. Test undo functionality
6. Create and restore a backup

## No Network Communication
This app operates entirely locally - no data is transmitted anywhere.

## No Test Accounts Needed
No user accounts or authentication required.

## Safety Features
- Automatic rollback points before modifications
- Operation history with undo
- Backup/restore system
