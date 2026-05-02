import csv
import json
import os
from typing import Dict, List, Any, Optional
import yaml


class ValidationError(Exception):
    pass


def parse_chemicals(file_path: str) -> Dict[str, Dict[str, Any]]:
    """
    解析化学品信息CSV文件
    格式: chemical_id, name, dangerous_categories, volume, unit
    """
    if not os.path.exists(file_path):
        raise ValidationError(f"化学品文件不存在: {file_path}")
    
    chemicals = {}
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            chemical_id = row['chemical_id'].strip()
            if chemical_id in chemicals:
                raise ValidationError(f"重复的化学品ID: {chemical_id}")
            
            # 解析危险类别，支持逗号分隔
            dangerous_categories = [
                cat.strip() 
                for cat in row.get('dangerous_categories', '').split(',') 
                if cat.strip()
            ]
            
            # 解析体积
            try:
                volume = float(row['volume'])
            except ValueError:
                raise ValidationError(f"化学品 {chemical_id} 的体积格式无效: {row['volume']}")
            
            chemicals[chemical_id] = {
                'name': row['name'].strip(),
                'dangerous_categories': dangerous_categories,
                'volume': volume,
                'unit': row.get('unit', 'L').strip()
            }
    
    return chemicals


def parse_storage(file_path: str) -> Dict[str, Dict[str, Any]]:
    """
    解析库位信息YAML文件
    格式:
    locations:
      - id: A-01
        name: 酸类存储区
        capacity: 100
        unit: L
        allowed_categories:
          - 酸类
          - 腐蚀性物质
        current_chemicals:
          - chemical_id: CHEM-001
            volume: 20
    """
    if not os.path.exists(file_path):
        raise ValidationError(f"库位文件不存在: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise ValidationError(f"库位文件YAML格式错误: {e}")
    
    if 'locations' not in data:
        raise ValidationError("库位文件缺少 'locations' 字段")
    
    storage = {}
    for loc in data['locations']:
        loc_id = loc['id'].strip()
        if loc_id in storage:
            raise ValidationError(f"重复的库位ID: {loc_id}")
        
        # 计算当前已使用容量
        current_usage = 0
        current_chemicals = []
        for chem in loc.get('current_chemicals', []):
            try:
                vol = float(chem['volume'])
                current_usage += vol
                current_chemicals.append({
                    'chemical_id': chem['chemical_id'].strip(),
                    'volume': vol
                })
            except (KeyError, ValueError) as e:
                raise ValidationError(f"库位 {loc_id} 中的化学品信息无效: {e}")
        
        storage[loc_id] = {
            'name': loc.get('name', '').strip(),
            'capacity': float(loc['capacity']),
            'unit': loc.get('unit', 'L').strip(),
            'allowed_categories': loc.get('allowed_categories', []),
            'forbidden_categories': loc.get('forbidden_categories', []),
            'current_usage': current_usage,
            'current_chemicals': current_chemicals,
            'remaining_capacity': float(loc['capacity']) - current_usage
        }
    
    return storage


def parse_compatibility(file_path: str) -> Dict[str, Dict[str, Any]]:
    """
    解析相容性规则JSON文件
    格式:
    {
      "normalization": {
        "强酸": ["酸类", "强酸性物质", "腐蚀性酸"],
        "强碱": ["碱类", "强碱性物质", "腐蚀性碱"]
      },
      "incompatible_pairs": [
        {"category1": "强酸", "category2": "强碱", "severity": "high"}
      ],
      "storage_rules": [
        {"category": "易燃液体", "requirements": ["通风", "防爆", "远离火源"]}
      ]
    }
    """
    if not os.path.exists(file_path):
        raise ValidationError(f"相容性文件不存在: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValidationError(f"相容性文件JSON格式错误: {e}")
    
    # 验证结构
    if 'normalization' not in data:
        data['normalization'] = {}
    if 'incompatible_pairs' not in data:
        data['incompatible_pairs'] = []
    if 'storage_rules' not in data:
        data['storage_rules'] = []
    
    # 转换为更易用的格式
    compatibility = {
        'normalization': data['normalization'],
        'incompatible_pairs': {},
        'storage_rules': {}
    }
    
    # 处理不相容对
    for pair in data['incompatible_pairs']:
        cat1 = pair['category1']
        cat2 = pair['category2']
        severity = pair.get('severity', 'high')
        
        # 双向存储
        if cat1 not in compatibility['incompatible_pairs']:
            compatibility['incompatible_pairs'][cat1] = {}
        compatibility['incompatible_pairs'][cat1][cat2] = severity
        
        if cat2 not in compatibility['incompatible_pairs']:
            compatibility['incompatible_pairs'][cat2] = {}
        compatibility['incompatible_pairs'][cat2][cat1] = severity
    
    # 处理存储规则
    for rule in data['storage_rules']:
        category = rule['category']
        compatibility['storage_rules'][category] = {
            'requirements': rule.get('requirements', []),
            'notes': rule.get('notes', '')
        }
    
    return compatibility


def parse_inbound(file_path: str) -> List[Dict[str, Any]]:
    """
    解析入库申请CSV文件
    格式: request_id, chemical_id, requested_location, volume
    """
    if not os.path.exists(file_path):
        raise ValidationError(f"入库申请文件不存在: {file_path}")
    
    inbound = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            request_id = row['request_id'].strip()
            chemical_id = row['chemical_id'].strip()
            requested_location = row.get('requested_location', '').strip()
            
            try:
                volume = float(row['volume'])
            except ValueError:
                raise ValidationError(f"入库申请 {request_id} 的体积格式无效: {row['volume']}")
            
            inbound.append({
                'request_id': request_id,
                'chemical_id': chemical_id,
                'requested_location': requested_location,
                'volume': volume,
                'status': 'pending'
            })
    
    return inbound


def validate_data_integrity(
    chemicals: Dict[str, Dict[str, Any]],
    storage: Dict[str, Dict[str, Any]],
    inbound: List[Dict[str, Any]]
) -> List[str]:
    """
    验证数据完整性，检查引用是否存在
    返回警告列表（非致命错误）
    """
    warnings = []
    
    # 检查入库申请中的化学品是否存在
    for request in inbound:
        chem_id = request['chemical_id']
        if chem_id not in chemicals:
            warnings.append(f"入库申请 {request['request_id']} 引用了不存在的化学品: {chem_id}")
    
    # 检查入库申请中的库位是否存在
    for request in inbound:
        loc_id = request['requested_location']
        if loc_id and loc_id not in storage:
            warnings.append(f"入库申请 {request['request_id']} 引用了不存在的库位: {loc_id}")
    
    # 检查当前库位中的化学品是否存在
    for loc_id, loc in storage.items():
        for chem in loc['current_chemicals']:
            chem_id = chem['chemical_id']
            if chem_id not in chemicals:
                warnings.append(f"库位 {loc_id} 中存储了不存在的化学品: {chem_id}")
    
    return warnings
