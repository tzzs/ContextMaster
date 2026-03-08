import type Database from 'better-sqlite3';
import { BackupSnapshot } from '../../../shared/types';
import { BackupType } from '../../../shared/enums';

interface DbRow {
  id: number;
  name: string;
  creation_time: string;
  type: string;
  menu_items_json: string;
  sha256_checksum: string;
}

export class BackupSnapshotRepo {
  constructor(private readonly db: Database.Database) {}

  insert(snapshot: Omit<BackupSnapshot, 'id'>): BackupSnapshot {
    const stmt = this.db.prepare(`
      INSERT INTO backup_snapshots
        (name, creation_time, type, menu_items_json, sha256_checksum)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      snapshot.name,
      snapshot.creationTime,
      snapshot.type,
      snapshot.menuItemsJson,
      snapshot.sha256Checksum
    );
    return { ...snapshot, id: result.lastInsertRowid as number };
  }

  findAll(): BackupSnapshot[] {
    const rows = this.db
      .prepare('SELECT * FROM backup_snapshots ORDER BY creation_time DESC')
      .all() as DbRow[];
    return rows.map(this.toModel);
  }

  findById(id: number): BackupSnapshot | null {
    const row = this.db
      .prepare('SELECT * FROM backup_snapshots WHERE id = ?')
      .get(id) as DbRow | undefined;
    return row ? this.toModel(row) : null;
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM backup_snapshots WHERE id = ?').run(id);
  }

  private toModel(row: DbRow): BackupSnapshot {
    return {
      id: row.id,
      name: row.name,
      creationTime: row.creation_time,
      type: row.type as BackupType,
      menuItemsJson: row.menu_items_json,
      sha256Checksum: row.sha256_checksum,
    };
  }
}
