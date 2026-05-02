#!/usr/bin/env python3
import pytest
import tempfile
import os
import json
import csv
import yaml
from telemetry_checker import (
    parse_ccsds_header,
    sequence_delta,
    PacketReassembler,
    QualityChecker,
    MAX_SEQUENCE
)


def test_parse_ccsds_header():
    header = parse_ccsds_header('0801c0000004')
    assert header is not None
    assert header.version == 0
    assert header.type == 0
    assert header.secondary_header_flag == 1
    assert header.apid == 1
    assert header.sequence_flags == 3
    assert header.sequence_count == 0
    assert header.packet_length == 4


def test_parse_invalid_header():
    assert parse_ccsds_header('00') is None


def test_sequence_delta_normal():
    assert sequence_delta(0, 1) == 1
    assert sequence_delta(5, 10) == 5


def test_sequence_delta_wrap():
    assert sequence_delta(MAX_SEQUENCE, 0) == 1
    assert sequence_delta(MAX_SEQUENCE - 5, 3) == 9


def test_packet_reassembler_single():
    assembler = PacketReassembler()
    assembler.add_fragment({
        'frame_id': 'F001',
        'timestamp': 100.0,
        'hex_data': '0801c0000004aabbccdd'
    })
    assert len(assembler.completed_packets) == 1
    assert assembler.completed_packets[0]['apid'] == 1


def test_packet_reassembler_duplicate():
    assembler = PacketReassembler()
    assembler.add_fragment({
        'frame_id': 'F001',
        'timestamp': 100.0,
        'hex_data': '0801c0000004aabbccdd'
    })
    assembler.add_fragment({
        'frame_id': 'F002',
        'timestamp': 101.0,
        'hex_data': '0801c0000004aabbccdd'
    })
    assert assembler.duplicate_count == 1


def test_quality_checker_sequence_gap():
    calibration = {'temperature': {}, 'voltage': {}}
    checker = QualityChecker(calibration)
    checker.check_sequence(1, 0, 100.0, 'F001')
    checker.check_sequence(1, 2, 101.0, 'F002')
    assert len(checker.alerts) == 1
    assert checker.alerts[0]['type'] == 'SEQUENCE_GAP'


def test_quality_checker_sequence_wrap():
    calibration = {'temperature': {}, 'voltage': {}}
    checker = QualityChecker(calibration)
    checker.check_sequence(1, MAX_SEQUENCE, 100.0, 'F001')
    checker.check_sequence(1, 0, 101.0, 'F002')
    assert len(checker.alerts) == 1
    assert checker.alerts[0]['type'] == 'SEQUENCE_WRAP'


def test_quality_checker_timestamp_drift():
    calibration = {'temperature': {}, 'voltage': {}}
    checker = QualityChecker(calibration)
    checker.check_timestamp_drift(100.0, 'F001')
    checker.check_timestamp_drift(115.0, 'F002')
    assert len(checker.alerts) == 1
    assert checker.alerts[0]['type'] == 'TIMESTAMP_DRIFT'


def test_quality_checker_temp_oor():
    calibration = {
        'temperature': {'scale': 0.01, 'offset': 0, 'min': -50, 'max': 85},
        'voltage': {'scale': 0.001, 'offset': 0, 'min': 28, 'max': 33}
    }
    checker = QualityChecker(calibration)
    checker.decode_and_check_limits('000000000000ffff7530', 100.0, 'F001')
    assert len(checker.alerts) >= 1


def test_integration_full_flow():
    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = os.path.join(tmpdir, 'frames.csv')
        jsonl_path = os.path.join(tmpdir, 'packets.jsonl')
        yaml_path = os.path.join(tmpdir, 'calib.yaml')
        out_dir = os.path.join(tmpdir, 'output')
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['frame_id', 'timestamp', 'antenna', 'snr'])
            writer.writeheader()
            writer.writerow({'frame_id': 'F001', 'timestamp': '100.0', 'antenna': 'ANT1', 'snr': '12.0'})
            writer.writerow({'frame_id': 'F002', 'timestamp': '101.0', 'antenna': 'ANT1', 'snr': '13.0'})
        with open(jsonl_path, 'w', encoding='utf-8') as f:
            f.write(json.dumps({'frame_id': 'F001', 'timestamp': 100.0, 'hex_data': '0801c000000407d07530'}) + '\n')
            f.write(json.dumps({'frame_id': 'F002', 'timestamp': 101.0, 'hex_data': '0801c001000407d17531'}) + '\n')
        with open(yaml_path, 'w', encoding='utf-8') as f:
            yaml.dump({
                'temperature': {'scale': 0.01, 'offset': 0, 'min': -50, 'max': 85},
                'voltage': {'scale': 0.001, 'offset': 0, 'min': 28, 'max': 33}
            }, f)
        import subprocess
        import sys
        result = subprocess.run([
            sys.executable, 'telemetry_checker.py',
            '--csv', csv_path,
            '--jsonl', jsonl_path,
            '--yaml', yaml_path,
            '--output', out_dir
        ], capture_output=True, text=True)
        assert result.returncode == 0
        assert os.path.exists(os.path.join(out_dir, 'reassembled_packets.json'))
        assert os.path.exists(os.path.join(out_dir, 'alerts.csv'))
        assert os.path.exists(os.path.join(out_dir, 'timeline.md'))


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
