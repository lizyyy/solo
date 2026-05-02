#!/usr/bin/env python3
import argparse
import csv
import json
import yaml
import os
from collections import defaultdict
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime


MAX_SEQUENCE = 16383


@dataclass
class CCSDSPrimaryHeader:
    version: int
    type: int
    secondary_header_flag: int
    apid: int
    sequence_flags: int
    sequence_count: int
    packet_length: int


def parse_ccsds_header(hex_data: str) -> Optional[CCSDSPrimaryHeader]:
    try:
        data = bytes.fromhex(hex_data)
        if len(data) < 6:
            return None
        header_bytes = data[:6]
        word1 = (header_bytes[0] << 8) | header_bytes[1]
        word2 = (header_bytes[2] << 8) | header_bytes[3]
        word3 = (header_bytes[4] << 8) | header_bytes[5]
        version = (word1 >> 13) & 0x07
        packet_type = (word1 >> 12) & 0x01
        secondary_header_flag = (word1 >> 11) & 0x01
        apid = word1 & 0x07FF
        sequence_flags = (word2 >> 14) & 0x03
        sequence_count = word2 & 0x3FFF
        packet_length = word3
        return CCSDSPrimaryHeader(
            version=version,
            type=packet_type,
            secondary_header_flag=secondary_header_flag,
            apid=apid,
            sequence_flags=sequence_flags,
            sequence_count=sequence_count,
            packet_length=packet_length
        )
    except Exception:
        return None


def sequence_delta(prev: int, curr: int) -> int:
    if curr >= prev:
        return curr - prev
    else:
        return (curr + MAX_SEQUENCE + 1) - prev


class PacketReassembler:
    def __init__(self):
        self.packets: Dict[Tuple[int, int], List[Dict]] = defaultdict(list)
        self.completed_packets: List[Dict] = []
        self.duplicate_count = 0
        self.seen_packets: set = set()

    def add_fragment(self, fragment: Dict):
        header = parse_ccsds_header(fragment['hex_data'])
        if not header:
            return
        key = (header.apid, header.sequence_count)
        if key in self.seen_packets:
            self.duplicate_count += 1
            return
        self.seen_packets.add(key)
        self.packets[key].append(fragment)
        if header.sequence_flags == 3:
            self._reconstruct_packet(key, header)

    def _reconstruct_packet(self, key: Tuple[int, int], header: CCSDSPrimaryHeader):
        fragments = self.packets[key]
        fragments.sort(key=lambda x: parse_ccsds_header(x['hex_data']).sequence_flags)
        full_data = b''
        for frag in fragments:
            data = bytes.fromhex(frag['hex_data'])
            full_data += data[6:]
        self.completed_packets.append({
            'apid': header.apid,
            'sequence_count': header.sequence_count,
            'full_hex': full_data.hex(),
            'fragment_count': len(fragments),
            'timestamp': fragments[-1]['timestamp'] if fragments else None,
            'frame_ids': [f['frame_id'] for f in fragments]
        })
        del self.packets[key]


class QualityChecker:
    def __init__(self, calibration: Dict):
        self.calibration = calibration
        self.alerts: List[Dict] = []
        self.timeline_events: List[Dict] = []
        self.last_sequence: Dict[int, int] = {}
        self.last_timestamp: Optional[float] = None

    def check_sequence(self, apid: int, seq: int, timestamp: float, frame_id: str):
        if apid not in self.last_sequence:
            self.last_sequence[apid] = seq
            return
        prev_seq = self.last_sequence[apid]
        delta = sequence_delta(prev_seq, seq)
        if delta > 1:
            if seq < prev_seq:
                self._add_alert('SEQUENCE_WRAP', f'序列号回卷: APID={apid}, {prev_seq}->{seq}', frame_id, timestamp)
            else:
                self._add_alert('SEQUENCE_GAP', f'序列号缺口: APID={apid}, 缺失{delta-1}个包', frame_id, timestamp)
        elif delta == 1 and seq < prev_seq:
            self._add_alert('SEQUENCE_WRAP', f'序列号回卷: APID={apid}, {prev_seq}->{seq}', frame_id, timestamp)
        elif delta == 0 and seq == prev_seq:
            self._add_alert('DUPLICATE', f'重复包: APID={apid}, 序列号={seq}', frame_id, timestamp)
        self.last_sequence[apid] = seq

    def check_timestamp_drift(self, timestamp: float, frame_id: str):
        if self.last_timestamp is not None:
            drift = timestamp - self.last_timestamp
            if abs(drift) > 10.0:
                self._add_alert('TIMESTAMP_DRIFT', f'时间戳漂移: {drift:.2f}秒', frame_id, timestamp)
        self.last_timestamp = timestamp

    def decode_and_check_limits(self, hex_data: str, timestamp: float, frame_id: str):
        data = bytes.fromhex(hex_data)
        if len(data) < 10:
            return
        temp_raw = int.from_bytes(data[6:8], 'big')
        volt_raw = int.from_bytes(data[8:10], 'big')
        temp_cal = self.calibration.get('temperature', {})
        volt_cal = self.calibration.get('voltage', {})
        temp = temp_raw * temp_cal.get('scale', 0.01) + temp_cal.get('offset', 0)
        volt = volt_raw * volt_cal.get('scale', 0.001) + volt_cal.get('offset', 0)
        if temp < temp_cal.get('min', -50) or temp > temp_cal.get('max', 85):
            self._add_alert('TEMP_OOR', f'温度越限: {temp:.2f}°C', frame_id, timestamp)
        if volt < volt_cal.get('min', 28) or volt > volt_cal.get('max', 33):
            self._add_alert('VOLT_OOR', f'电压越限: {volt:.2f}V', frame_id, timestamp)
        return {'temperature': temp, 'voltage': volt}

    def _add_alert(self, alert_type: str, message: str, frame_id: str, timestamp: float):
        alert = {
            'type': alert_type,
            'message': message,
            'frame_id': frame_id,
            'timestamp': timestamp
        }
        self.alerts.append(alert)
        self.timeline_events.append(alert)


