import csv
import json
import hashlib
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from cold_chain.models import (
    TemperatureReading, VehicleRoute, Node, SignoffRecord,
    Batch, ThresholdRule, DataFingerprint
)


class DataParser:
    def __init__(self):
        self.fingerprints: Dict[str, DataFingerprint] = {}
        self._existing_hashes = set()

    def _calculate_checksum(self, data: List[Dict[str, Any]]) -> str:
        sorted_data = sorted(
            [json.dumps(row, sort_keys=True, default=str) for row in data]
        )
        combined = "||".join(sorted_data)
        return hashlib.sha256(combined.encode()).hexdigest()

    def _generate_fingerprint(
        self,
        source: str, data: List[Dict[str, Any]]
    ) -> Optional[DataFingerprint]:
        if not data:
            return None
        
        times = []
        for row in data:
            if 'time' in row:
                try:
                    times.append(datetime.strptime(row['time'], "%Y-%m-%d %H:%M:%S"))
                except ValueError:
                    pass
            elif 'start_time' in row:
                try:
                    times.append(datetime.strptime(row['start_time'], "%Y-%m-%d %H:%M:%S"))
                except ValueError:
                    pass
            elif 'signoff_time' in row:
                try:
                    times.append(datetime.strptime(row['signoff_time'], "%Y-%m-%d %H:%M:%S"))
                except ValueError:
                    pass
        
        data_range = {}
        if times:
            data_range = {
                'min': min(times),
                'max': max(times)
            }
        
        return DataFingerprint(
            source=source,
            checksum=self._calculate_checksum(data),
            record_count=len(data),
            timestamp=datetime.now(),
            data_range=data_range
        )

    def is_duplicate_data(
        self, source: str, data: List[Dict[str, Any]]
    ) -> bool:
        new_fingerprint = self._generate_fingerprint(source, data)
        if not new_fingerprint:
            return False
        
        if new_fingerprint.checksum in self._existing_hashes:
            return True
        
        return False

    def load_from_csv(
        self, file_path: str
    ) -> List[Dict[str, Any]]:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            return list(reader)

    def load_from_json(
        self, file_path: str
    ) -> List[Dict[str, Any]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _parse_temperature(self, data: List[Dict[str, Any]]) -> List[TemperatureReading]:
        readings = []
        for row in data:
            try:
                reading = TemperatureReading(
                    sensor_id=str(row.get('sensor_id', '')).strip(),
                    vehicle_id=str(row.get('vehicle_id', '')).strip(),
                    time=str(row.get('time', '')).strip(),
                    temperature=float(row.get('temperature', 0)),
                    raw_data=row
                )
                readings.append(reading)
            except Exception as e:
                print(f"警告：跳过无效温度记录：{e}")
        return readings

    def _parse_routes(self, data: List[Dict[str, Any]]) -> List[VehicleRoute]:
        routes = []
        for row in data:
            try:
                route = VehicleRoute(
                    route_id=str(row.get('route_id', '')).strip(),
                    vehicle_id=str(row.get('vehicle_id', '')).strip(),
                    start_time=str(row.get('start_time', '')).strip(),
                    end_time=str(row.get('end_time', '')).strip(),
                    start_node=str(row.get('start_node', '')).strip(),
                    end_node=str(row.get('end_node', '')).strip(),
                    driver_id=str(row.get('driver_id', '')).strip(),
                    driver_name=str(row.get('driver_name', '')).strip() or None,
                    raw_data=row
                )
                routes.append(route)
            except Exception as e:
                print(f"警告：跳过无效路线记录：{e}")
        return routes

    def _parse_nodes(self, data: List[Dict[str, Any]]) -> List[Node]:
        nodes = []
        for row in data:
            try:
                node = Node(
                    node_id=str(row.get('node_id', '')).strip(),
                    node_name=str(row.get('node_name', '')).strip(),
                    node_type=str(row.get('node_type', '')).strip(),
                    address=str(row.get('address', '')).strip(),
                    responsible_party=str(row.get('responsible_party', '')).strip() or None,
                    raw_data=row
                )
                nodes.append(node)
            except Exception as e:
                print(f"警告：跳过无效节点记录：{e}")
        return nodes

    def _parse_signoffs(self, data: List[Dict[str, Any]]) -> List[SignoffRecord]:
        records = []
        for row in data:
            try:
                temp_at_signoff = row.get('temperature_at_signoff')
                record = SignoffRecord(
                    signoff_id=str(row.get('signoff_id', '')).strip(),
                    node_id=str(row.get('node_id', '')).strip(),
                    vehicle_id=str(row.get('vehicle_id', '')).strip(),
                    batch_id=str(row.get('batch_id', '')).strip(),
                    signoff_time=str(row.get('signoff_time', '')).strip(),
                    operator=str(row.get('operator', '')).strip(),
                    temperature_at_signoff=float(temp_at_signoff) if temp_at_signoff else None,
                    raw_data=row
                )
                records.append(record)
            except Exception as e:
                print(f"警告：跳过无效签收记录：{e}")
        return records

    def _parse_batches(self, data: List[Dict[str, Any]]) -> List[Batch]:
        batches = []
        for row in data:
            try:
                batch = Batch(
                    batch_id=str(row.get('batch_id', '')).strip(),
                    product_name=str(row.get('product_name', '')).strip(),
                    product_type=str(row.get('product_type', '')).strip(),
                    quantity=int(row.get('quantity', 0)),
                    temperature_min=float(row.get('temperature_min', 0)),
                    temperature_max=float(row.get('temperature_max', 100)),
                    start_node=str(row.get('start_node', '')).strip(),
                    end_node=str(row.get('end_node', '')).strip(),
                    expected_delivery_time=str(row.get('expected_delivery_time', '')).strip() or None,
                    actual_delivery_time=str(row.get('actual_delivery_time', '')).strip() or None,
                    vehicle_ids=[
                        v.strip() for v in str(row.get('vehicle_ids', '')).split(',') if v.strip()
                    ] if row.get('vehicle_ids') else [],
                    raw_data=row
                )
                batches.append(batch)
            except Exception as e:
                print(f"警告：跳过无效批次记录：{e}")
        return batches

    def _parse_thresholds(self, data: List[Dict[str, Any]]) -> List[ThresholdRule]:
        rules = []
        for row in data:
            try:
                rule = ThresholdRule(
                    rule_id=str(row.get('rule_id', '')).strip(),
                    product_type=str(row.get('product_type', '')).strip(),
                    warning_min=float(row.get('warning_min', -999)),
                    warning_max=float(row.get('warning_max', 999)),
                    critical_min=float(row.get('critical_min', -999)),
                    critical_max=float(row.get('critical_max', 999)),
                    allowed_duration=int(row.get('allowed_duration', 0)),
                    raw_data=row
                )
                rules.append(rule)
            except Exception as e:
                print(f"警告：跳过无效阈值规则：{e}")
        return rules

    def parse_file(
        self, file_path: str, data_type: str
    ) -> Optional[List[Any]]:
        ext = Path(file_path).suffix.lower()
        if ext == '.csv':
            raw_data = self.load_from_csv(file_path)
        elif ext == '.json':
            raw_data = self.load_from_json(file_path)
        else:
            raise ValueError(f"不支持的文件格式：{ext}")

        fingerprint = self._generate_fingerprint(file_path, raw_data)
        if fingerprint and fingerprint.checksum in self._existing_hashes:
            print(f"检测到重复数据，跳过：{file_path}")
            return None
        
        if fingerprint:
            self.fingerprints[file_path] = fingerprint
            self._existing_hashes.add(fingerprint.checksum)

        parsers = {
            'temperature': self._parse_temperature,
            'routes': self._parse_routes,
            'nodes': self._parse_nodes,
            'signoffs': self._parse_signoffs,
            'batches': self._parse_batches,
            'thresholds': self._parse_thresholds
        }
        
        if data_type not in parsers:
            raise ValueError(f"未知数据类型：{data_type}")
        
        return parsers[data_type](raw_data)

    def parse_config_files(self, config: Dict[str, str]) -> Dict[str, Any]:
        result = {}
        
        file_mappings = {
            'temperature': 'temperature',
            'routes': 'routes',
            'nodes': 'nodes',
            'signoffs': 'signoffs',
            'batches': 'batches',
            'thresholds': 'thresholds'
        }

        for config_key, data_type in file_mappings.items():
            if config_key in config and config[config_key]:
                file_path = config[config_key]
                if os.path.exists(file_path):
                    result[data_type] = self.parse_file(file_path, data_type)
                else:
                    print(f"文件不存在：{file_path}")
            else:
                print(f"警告：未配置{config_key}数据文件")

        return result
