import Dexie, { type Table } from "dexie";
import type {
  Sortie,
  InspectionPhoto,
  KmlRoute,
  Confirmation,
  FlightReview,
  ImportBatch,
  AuditLog,
} from "@/types";

class AppDB extends Dexie {
  sorties!: Table<Sortie, string>;
  inspectionPhotos!: Table<InspectionPhoto, string>;
  kmlRoutes!: Table<KmlRoute, string>;
  confirmations!: Table<Confirmation, string>;
  flightReviews!: Table<FlightReview, string>;
  importBatches!: Table<ImportBatch, string>;
  auditLogs!: Table<AuditLog, string>;

  constructor() {
    super("DroneBatterySwapDB");

    this.version(1).stores({
      sorties: "id, sortieNo, batteryId, status, timestamp, importBatchId",
      inspectionPhotos: "id, sortieId, fileHash, exifTimestamp",
      kmlRoutes: "id, sortieId, fileHash",
      confirmations: "id, sortieId, status, timestamp",
      flightReviews: "id, sortieId",
      importBatches: "id, status, timestamp",
      auditLogs: "id, action, timestamp, sortieId, batchId",
    });
  }
}

export const db = new AppDB();
