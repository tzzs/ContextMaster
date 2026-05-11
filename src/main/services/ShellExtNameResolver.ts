import { IWin32Shell, PrimaryLang } from './Win32Shell';
import log from '../utils/logger';

// ---- 标准谓词翻译表（多语言）----
// Windows 对 open/edit/print 等标准 shell 动词有内置翻译，MUIVerb 为空时生效
// 参考: https://learn.microsoft.com/en-us/windows/win32/shell/context-menu-handlers
// 翻译覆盖：zh / en / ja / ko / de / fr / ru / es（其他语言回退 en）
type LangTranslations = Partial<Record<PrimaryLang, string>> & { en: string };

const STANDARD_VERBS: Record<string, LangTranslations> = {
  'open':             { en: 'Open',                     zh: '打开',                ja: '開く',          ko: '열기',        de: 'Öffnen',                 fr: 'Ouvrir',                 ru: 'Открыть',                  es: 'Abrir' },
  'edit':             { en: 'Edit',                     zh: '编辑',                ja: '編集',          ko: '편집',        de: 'Bearbeiten',             fr: 'Modifier',               ru: 'Изменить',                 es: 'Editar' },
  'print':            { en: 'Print',                    zh: '打印',                ja: '印刷',          ko: '인쇄',        de: 'Drucken',                fr: 'Imprimer',               ru: 'Печать',                   es: 'Imprimir' },
  'printto':          { en: 'Print to',                 zh: '打印到',              ja: '印刷先',        ko: '인쇄 위치',   de: 'Drucken auf',            fr: 'Imprimer sur',           ru: 'Печать на',                es: 'Imprimir en' },
  'find':             { en: 'Find',                     zh: '搜索',                ja: '検索',          ko: '찾기',        de: 'Suchen',                 fr: 'Rechercher',             ru: 'Найти',                    es: 'Buscar' },
  'explore':          { en: 'Explore',                  zh: '浏览',                ja: 'エクスプローラー', ko: '탐색',      de: 'Durchsuchen',            fr: 'Explorer',               ru: 'Проводник',                es: 'Explorar' },
  'play':             { en: 'Play',                     zh: '播放',                ja: '再生',          ko: '재생',        de: 'Wiedergeben',            fr: 'Lire',                   ru: 'Воспроизвести',            es: 'Reproducir' },
  'preview':          { en: 'Preview',                  zh: '预览',                ja: 'プレビュー',    ko: '미리 보기',   de: 'Vorschau',               fr: 'Aperçu',                 ru: 'Просмотр',                 es: 'Vista previa' },
  'runas':            { en: 'Run as administrator',     zh: '以管理员身份运行',    ja: '管理者として実行', ko: '관리자 권한으로 실행', de: 'Als Administrator ausführen', fr: 'Exécuter en tant qu’administrateur', ru: 'Запуск от имени администратора', es: 'Ejecutar como administrador' },
  'runasuser':        { en: 'Run as different user',    zh: '以其他用户身份运行',  ja: '別のユーザーとして実行', ko: '다른 사용자로 실행', de: 'Als anderer Benutzer ausführen', fr: 'Exécuter en tant qu’un autre utilisateur', ru: 'Запуск от имени другого пользователя', es: 'Ejecutar como otro usuario' },
  'properties':       { en: 'Properties',               zh: '属性',                ja: 'プロパティ',    ko: '속성',        de: 'Eigenschaften',          fr: 'Propriétés',             ru: 'Свойства',                 es: 'Propiedades' },
  'cut':              { en: 'Cut',                      zh: '剪切',                ja: '切り取り',      ko: '잘라내기',    de: 'Ausschneiden',           fr: 'Couper',                 ru: 'Вырезать',                 es: 'Cortar' },
  'copy':             { en: 'Copy',                     zh: '复制',                ja: 'コピー',        ko: '복사',        de: 'Kopieren',               fr: 'Copier',                 ru: 'Копировать',               es: 'Copiar' },
  'paste':            { en: 'Paste',                    zh: '粘贴',                ja: '貼り付け',      ko: '붙여넣기',    de: 'Einfügen',               fr: 'Coller',                 ru: 'Вставить',                 es: 'Pegar' },
  'delete':           { en: 'Delete',                   zh: '删除',                ja: '削除',          ko: '삭제',        de: 'Löschen',                fr: 'Supprimer',              ru: 'Удалить',                  es: 'Eliminar' },
  'rename':           { en: 'Rename',                   zh: '重命名',              ja: '名前の変更',    ko: '이름 바꾸기', de: 'Umbenennen',             fr: 'Renommer',               ru: 'Переименовать',            es: 'Cambiar nombre' },
  'sendto':           { en: 'Send to',                  zh: '发送到',              ja: '送る',          ko: '보내기',      de: 'Senden an',              fr: 'Envoyer vers',           ru: 'Отправить',                es: 'Enviar a' },
  'new':              { en: 'New',                      zh: '新建',                ja: '新規作成',      ko: '새로 만들기', de: 'Neu',                    fr: 'Nouveau',                ru: 'Создать',                  es: 'Nuevo' },
  'select':           { en: 'Select',                   zh: '选择',                ja: '選択',          ko: '선택',        de: 'Auswählen',              fr: 'Sélectionner',           ru: 'Выбрать',                  es: 'Seleccionar' },
  'refresh':          { en: 'Refresh',                  zh: '刷新',                ja: '更新',          ko: '새로 고침',   de: 'Aktualisieren',          fr: 'Actualiser',             ru: 'Обновить',                 es: 'Actualizar' },
  'view':             { en: 'View',                     zh: '查看',                ja: '表示',          ko: '보기',        de: 'Ansicht',                fr: 'Affichage',              ru: 'Вид',                      es: 'Ver' },
  'sort':             { en: 'Sort',                     zh: '排序',                ja: '並べ替え',      ko: '정렬',        de: 'Sortieren',              fr: 'Trier',                  ru: 'Сортировка',               es: 'Ordenar' },
  'share':            { en: 'Share',                    zh: '共享',                ja: '共有',          ko: '공유',        de: 'Freigeben',              fr: 'Partager',               ru: 'Поделиться',               es: 'Compartir' },
  'format':           { en: 'Format',                   zh: '格式化',              ja: 'フォーマット',  ko: '포맷',        de: 'Formatieren',            fr: 'Formater',               ru: 'Форматировать',            es: 'Formatear' },
  'eject':            { en: 'Eject',                    zh: '弹出',                ja: '取り出し',      ko: '꺼내기',      de: 'Auswerfen',              fr: 'Éjecter',                ru: 'Извлечь',                  es: 'Expulsar' },
  'install':          { en: 'Install',                  zh: '安装',                ja: 'インストール',  ko: '설치',        de: 'Installieren',           fr: 'Installer',              ru: 'Установить',               es: 'Instalar' },
  'config':           { en: 'Configure',                zh: '配置',                ja: '構成',          ko: '구성',        de: 'Konfigurieren',          fr: 'Configurer',             ru: 'Настроить',                es: 'Configurar' },
  'scan':             { en: 'Scan',                     zh: '扫描',                ja: 'スキャン',      ko: '검사',        de: 'Scannen',                fr: 'Analyser',               ru: 'Сканировать',              es: 'Examinar' },
  'restore':          { en: 'Restore',                  zh: '还原',                ja: '復元',          ko: '복원',        de: 'Wiederherstellen',       fr: 'Restaurer',              ru: 'Восстановить',             es: 'Restaurar' },
  'togglehidden':     { en: 'Toggle Hidden',            zh: '显示/隐藏',           ja: '非表示の切替',  ko: '숨김 전환',   de: 'Ausgeblendet umschalten', fr: 'Basculer masqué',       ru: 'Скрыть/показать',          es: 'Alternar oculto' },
  'pintohome':        { en: 'Pin to Quick access',      zh: '固定到快速访问',      ja: 'クイック アクセスにピン留め', ko: '즐겨찾기에 고정', de: 'An Schnellzugriff anheften', fr: 'Épingler à l’accès rapide', ru: 'Закрепить в быстром доступе', es: 'Anclar a Acceso rápido' },
  'unpinfromhome':    { en: 'Unpin from Quick access',  zh: '从快速访问取消固定',  ja: 'クイック アクセスから外す', ko: '즐겨찾기에서 제거', de: 'Von Schnellzugriff lösen', fr: 'Détacher de l’accès rapide', ru: 'Открепить от быстрого доступа', es: 'Desanclar del Acceso rápido' },
  'pintotaskbar':     { en: 'Pin to taskbar',           zh: '固定到任务栏',        ja: 'タスクバーにピン留めする', ko: '작업 표시줄에 고정', de: 'An Taskleiste anheften', fr: 'Épingler à la barre des tâches', ru: 'Закрепить на панели задач', es: 'Anclar a la barra de tareas' },
  'unpinfromtaskbar': { en: 'Unpin from taskbar',       zh: '从任务栏取消固定',    ja: 'タスクバーからピン留めを外す', ko: '작업 표시줄에서 제거', de: 'Von Taskleiste lösen', fr: 'Détacher de la barre des tâches', ru: 'Открепить от панели задач', es: 'Desanclar de la barra de tareas' },
  'pintostart':       { en: 'Pin to Start',             zh: '固定到"开始"屏幕',   ja: 'スタートにピン留め', ko: '시작 화면에 고정', de: 'An Start anheften',    fr: 'Épingler à l’écran d’accueil', ru: 'Закрепить на начальном экране', es: 'Anclar a Inicio' },
  'unpinfromstart':   { en: 'Unpin from Start',         zh: '从"开始"屏幕取消固定', ja: 'スタートからピン留めを外す', ko: '시작 화면에서 제거', de: 'Von Start lösen',    fr: 'Détacher de l’écran d’accueil', ru: 'Открепить от начального экрана', es: 'Desanclar de Inicio' },
  'compress':         { en: 'Compress',                 zh: '压缩',                ja: '圧縮',          ko: '압축',        de: 'Komprimieren',           fr: 'Compresser',             ru: 'Сжать',                    es: 'Comprimir' },
  'extract':          { en: 'Extract',                  zh: '解压',                ja: '展開',          ko: '압축 풀기',   de: 'Extrahieren',            fr: 'Extraire',               ru: 'Извлечь',                  es: 'Extraer' },
  'extractall':       { en: 'Extract All',              zh: '全部解压',            ja: 'すべて展開',    ko: '모두 압축 풀기', de: 'Alle extrahieren',     fr: 'Tout extraire',          ru: 'Извлечь всё',              es: 'Extraer todo' },
  'extracthere':      { en: 'Extract here',             zh: '解压到当前文件夹',    ja: 'ここに展開',    ko: '여기에 압축 풀기', de: 'Hierher extrahieren', fr: 'Extraire ici',         ru: 'Извлечь здесь',            es: 'Extraer aquí' },
  'extractto':        { en: 'Extract to...',            zh: '解压到...',           ja: '指定先に展開',  ko: '...에 압축 풀기', de: 'Extrahieren nach...', fr: 'Extraire vers...',    ru: 'Извлечь в...',             es: 'Extraer en...' },
  'burn':             { en: 'Burn to disc',             zh: '刻录到光盘',          ja: 'ディスクに書き込む', ko: '디스크에 굽기', de: 'Auf Datenträger brennen', fr: 'Graver sur un disque', ru: 'Записать на диск',     es: 'Grabar en disco' },
  'openwith':         { en: 'Open with',                zh: '打开方式',            ja: 'プログラムから開く', ko: '연결 프로그램', de: 'Öffnen mit',         fr: 'Ouvrir avec',            ru: 'Открыть с помощью',        es: 'Abrir con' },
  'openfilelocation': { en: 'Open file location',       zh: '打开文件所在的位置',  ja: 'ファイルの場所を開く', ko: '파일 위치 열기', de: 'Dateispeicherort öffnen', fr: 'Ouvrir l’emplacement du fichier', ru: 'Расположение файла', es: 'Abrir ubicación del archivo' },
  'opennewwindow':    { en: 'Open in new window',       zh: '在新窗口中打开',      ja: '新しいウィンドウで開く', ko: '새 창에서 열기', de: 'In neuem Fenster öffnen', fr: 'Ouvrir dans une nouvelle fenêtre', ru: 'Открыть в новом окне', es: 'Abrir en nueva ventana' },
  'opennewtab':       { en: 'Open in new tab',          zh: '在新标签页中打开',    ja: '新しいタブで開く', ko: '새 탭에서 열기', de: 'In neuem Tab öffnen',  fr: 'Ouvrir dans un nouvel onglet', ru: 'Открыть в новой вкладке', es: 'Abrir en nueva pestaña' },
  'sharewith':        { en: 'Share with',               zh: '共享对象',            ja: '共有相手',      ko: '공유 대상',   de: 'Freigeben für',          fr: 'Partager avec',          ru: 'Поделиться с',             es: 'Compartir con' },
  'showmore':         { en: 'Show more options',        zh: '显示更多选项',        ja: 'その他のオプションを表示', ko: '추가 옵션 표시', de: 'Weitere Optionen anzeigen', fr: 'Afficher plus d’options', ru: 'Показать дополнительные параметры', es: 'Mostrar más opciones' },
  'createshortcut':   { en: 'Create shortcut',          zh: '创建快捷方式',        ja: 'ショートカットの作成', ko: '바로 가기 만들기', de: 'Verknüpfung erstellen', fr: 'Créer un raccourci',    ru: 'Создать ярлык',            es: 'Crear acceso directo' },
  'addtofavorites':   { en: 'Add to Favorites',         zh: '添加到收藏夹',        ja: 'お気に入りに追加', ko: '즐겨찾기에 추가', de: 'Zu Favoriten hinzufügen', fr: 'Ajouter aux favoris',   ru: 'Добавить в избранное',     es: 'Agregar a favoritos' },
  'openelevated':     { en: 'Open elevated',            zh: '以提升的权限打开',    ja: '昇格して開く',  ko: '권한 상승 열기', de: 'Mit erhöhten Rechten öffnen', fr: 'Ouvrir avec privilèges élevés', ru: 'Открыть с повышенными правами', es: 'Abrir con privilegios' },
  'mount':            { en: 'Mount',                    zh: '装载',                ja: 'マウント',      ko: '탑재',        de: 'Bereitstellen',          fr: 'Monter',                 ru: 'Подключить',               es: 'Montar' },
  'unmount':          { en: 'Unmount',                  zh: '卸载',                ja: 'マウント解除',  ko: '탑재 해제',   de: 'Trennen',                fr: 'Démonter',               ru: 'Отключить',                es: 'Desmontar' },
  'cmd':              { en: 'Open in Terminal',         zh: '在终端中打开',        ja: 'ターミナルで開く', ko: '터미널에서 열기', de: 'In Terminal öffnen', fr: 'Ouvrir dans le terminal', ru: 'Открыть в терминале',    es: 'Abrir en Terminal' },
  'powershell':       { en: 'Open in PowerShell',       zh: '在 PowerShell 中打开', ja: 'PowerShell で開く', ko: 'PowerShell에서 열기', de: 'In PowerShell öffnen', fr: 'Ouvrir dans PowerShell', ru: 'Открыть в PowerShell', es: 'Abrir en PowerShell' },
};