def load_frame_log(csv_path: str) -> List[Dict]:
    frames = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            frames.append({
                'frame_id': row['frame_id'],
                'timestamp': float(row['timestamp']),
                'antenna': row['antenna'],
                'snr': float(row['snr'])
            })
    return frames


def load_telemetry_packets(jsonl_path: str) -> List[Dict]:
    packets = []
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                packets.append(json.loads(line))
    return packets


def load_calibration(yaml_path: str) -> Dict:
    with open(yaml_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def write_outputs(output_dir: str, reassembled: List[Dict], alerts: List[Dict], timeline: List[Dict]):
    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, 'reassembled_packets.json'), 'w', encoding='utf-8') as f:
        json.dump(reassembled, f, indent=2, ensure_ascii=False)
    with open(os.path.join(output_dir, 'alerts.csv'), 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['type', 'message', 'frame_id', 'timestamp'])
        writer.writeheader()
        writer.writerows(alerts)
    with open(os.path.join(output_dir, 'timeline.md'), 'w', encoding='utf-8') as f:
        f.write('# 遥测接收质量事件时间线\n\n')
        for event in sorted(timeline, key=lambda x: x['timestamp']):
            dt = datetime.fromtimestamp(event['timestamp'])
            f.write(f'- **{dt.strftime("%Y-%m-%d %H:%M:%S")}** ({event["timestamp"]:.3f}s) [{event["type"]}]: {event["message"]} (帧 {event["frame_id"]})\n')


def main():
    parser = argparse.ArgumentParser(description='卫星遥测接收质量复核工具')
    parser.add_argument('--csv', required=True, help='地面站帧日志 CSV')
    parser.add_argument('--jsonl', required=True, help='十六进制遥测包 JSONL')
    parser.add_argument('--yaml', required=True, help='通道标定 YAML')
    parser.add_argument('--output', default='./output', help='输出目录')
    args = parser.parse_args()
    frames = load_frame_log(args.csv)
    packets = load_telemetry_packets(args.jsonl)
    calibration = load_calibration(args.yaml)
    reassembler = PacketReassembler()
    checker = QualityChecker(calibration)
    for packet in packets:
        reassembler.add_fragment(packet)
        header = parse_ccsds_header(packet['hex_data'])
        if header:
            checker.check_sequence(header.apid, header.sequence_count, packet['timestamp'], packet['frame_id'])
            checker.check_timestamp_drift(packet['timestamp'], packet['frame_id'])
            decoded = checker.decode_and_check_limits(packet['hex_data'], packet['timestamp'], packet['frame_id'])
            if decoded:
                checker.timeline_events.append({
                    'type': 'DATA',
                    'message': f'T={decoded["temperature"]:.2f}°C, V={decoded["voltage"]:.2f}V',
                    'frame_id': packet['frame_id'],
                    'timestamp': packet['timestamp']
                })
    write_outputs(args.output, reassembler.completed_packets, checker.alerts, checker.timeline_events)
    print(f'处理完成！')
    print(f'  重组完整包: {len(reassembler.completed_packets)}')
    print(f'  检测重复包: {reassembler.duplicate_count}')
    print(f'  告警数量: {len(checker.alerts)}')
    print(f'  输出目录: {os.path.abspath(args.output)}')


if __name__ == '__main__':
    main()
