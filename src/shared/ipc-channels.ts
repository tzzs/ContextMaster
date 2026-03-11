// IPC 频道常量 — renderer 与 main 共用
export const IPC = {
  // 菜单管理
  REGISTRY_GET_ITEMS:   'registry:getItems',
  REGISTRY_TOGGLE:      'registry:toggle',
  REGISTRY_BATCH:       'registry:batch',

  // 操作历史
  HISTORY_GET_ALL:      'history:getAll',
  HISTORY_UNDO:         'history:undo',
  HISTORY_CLEAR:        'history:clear',

  // 备份管理
  BACKUP_GET_ALL:       'backup:getAll',
  BACKUP_CREATE:        'backup:create',
  BACKUP_RESTORE:       'backup:restore',
  BACKUP_DELETE:        'backup:delete',
  BACKUP_EXPORT:        'backup:export',
  BACKUP_IMPORT:        'backup:import',
  BACKUP_PREVIEW_DIFF:  'backup:previewDiff',

  // 系统/窗口
  SYS_IS_ADMIN:         'sys:isAdmin',
  SYS_RESTART_AS_ADMIN: 'sys:restartAsAdmin',
  SYS_OPEN_REGEDIT:     'sys:openRegedit',
  SYS_OPEN_LOG_DIR:     'sys:openLogDir',
  SYS_COPY_CLIPBOARD:   'sys:copyClipboard',
  SYS_OPEN_EXTERNAL:    'sys:openExternal',
  WIN_MINIMIZE:         'win:minimize',
  WIN_MAXIMIZE:         'win:maximize',
  WIN_CLOSE:            'win:close',
  WIN_IS_MAXIMIZED:     'win:isMaximized',
} as const;
