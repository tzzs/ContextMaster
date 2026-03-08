import type Database from 'better-sqlite3';
import { OperationRecord } from '../../../shared/types';
import { OperationType } from '../../../shared/enums';

interface DbRow {
  id: number;
  timestamp: string;
  operation_type: string;
  target_name: string;
  registry_path: string;
  old_value: string | null;
  new_value: string | null;
}

export class OperationRecordRepo {
  constructor(private readonly db: Database.Database) {}

  insert(record: Omit<OperationRecord, 'id'>): OperationRecord {
    const stmt = this.db.prepare(`
      INSERT INTO operation_records
        (timestamp, operation_type, target_name, registry_path, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      record.timestamp,
      record.operationType,
      record.targetEntryName,
      record.registryPath,
      record.oldValue ?? null,
      record.newValue ?? null
    );
    return { ...record, id: result.lastInsertRowid as number };
  }

  findAll(): OperationRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM operation_records ORDER BY timestamp DESC')
      .all() as DbRow[];
    return rows.map(this.toModel);
  }

  findById(id: number): OperationRecord | null {
    const row = this.db
      .prepare('SELECT * FROM operation_records WHERE id = ?')
      .get(id) as DbRow | undefined;
    return row ? this.toModel(row) : null;
  }

  deleteAll(): void {
    this.db.prepare('DELETE FROM operation_records').run();
  }

  private toModel(row: DbRow): OperationRecord {
    return {
      id: row.id,
      timestamp: row.timestamp,
      operationType: row.operation_type as OperationType,
      targetEntryName: row.target_name,
      registryPath: row.registry_path,
      oldValue: row.old_value,
      newValue: row.new_value,
    };
  }
}