// ---- 数据契约：PS 脚本返回的原始数据 ----

export interface PsRawClassicItem {
  subKeyName: string;
  rawMUIVerb: string | null;
  rawDefault: string | null;
  rawLocalizedDisplayName: string | null;
  rawIcon: string | null;
  isEnabled: boolean;
  command: string;
  registryKey: string;
  hasExtended: boolean;
  hasSubCommands: boolean;
  hasSuppression: boolean;
  hasProgrammaticAccessOnly: boolean;
  hasHasLUAShield: boolean;
}

export interface PsRawShellExtItem {
  handlerKeyName: string;
  cleanName: string;
  defaultVal: string;
  isEnabled: boolean;
  actualClsid: string;
  clsidLocalizedString: string | null;
  clsidMUIVerb: string | null;
  clsidDefault: string | null;
  clsidIcon: string | null;
  dllPath: string | null;
  dllFileDescription: string | null;
  dllProductName: string | null;
  progIdName: string | null;
  siblingMUIVerb: string | null;
  registryKey: string;
}

// ---- 泛型名称过滤器 ----

type FilterRule = [RegExp, string];

const GENERIC_PATTERNS: FilterRule[] = [
  [/^外壳服务对象$/i, 'Group A: COM description'],
  [/^(context|ctx)\s*menu(\s*(handler|ext(ension)?|provider|manager))?$/i, 'Group A'],
  [/^shell\s*(extension|ext|common)(\s*(handler|provider|class))?$/i, 'Group A'],
  [/shell\s+extension$/i, 'Group A: * Shell Extension suffix'],
  [/^shell\s*service(\s*object)?$/i, 'Group A'],
  [/^com\s*(object|server|class)$/i, 'Group A'],
  [/\.dll$/i, 'Group A: filename'],
  [/^microsoft windows/i, 'Group A: system'],
  [/\s+class$/i, 'Group B: COM class suffix'],
  [/^todo:/i, 'Group C: placeholder'],
  [/<[^>]+>/, 'Group C: angle bracket placeholder'],
  [/^(n\/a|na|none|unknown|untitled)$/i, 'Group C: invalid'],
  [/^(a|an|the)\s+/i, 'Group D: article-start sentence'],
  [/^\(.+\)$/, 'Group D: parenthesized debug marker'],
];

