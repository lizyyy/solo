CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  license_number TEXT NOT NULL UNIQUE,
  license_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'on_leave')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  plate_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'in_use', 'maintenance')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  route TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (driver_id) REFERENCES drivers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE TABLE IF NOT EXISTS shift_swaps (
  id TEXT PRIMARY KEY,
  original_shift_id TEXT NOT NULL,
  original_driver_id TEXT NOT NULL,
  new_driver_id TEXT NOT NULL,
  swap_reason TEXT NOT NULL CHECK (swap_reason IN ('personal_affair', 'sick_leave', 'emergency', 'other')),
  reason_detail TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending_confirm', 'swapped', 'conflict_pending', 'completed')),
  conflict_reason TEXT,
  confirmed_by_id TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (original_shift_id) REFERENCES shifts(id),
  FOREIGN KEY (original_driver_id) REFERENCES drivers(id),
  FOREIGN KEY (new_driver_id) REFERENCES drivers(id)
);

CREATE TABLE IF NOT EXISTS shift_swap_history (
  id TEXT PRIMARY KEY,
  swap_id TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  change_reason TEXT,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (swap_id) REFERENCES shift_swaps(id)
);

CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON shift_swaps(status);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_original_driver ON shift_swaps(original_driver_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_new_driver ON shift_swaps(new_driver_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_history_swap_id ON shift_swap_history(swap_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);
