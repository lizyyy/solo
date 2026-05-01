import csv
import yaml
import json
from typing import Dict, List, Tuple, Any


class DataParser:
    """数据解析器"""
    
    @staticmethod
    def parse_nodes_csv(file_path: str) -> Dict[str, Dict]:
        """解析节点CSV文件"""
        nodes = {}
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                node_id = row['node_id']
                nodes[node_id] = {
                    'id': node_id,
                    'x': float(row['x']),
                    'y': float(row['y']),
                    'type': row.get('type', 'normal'),
                    'pressure': float(row.get('pressure', 0))
                }
        return nodes
    
    @staticmethod
    def parse_pipes_csv(file_path: str) -> List[Dict]:
        """解析管段CSV文件"""
        pipes = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                pipes.append({
                    'id': row['pipe_id'],
                    'from_node': row['from_node'],
                    'to_node': row['to_node'],
                    'diameter': float(row.get('diameter', 0)),
                    'length': float(row.get('length', 0)),
                    'material': row.get('material', ''),
                    'island': row.get('island', 'false').lower() == 'true'
                })
        return pipes
    
    @staticmethod
    def parse_valves_yaml(file_path: str) -> Dict[str, Dict]:
        """解析阀门状态YAML文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        valves = {}
        for valve_id, valve_info in data.get('valves', {}).items():
            valves[valve_id] = {
                'id': valve_id,
                'node': valve_info.get('node'),
                'pipe': valve_info.get('pipe'),
                'status': valve_info.get('status', 'unknown'),
                'position': valve_info.get('position', {}),
                'type': valve_info.get('type', 'gate')
            }
        return valves
    
    @staticmethod
    def parse_repair_json(file_path: str) -> Dict:
        """解析抢修点JSON文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def parse_customers_csv(file_path: str) -> Dict[str, Dict]:
        """解析重点用户清单CSV文件"""
        customers = {}
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                customer_id = row['customer_id']
                customers[customer_id] = {
                    'id': customer_id,
                    'name': row['name'],
                    'node': row['node'],
                    'priority': int(row.get('priority', 3)),
                    'type': row.get('type', 'residential'),
                    'contact': row.get('contact', '')
                }
        return customers