function isGenericName(name: string): boolean {
  if (!name || name.length < 2) return true;
  for (const [regex] of GENERIC_PATTERNS) {
    if (regex.test(name)) {
      log.debug(`[NameResolver] Filtered "${name}" — matches ${regex.source}`);
      return true;
    }
  }
  return false;
}

function isUselessPlain(value: string, fallback: string): boolean {
  if (!value || value.length < 2) return true;
  if (value.localeCompare(fallback, undefined, { sensitivity: 'base' }) === 0) return true;
  if (isGenericName(value)) return true;
  return false;
}

// ---- CommandStore 反向索引 ----

export class CommandStoreIndex {
  private map = new Map<string, string>();

  buildFromData(entries: Array<{ clsid: string; muiverb: string }>): void {
    for (const e of entries) {
      this.map.set(e.clsid.toLowerCase(), e.muiverb);
    }
  }

  get size(): number { return this.map.size; }

  get(clsid: string): string | null {
    return this.map.get(clsid.toLowerCase()) ?? null;
  }

  invalidate(): void {
    this.map.clear();
  }
}

function translateStandardVerb(name: string, language: PrimaryLang): string | null {
  const lc = name.toLowerCase().trim();
  const entry = STANDARD_VERBS[lc];
  if (entry) {
    // 命中目标语言→使用，否则总是回退英文
    return entry[language] ?? entry.en;
  }
  return null;
}

