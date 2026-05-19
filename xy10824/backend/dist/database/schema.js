"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensationStatus = exports.TaskStatus = exports.ReleaseType = exports.ReservationStatus = exports.createTablesSQL = exports.TABLES = void 0;
exports.TABLES = {
    INVENTORY_POOL: 'inventory_pool',
    RESERVATION: 'reservation',
    TIMEOUT_TASK: 'timeout_task',
    RELEASE_RECORD: 'release_record',
    COMPENSATION_ACTION: 'compensation_action',
    INVENTORY_LOG: 'inventory_log',
};
exports.createTablesSQL = `
CREATE TABLE IF NOT EXISTS inventory_pool (
  pool_id TEXT PRIMARY KEY,
  pool_name TEXT NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservation (
  reservation_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL,
  expire_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pool_id) REFERENCES inventory_pool(pool_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_order_id ON reservation(order_id);
CREATE INDEX IF NOT EXISTS idx_reservation_status ON reservation(status);
CREATE INDEX IF NOT EXISTS idx_reservation_expire_at ON reservation(expire_at);

CREATE TABLE IF NOT EXISTS timeout_task (
  task_id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  executed_at DATETIME,
  status TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservation(reservation_id)
);

CREATE INDEX IF NOT EXISTS idx_timeout_task_status ON timeout_task(status);
CREATE INDEX IF NOT EXISTS idx_timeout_task_scheduled_at ON timeout_task(scheduled_at);

CREATE TABLE IF NOT EXISTS release_record (
  record_id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  release_type TEXT NOT NULL,
  release_reason TEXT,
  released_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservation(reservation_id)
);

CREATE INDEX IF NOT EXISTS idx_release_record_order_id ON release_record(order_id);

CREATE TABLE IF NOT EXISTS compensation_action (
  action_id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_status TEXT NOT NULL,
  executed_by TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  executed_at DATETIME,
  FOREIGN KEY (reservation_id) REFERENCES reservation(reservation_id)
);

CREATE INDEX IF NOT EXISTS idx_compensation_status ON compensation_action(action_status);

CREATE TABLE IF NOT EXISTS inventory_log (
  log_id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL,
  reservation_id TEXT,
  order_id TEXT,
  change_type TEXT NOT NULL,
  quantity_change INTEGER NOT NULL,
  before_total INTEGER NOT NULL,
  after_total INTEGER NOT NULL,
  before_reserved INTEGER NOT NULL,
  after_reserved INTEGER NOT NULL,
  operator TEXT,
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pool_id) REFERENCES inventory_pool(pool_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_log_pool_id ON inventory_log(pool_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_order_id ON inventory_log(order_id);
`;
var ReservationStatus;
(function (ReservationStatus) {
    ReservationStatus["PENDING"] = "PENDING";
    ReservationStatus["RESERVED"] = "RESERVED";
    ReservationStatus["CONFIRMED"] = "CONFIRMED";
    ReservationStatus["RELEASING"] = "RELEASING";
    ReservationStatus["RELEASED"] = "RELEASED";
    ReservationStatus["RELEASE_FAILED"] = "RELEASE_FAILED";
})(ReservationStatus || (exports.ReservationStatus = ReservationStatus = {}));
var ReleaseType;
(function (ReleaseType) {
    ReleaseType["TIMEOUT"] = "TIMEOUT";
    ReleaseType["ORDER_CANCEL"] = "ORDER_CANCEL";
    ReleaseType["MANUAL"] = "MANUAL";
    ReleaseType["COMPENSATION"] = "COMPENSATION";
})(ReleaseType || (exports.ReleaseType = ReleaseType = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "PENDING";
    TaskStatus["PROCESSING"] = "PROCESSING";
    TaskStatus["SUCCESS"] = "SUCCESS";
    TaskStatus["FAILED"] = "FAILED";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var CompensationStatus;
(function (CompensationStatus) {
    CompensationStatus["PENDING"] = "PENDING";
    CompensationStatus["PROCESSING"] = "PROCESSING";
    CompensationStatus["SUCCESS"] = "SUCCESS";
    CompensationStatus["FAILED"] = "FAILED";
})(CompensationStatus || (exports.CompensationStatus = CompensationStatus = {}));
