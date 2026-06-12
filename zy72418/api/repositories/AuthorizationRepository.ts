import type { Database } from "better-sqlite3";
import type { AuthorizationPage } from "@shared/types";

const rowToAuth = (row: any): AuthorizationPage => ({
  id: row.id,
  recordId: row.record_id,
  expiryDate: row.expiry_date,
  authorizedAmount: row.authorized_amount,
  sourceDocument: row.source_document,
  createdAt: row.created_at,
});

export class AuthorizationRepository {
  constructor(private db: Database) {}

  findAll(): AuthorizationPage[] {
    const rows = this.db.prepare("SELECT * FROM authorization_pages ORDER BY created_at DESC").all();
    return rows.map(rowToAuth);
  }

  findByRecordId(recordId: string): AuthorizationPage | null {
    const row = this.db.prepare("SELECT * FROM authorization_pages WHERE record_id = ?").get(recordId);
    return row ? rowToAuth(row) : null;
  }

  create(auth: Omit<AuthorizationPage, "id" | "createdAt">): AuthorizationPage {
    const id = `auth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db
      .prepare(
        `INSERT INTO authorization_pages (
          id, record_id, expiry_date, authorized_amount, source_document, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        auth.recordId,
        auth.expiryDate,
        auth.authorizedAmount,
        auth.sourceDocument,
        new Date().toISOString()
      );
    return this.findByRecordId(auth.recordId)!;
  }
}
