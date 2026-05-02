import csv
import json
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional

class ImportValidator:
    @staticmethod
    def validate_orders_csv(filepath: str) -> Optional[List[Dict[str, Any]]]:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                orders = list(reader)
            
            required_fields = {'order_id', 'product_name', 'sku', 'quantity', 'shelf_code', 'customer_name', 'phone'}
            if not required_fields.issubset(orders[0].keys()):
                missing = required_fields - set(orders[0].keys())
                raise ValueError(f"orders.csv缺少必要字段: {missing}")
            
            for order in orders:
                order['quantity'] = int(order['quantity'])
            
            return orders
        except FileNotFoundError:
            raise FileNotFoundError(f"orders.csv文件不存在: {filepath}")
        except Exception as e:
            raise ValueError(f"orders.csv验证失败: {str(e)}")

    @staticmethod
    def validate_scan_events_jsonl(filepath: str) -> Optional[List[Dict[str, Any]]]:
        try:
            events = []
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        event = json.loads(line)
                        events.append(event)
            
            required_fields = {'scan_time', 'sku', 'shelf_code', 'scanner_id'}
            for event in events:
                if not required_fields.issubset(event.keys()):
                    missing = required_fields - set(event.keys())
                    raise ValueError(f"scan_events.jsonl缺少必要字段: {missing}")
            
            return events
        except FileNotFoundError:
            raise FileNotFoundError(f"scan_events.jsonl文件不存在: {filepath}")
        except json.JSONDecodeError:
            raise ValueError("scan_events.jsonl格式错误，不是有效的JSON")
        except Exception as e:
            raise ValueError(f"scan_events.jsonl验证失败: {str(e)}")

    @staticmethod
    def validate_shelf_map_yaml(filepath: str) -> Optional[Dict[str, Any]]:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                shelf_map = yaml.safe_load(f)
            
            if not isinstance(shelf_map, dict):
                raise ValueError("shelf_map.yaml格式错误，应为字典")
            
            return shelf_map
        except FileNotFoundError:
            raise FileNotFoundError(f"shelf_map.yaml文件不存在: {filepath}")
        except yaml.YAMLError:
            raise ValueError("shelf_map.yaml格式错误，不是有效的YAML")
        except Exception as e:
            raise ValueError(f"shelf_map.yaml验证失败: {str(e)}")

    @staticmethod
    def validate_all(orders_path: str, events_path: str, shelf_path: str) -> Dict[str, Any]:
        orders = ImportValidator.validate_orders_csv(orders_path)
        events = ImportValidator.validate_scan_events_jsonl(events_path)
        shelf_map = ImportValidator.validate_shelf_map_yaml(shelf_path)
        
        return {
            'orders': orders,
            'scan_events': events,
            'shelf_map': shelf_map
        }