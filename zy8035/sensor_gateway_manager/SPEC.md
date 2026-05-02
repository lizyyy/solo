# Sensor Gateway Config Manager - Specification

## 1. Project Overview

- **Name**: Sensor Gateway Config Manager
- **Type**: Desktop tool (Python/Tkinter)
- **Core functionality**: Local serial device configuration snapshot & rollback utility for managing multiple sensor gateways in a lab environment.
- **Target users**: Lab colleagues managing multi-sensor gateway devices

## 2. Architecture

### Modules

| Module | Responsibility |
|--------|----------------|
| `adapters/serial_adapter.py` | Mock serial port communication, register read/write |
| `config_parser/yaml_parser.py` | Import target config from YAML file |
| `engine/diff_engine.py` | Compute diff, selective write, rollback with retry |
| `persistence/sqlite_store.py` | SQLite history storage |
| `ui/main_window.py` | Tkinter GUI |

## 3. Functionality Specification

### 3.1 Mock Serial Adapter
- Simulates serial port communication with device registers
- Maintains in-memory register map (JSON-like structure)
- Supports read/write registers with configurable readonly flags
- Simulates device offline scenarios via mock control
- **Edge cases**:
  - Device offline: raises `DeviceOfflineError`
  - Read-only register: raises `ReadOnlyRegisterError`
  - Type mismatch: raises `TypeMismatchError`

### 3.2 Config Parser (YAML)
- Reads target configuration YAML files
- Validates register definitions (name, address, type, value, readonly flag)
- Supports multiple sensor gateway device profiles
- Returns normalized register list

### 3.3 Diff/Rollback Engine
- **Snapshot**: Reads current register values from device
- **Diff**: Compares target config vs snapshot, highlights differences
- **Selective write**: Writes only user-selected registers
- **Retry logic**: Failed writes retry up to N attempts with backoff
- **Rollback**: Restore registers to previous snapshot state
- **Edge cases**:
  - Read-only register: skip with warning
  - Type mismatch: skip with warning, log details

### 3.4 SQLite Persistence
- Stores snapshot history per device
- Schema: id, device_id, timestamp, snapshot_json, target_yaml, diff_summary
- Allows browsing history and restoring previous snapshots

### 3.5 Tkinter UI
- Device selector (dropdown)
- Import YAML button + file path display
- Snapshot button + timestamp display
- Diff view with color-coded highlighting:
  - Green: match
  - Yellow: difference (target change)
  - Red: error/mismatch
- Checkbox per register for selective write
- Write button with progress feedback
- History list (treeview) with restore option
- Status bar for operation feedback

## 4. Data Structures

### Register
```python
{
    "address": int,
    "name": str,
    "type": str,       # "int" | "float" | "bool" | "string"
    "value": any,
    "readonly": bool
}
```

### DeviceSnapshot
```python
{
    "device_id": str,
    "timestamp": str,
    "registers": List[Register]
}
```

## 5. Sample Data

- `sample_data/target_config.yaml`: Example gateway config
- `sample_data/registers.json`: Mock device register map
- `sample_data/devices.json`: Mock device list

## 6. Acceptance Criteria

1. Mock adapter reads/writes registers without real hardware
2. YAML config can be imported and parsed
3. Diff correctly identifies differences between snapshot and target
4. Selective write writes only checked registers
5. Failed writes retry with backoff
6. Read-only registers are skipped with warning
7. Type mismatch registers are skipped with warning
8. Offline device raises appropriate error
9. SQLite stores and retrieves history correctly
10. Tkinter UI displays diff with color highlighting
11. History can be browsed and restored
12. Dry-run demo runs without actual hardware
13. README provides clear run instructions