// ---- Shell 扩展名称解析器 ----

export class ShellExtNameResolver {
  private readonly language: PrimaryLang;

  // 兼容旧 'zh'/'en' 构造签名：也接受完整 PrimaryLang
  constructor(private readonly win32: IWin32Shell, language: PrimaryLang = 'zh') {
    this.language = language;
  }

  /** Classic Shell 条目名称解析 */
  resolveClassicName(raw: PsRawClassicItem): string {
    const candidates = [
      raw.rawMUIVerb,
      raw.rawDefault,
      raw.rawLocalizedDisplayName,
    ];

    for (const cand of candidates) {
      if (!cand || cand.length < 2) continue;
      if (cand.startsWith('@') || cand.startsWith('ms-resource:')) {
        const resolved = this.win32.resolveIndirect(cand);
        if (resolved && resolved.length >= 2) return resolved;
      } else {
        return cand;
      }
    }

    // 标准谓词翻译：open → 打开, edit → 编辑, ...
    const translated = translateStandardVerb(raw.subKeyName, this.language);
    if (translated) {
      log.debug(`[NameResolver] Standard verb "${raw.subKeyName}" → "${translated}"`);
      return translated;
    }

    return raw.subKeyName;
  }

  /** Shell 扩展条目名称解析（多级回退链） */
  resolveExtName(raw: PsRawShellExtItem, cmdStore: CommandStoreIndex): string {
    const fallback = raw.cleanName;

    // Level 0: directName 间接格式（@dll,-id 或 ms-resource:）
    if (raw.defaultVal && (raw.defaultVal.startsWith('@') || raw.defaultVal.startsWith('ms-resource:'))) {
      try {
        const resolved = this.win32.resolveIndirect(raw.defaultVal);
        if (resolved && resolved.length >= 2) {
          log.debug(`[NameResolver] ${fallback} → Level 0 (directName indirect): "${resolved}"`);
          return resolved;
        }
      } catch { /* fall through */ }
    }

    // ====== Phase A: 间接格式优先（resolveIndirect 返回系统语言名称） ======
    if (raw.actualClsid) {
      // Level 1-indirect: CLSID.LocalizedString @/ms-resource: 格式
      if (raw.clsidLocalizedString &&
          (raw.clsidLocalizedString.startsWith('@') || raw.clsidLocalizedString.startsWith('ms-resource:'))) {
        try {
          const resolved = this.win32.resolveIndirect(raw.clsidLocalizedString);
          if (resolved && resolved.length >= 2) {
            log.debug(`[NameResolver] ${fallback} → Level 1 (LocalizedString indirect): "${resolved}"`);
            return resolved;
          }
        } catch { /* fall through */ }
      }

      // Level 1.3-indirect: Sibling Shell Key MUIVerb @/ms-resource: 格式
      if (raw.siblingMUIVerb &&
          (raw.siblingMUIVerb.startsWith('@') || raw.siblingMUIVerb.startsWith('ms-resource:'))) {
        try {
          const resolved = this.win32.resolveIndirect(raw.siblingMUIVerb);
          if (resolved && resolved.length >= 2) {
            log.debug(`[NameResolver] ${fallback} → Level 1.3 (sibling MUIVerb indirect): "${resolved}"`);
            return resolved;
          }
        } catch { /* fall through */ }
      }

      // Level 1.5-indirect: CLSID.MUIVerb @/ms-resource: 格式
      if (raw.clsidMUIVerb &&
          (raw.clsidMUIVerb.startsWith('@') || raw.clsidMUIVerb.startsWith('ms-resource:'))) {
        try {
          const resolved = this.win32.resolveIndirect(raw.clsidMUIVerb);
          if (resolved && resolved.length >= 2) {
            log.debug(`[NameResolver] ${fallback} → Level 1.5 (MUIVerb indirect): "${resolved}"`);
            return resolved;
          }
        } catch { /* fall through */ }
      }

      // ====== Phase B: CommandStore（Windows 本地化机制，优先级高于 plain text） ======
      const cmdVerb = cmdStore.get(raw.actualClsid);
      if (cmdVerb) {
        if (cmdVerb.startsWith('@') || cmdVerb.startsWith('ms-resource:')) {
          const resolved = this.win32.resolveIndirect(cmdVerb);
          if (resolved && resolved.length >= 2) {
            log.debug(`[NameResolver] ${fallback} → Level 1.7 (CommandStore resolved): "${resolved}"`);
            return resolved;
          }
        } else {
          log.debug(`[NameResolver] ${fallback} → Level 1.7 (CommandStore): "${cmdVerb}"`);
          return cmdVerb;
        }
      }

      // Level 1.6: ProgID → 应用程序名（在 CommandStore 之后、plain text 之前）
      if (raw.progIdName && raw.progIdName.length >= 2) {
        if (!isUselessPlain(raw.progIdName, fallback) && !isGenericName(raw.progIdName)) {
          log.debug(`[NameResolver] ${fallback} → Level 1.6 (ProgID): "${raw.progIdName}"`);
          return raw.progIdName;
        }
      }

      // ====== Phase C: Plain text 回退（开发者硬编码名称，可能是英文） ======
      // Level 1-plain: CLSID.LocalizedString plain text
      if (raw.clsidLocalizedString &&
          !raw.clsidLocalizedString.startsWith('@') &&
          !raw.clsidLocalizedString.startsWith('ms-resource:') &&
          raw.clsidLocalizedString.length >= 2) {
        if (!isUselessPlain(raw.clsidLocalizedString, fallback)) {
          log.debug(`[NameResolver] ${fallback} → Level 1 (LocalizedString plain): "${raw.clsidLocalizedString}"`);
          return raw.clsidLocalizedString;
        }
      }

      // Level 1.3-plain: Sibling Shell Key MUIVerb plain text
      if (raw.siblingMUIVerb &&
          !raw.siblingMUIVerb.startsWith('@') &&
          !raw.siblingMUIVerb.startsWith('ms-resource:') &&
          raw.siblingMUIVerb.length >= 2) {
        if (!isUselessPlain(raw.siblingMUIVerb, fallback)) {
          log.debug(`[NameResolver] ${fallback} → Level 1.3 (sibling MUIVerb): "${raw.siblingMUIVerb}"`);
          return raw.siblingMUIVerb;
        }
      }

      // Level 1.5-plain: CLSID.MUIVerb plain text
      if (raw.clsidMUIVerb &&
          !raw.clsidMUIVerb.startsWith('@') &&
          !raw.clsidMUIVerb.startsWith('ms-resource:') &&
          raw.clsidMUIVerb.length >= 2) {
        if (!isUselessPlain(raw.clsidMUIVerb, fallback)) {
          log.debug(`[NameResolver] ${fallback} → Level 1.5 (MUIVerb): "${raw.clsidMUIVerb}"`);
          return raw.clsidMUIVerb;
        }
      }

      // Level 2: CLSID 默认值
      if (raw.clsidDefault && raw.clsidDefault.length >= 2) {
        if (!isUselessPlain(raw.clsidDefault, fallback)) {
          log.debug(`[NameResolver] ${fallback} → Level 2 (CLSID Default): "${raw.clsidDefault}"`);
          return raw.clsidDefault;
        }
      }
    }

    // Level 2.5: DLL 版本资源（PS 采集，天然支持 UI 语言）
    // 先试 FileDescription，再试 ProductName（通常为用户可见名）
    const dllCandidates = [raw.dllFileDescription, raw.dllProductName];
    for (const dllName of dllCandidates) {
      if (dllName && dllName.length >= 2 && dllName.length <= 64) {
        if (dllName.localeCompare(fallback, undefined, { sensitivity: 'base' }) === 0) continue;
        if (!isGenericName(dllName)) {
          log.debug(`[NameResolver] ${fallback} → Level 2.5 (DLL): "${dllName}"`);
          return dllName;
        }
        log.debug(`[NameResolver] ${fallback} — Level 2.5 DLL "${dllName}" filtered as generic`);
      }
    }

    // Level 3: directName plain 字符串
    if (raw.defaultVal &&
        !raw.defaultVal.startsWith('@') &&
        !raw.defaultVal.startsWith('ms-resource:')) {
      if (!isUselessPlain(raw.defaultVal, fallback)) {
        log.debug(`[NameResolver] ${fallback} → Level 3 (directName plain): "${raw.defaultVal}"`);
        return raw.defaultVal;
      }
    }

    // 标准谓词翻译：对 cleanName 做最后一搏
    const translated = translateStandardVerb(fallback, this.language);
    if (translated) {
      log.debug(`[NameResolver] ${fallback} → Standard verb translation: "${translated}"`);
      return translated;
    }

    log.debug(`[NameResolver] ${fallback} → Fallback (key name)`);
    return fallback;
  }
}
