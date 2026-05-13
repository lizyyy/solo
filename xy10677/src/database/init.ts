import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../orthodontic.db');

export const initDatabase = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('Connected to SQLite database');
      
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS patients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT,
          doctorId TEXT NOT NULL,
          doctorName TEXT NOT NULL,
          startDate TEXT NOT NULL,
          currentPhase TEXT NOT NULL,
          totalAligners INTEGER NOT NULL DEFAULT 0,
          currentAligner INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS aligner_batches (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          batchNumber INTEGER NOT NULL,
          startAligner INTEGER NOT NULL,
          endAligner INTEGER NOT NULL,
          status TEXT NOT NULL,
          receivedDate TEXT,
          startDate TEXT,
          expectedEndDate TEXT,
          actualEndDate TEXT,
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS appointments (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          batchId TEXT,
          scheduledDate TEXT NOT NULL,
          scheduledTime TEXT NOT NULL,
          status TEXT NOT NULL,
          type TEXT NOT NULL,
          doctorId TEXT NOT NULL,
          doctorName TEXT NOT NULL,
          actualDate TEXT,
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id),
          FOREIGN KEY (batchId) REFERENCES aligner_batches(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS treatment_todos (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          patientName TEXT NOT NULL,
          type TEXT NOT NULL,
          description TEXT NOT NULL,
          priority TEXT NOT NULL,
          status TEXT NOT NULL,
          assigneeId TEXT NOT NULL,
          assigneeName TEXT NOT NULL,
          dueDate TEXT,
          completedAt TEXT,
          completedBy TEXT,
          relatedBatchId TEXT,
          relatedAppointmentId TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS exception_records (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL,
          relatedBatchId TEXT,
          relatedAppointmentId TEXT,
          assigneeId TEXT,
          assigneeName TEXT,
          resolvedAt TEXT,
          resolution TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS timeline_events (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          eventType TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          reason TEXT,
          operatorId TEXT,
          operatorName TEXT,
          relatedEntityId TEXT,
          relatedEntityType TEXT,
          oldValues TEXT,
          newValues TEXT,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS modification_history (
          id TEXT PRIMARY KEY,
          entityType TEXT NOT NULL,
          entityId TEXT NOT NULL,
          fieldName TEXT NOT NULL,
          oldValue TEXT,
          newValue TEXT,
          modifiedBy TEXT NOT NULL,
          modifiedByName TEXT NOT NULL,
          modifiedAt TEXT NOT NULL,
          reason TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
          id TEXT PRIMARY KEY,
          requestHash TEXT NOT NULL UNIQUE,
          response TEXT NOT NULL,
          createdAt TEXT NOT NULL
        )`);

        console.log('All tables created or verified');
        resolve(db);
      });
    });
  });
};

export default initDatabase;
