#!/usr/bin/env python3
"""
Dry-run demo for Sensor Gateway Config Manager.
Tests all modules without requiring real hardware.
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sensor_gateway_manager.adapters.serial_adapter import MockSerialAdapter, DeviceOfflineError, ReadOnlyRegisterError, TypeMismatchError
from sensor_gateway_manager.config_parser.yaml_parser import YamlConfigParser
from sensor_gateway_manager.engine.diff_engine import DiffEngine
from sensor_gateway_manager.persistence.sqlite_store import SQLiteStore


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def demo_mock_adapter():
    print_section("Demo 1: Mock Serial Adapter")

    adapter = MockSerialAdapter(device_id="GW-TEST")

    print("\n--- Initial Register Snapshot ---")
    snapshot = adapter.get_snapshot()
    print(f"Device: {snapshot['device_id']}")
    print(f"Timestamp: {snapshot['timestamp']}")
    print("Registers:")
    for reg in snapshot['registers']:
        ro = "[RO]" if reg['readonly'] else "[RW]"
        print(f"  0x{reg['address']:02X} {reg['name']:20} = {str(reg['value']):15} {ro}")

    print("\n--- Test Read ---")
    reg = adapter.read_register(0x10)
    print(f"Read 0x10: {reg['name']} = {reg['value']}")

    print("\n--- Test Write ---")
    adapter.write_register(0x10, 3000)
    reg = adapter.read_register(0x10)
    print(f"After write 0x10: {reg['name']} = {reg['value']}")

    print("\n--- Test ReadOnly Error ---")
    try:
        adapter.write_register(0x00, "GW-CHANGED")
    except ReadOnlyRegisterError as e:
        print(f"Caught ReadOnlyRegisterError: {e}")

    print("\n--- Test Type Mismatch Error ---")
    try:
        adapter.write_register(0x10, "not_an_int")
    except TypeMismatchError as e:
        print(f"Caught TypeMismatchError: {e}")

    print("\n--- Test Offline ---")
    adapter.set_offline(True)
    try:
        adapter.read_register(0x10)
    except DeviceOfflineError as e:
        print(f"Caught DeviceOfflineError: {e}")
    adapter.set_offline(False)

    print("\n--- Test Batch Write ---")
    writes = [
        {"address": 0x10, "value": 1000},
        {"address": 0x11, "value": False},
        {"address": 0x12, "value": 35.5},
    ]
    result = adapter.batch_write(writes, retry=2)
    print(f"Batch write result: {json.dumps(result, indent=2)}")


def demo_yaml_parser():
    print_section("Demo 2: YAML Config Parser")

    sample_dir = os.path.join(os.path.dirname(__file__), "sample_data")
    yaml_path = os.path.join(sample_dir, "target_config.yaml")

    if not os.path.exists(yaml_path):
        print(f"Sample YAML not found at {yaml_path}, skipping")
        return

    parser = YamlConfigParser()
    config = parser.parse(yaml_path)

    print(f"\nDevice ID: {config['device_id']}")
    print(f"Name: {config['name']}")
    print(f"Description: {config['description']}")
    print("\nRegisters:")
    for reg in config['registers']:
        ro = "[RO]" if reg['readonly'] else "[RW]"
        print(f"  0x{reg['address']:02X} {reg['name']:20} = {str(reg['value']):15} {reg['type']:6} {ro}")


def demo_diff_engine():
    print_section("Demo 3: Diff/Rollback Engine")

    adapter = MockSerialAdapter(device_id="GW-DIFF")
    engine = DiffEngine(adapter)

    print("\n--- Take Snapshot (initial state) ---")
    snapshot1 = engine.take_snapshot()
    print(f"Snapshot taken at {snapshot1['timestamp']}")

    print("\n--- Modify some registers ---")
    adapter.write_register(0x10, 3000)
    adapter.write_register(0x11, False)
    adapter.write_register(0x12, 35.0)
    adapter.write_register(0x30, 2)
    print("Modified: SENSOR_INTERVAL=3000, SENSOR_ENABLED=False, THRESHOLD_TEMP=35.0, LED_MODE=2")

    print("\n--- Take Snapshot (modified state) ---")
    snapshot2 = engine.take_snapshot()
    print(f"Snapshot taken at {snapshot2['timestamp']}")

    sample_dir = os.path.join(os.path.dirname(__file__), "sample_data")
    yaml_path = os.path.join(sample_dir, "target_config.yaml")

    if not os.path.exists(yaml_path):
        print(f"Sample YAML not found, using default config")
        target = {
            "registers": [
                {"address": 0x10, "name": "SENSOR_INTERVAL", "type": "int", "value": 5000, "readonly": False},
                {"address": 0x11, "name": "SENSOR_ENABLED", "type": "bool", "value": True, "readonly": False},
                {"address": 0x12, "name": "THRESHOLD_TEMP", "type": "float", "value": 25.5, "readonly": False},
            ]
        }
    else:
        parser = YamlConfigParser()
        target = parser.parse(yaml_path)

    print("\n--- Compute Diff (snapshot2 vs target) ---")
    diff = engine.compute_diff(snapshot2, target)
    print(f"\n{'Addr':<8} {'Name':<20} {'Current':<12} {'Target':<12} {'Status':<10}")
    print("-" * 70)
    for d in diff:
        addr = f"0x{d['address']:02X}"
        name = d['name'][:18]
        curr = str(d.get('current_value', '-'))[:10]
        tgt = str(d.get('target_value', '-'))[:10]
        status = d.get('diff_type', 'unknown')
        color = ""
        if status == 'match':
            color = "OK"
        elif status == 'mismatch':
            color = "DIFF"
        elif status == 'readonly':
            color = "RO-DIFF"
        elif status == 'type_error':
            color = "TYPE-ERR"
        print(f"{addr:<8} {name:<20} {curr:<12} {tgt:<12} {color:<10}")

    print("\n--- Selective Write (write only mismatched, not readonly) ---")
    writable_mismatches = [d['address'] for d in diff if d.get('diff_type') == 'mismatch' and d.get('writable', False)]
    print(f"Selected addresses to write: {[hex(a) for a in writable_mismatches]}")
    result = engine.selective_write(diff, writable_mismatches)
    print(f"Write result: success={result.success}, failed={len(result.failed)}, skipped={len(result.skipped)}")

    print("\n--- Rollback to snapshot1 ---")
    engine.rollback(snapshot1)
    print("Rollback complete. Verifying...")
    reg = adapter.read_register(0x10)
    print(f"After rollback - SENSOR_INTERVAL = {reg['value']} (expected 5000)")


def demo_persistence():
    print_section("Demo 4: SQLite Persistence")

    db_path = "/tmp/test_sensor_gateway.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    store = SQLiteStore(db_path)

    adapter = MockSerialAdapter(device_id="GW-PERSIST")
    engine = DiffEngine(adapter)

    print("\n--- Save initial snapshot ---")
    snapshot = engine.take_snapshot()
    sid1 = store.save_snapshot("GW-PERSIST", snapshot, diff_summary="initial")
    print(f"Saved snapshot ID: {sid1}")

    print("\n--- Modify and save second snapshot ---")
    adapter.write_register(0x10, 3000)
    snapshot = engine.take_snapshot()
    sid2 = store.save_snapshot("GW-PERSIST", snapshot, diff_summary="modified interval")
    print(f"Saved snapshot ID: {sid2}")

    print("\n--- List all snapshots ---")
    records = store.get_snapshots("GW-PERSIST")
    for rec in records:
        print(f"  ID={rec.id}, Time={rec.timestamp}, Diff={rec.diff_summary}")

    print("\n--- Load snapshot by ID ---")
    rec = store.get_snapshot_by_id(sid1)
    if rec:
        data = json.loads(rec.snapshot_json)
        print(f"Loaded snapshot: {data['timestamp']}, {len(data['registers'])} registers")

    print("\n--- Restore from snapshot1 ---")
    rec = store.get_snapshot_by_id(sid1)
    snapshot = json.loads(rec.snapshot_json)
    engine.rollback(snapshot)
    reg = adapter.read_register(0x10)
    print(f"After restore - SENSOR_INTERVAL = {reg['value']} (expected 5000)")

    if os.path.exists(db_path):
        os.remove(db_path)


def demo_edge_cases():
    print_section("Demo 5: Edge Cases")

    adapter = MockSerialAdapter(device_id="GW-EDGE")

    print("\n--- Type Mismatch ---")
    try:
        adapter.write_register(0x10, 25.5)
    except TypeMismatchError as e:
        print(f"Caught TypeMismatchError: {e}")
        print("(Trying to write float to int register)")

    print("\n--- ReadOnly Register ---")
    try:
        adapter.write_register(0x00, "GW-HACKED")
    except ReadOnlyRegisterError as e:
        print(f"Caught ReadOnlyRegisterError: {e}")

    print("\n--- Device Offline ---")
    adapter.set_offline(True)
    try:
        adapter.read_all_registers()
    except DeviceOfflineError as e:
        print(f"Caught DeviceOfflineError: {e}")
    adapter.set_offline(False)

    print("\n--- Batch Write with Failures ---")
    adapter.set_offline(True)
    result = adapter.batch_write([{"address": 0x10, "value": 1000}], retry=1, backoff=0.1)
    print(f"Batch result when offline: {json.dumps(result)}")
    adapter.set_offline(False)

    print("\n--- Invalid Address ---")
    try:
        adapter.read_register(0xFF)
    except ValueError as e:
        print(f"Caught ValueError: {e}")

    print("\n--- Rollback with ReadOnly Protection ---")
    adapter.reset_to_defaults()
    engine = DiffEngine(adapter)
    snapshot = engine.take_snapshot()
    adapter.write_register(0x10, 9999)
    engine.rollback(snapshot)
    reg = adapter.read_register(0x10)
    reg_ro = adapter.read_register(0x00)
    print(f"After rollback - SENSOR_INTERVAL = {reg['value']} (expected 5000, was 9999)")
    print(f"After rollback - DEVICE_ID = {reg_ro['value']} (should remain read-only)")


def main():
    print("\n" + "=" * 60)
    print("  Sensor Gateway Config Manager - Dry Run Demo")
    print("=" * 60)

    demo_mock_adapter()
    demo_yaml_parser()
    demo_diff_engine()
    demo_persistence()
    demo_edge_cases()

    print_section("All Demos Completed Successfully!")
    print("\nTo run the GUI:")
    print("  cd sensor_gateway_manager")
    print("  python main.py")
    print("\nThen:")
    print("  1. Click 'Add Mock Device' to create a device")
    print("  2. Click 'Import YAML' and select sample_data/target_config.yaml")
    print("  3. Click 'Take Snapshot' to capture current state")
    print("  4. Click 'Compute Diff' to see differences")
    print("  5. Select registers and click 'Write Selected'")


if __name__ == "__main__":
    main()