import csv
import json
import yaml
from datetime import datetime
from typing import List, Dict, Any, Tuple
from .models import Inventory, Batch, LinenStatus, ScanRecord
from .state_machine import StateMachine, LinenState

class ImportValidator:
    @staticmethod
    def validate_inventory_csv(file_path: str) -> Tuple[List[Dict], List[str]]:
        valid_items = []
        errors = []
        required_fields = ["rfid", "type", "room", "hotel"]
        
        with open(file_path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader, start=2):
                missing = [f for f in required_fields if f not in row or not row[f]]
                if missing:
                    errors.append(f"行 {idx}: 缺少字段 {missing}")
                    continue
                valid_items.append(row)
        return valid_items, errors

    @staticmethod
    def validate_scans_jsonl(file_path: str) -> Tuple[List[Dict], List[str]]:
        valid_items = []
        errors = []
        required_fields = ["rfid", "action", "timestamp"]
        valid_actions = ["SEND", "RECEIVE", "REPORT_LOSS", "REPORT_DAMAGE"]
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for idx, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    missing = [f for f in required_fields if f not in data or not data[f]]
                    if missing:
                        errors.append(f"行 {idx}: 缺少字段 {missing}")
                        continue
                    if data["action"] not in valid_actions:
                        errors.append(f"行 {idx}: 无效动作 {data['action']}")
                        continue
                    try:
                        data["timestamp"] = datetime.fromisoformat(data["timestamp"])
                    except ValueError:
                        errors.append(f"行 {idx}: 无效时间戳格式")
                        continue
                    valid_items.append(data)
                except json.JSONDecodeError:
                    errors.append(f"行 {idx}: JSON 解析错误")
        return valid_items, errors

    @staticmethod
    def validate_loss_rules_yaml(file_path: str) -> Tuple[Dict, List[str]]:
        errors = []
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                rules = yaml.safe_load(f)
            except yaml.YAMLError as e:
                errors.append(f"YAML 解析错误: {e}")
                return {}, errors
        
        required = ["timeout_hours", "cross_hotel_alarm", "max_wash_cycles"]
        for f in required:
            if f not in rules:
                errors.append(f"缺少字段: {f}")
        
        if not isinstance(rules.get("timeout_hours"), int):
            errors.append("timeout_hours 必须是整数")
        if not isinstance(rules.get("cross_hotel_alarm"), bool):
            errors.append("cross_hotel_alarm 必须是布尔值")
        if not isinstance(rules.get("max_wash_cycles"), dict):
            errors.append("max_wash_cycles 必须是字典")
        
        return rules if not errors else {}, errors
