import yaml
from datetime import datetime
from typing import List, Dict, Any, Optional


def parse_datetime_yaml(time_str: str) -> datetime:
    """解析YAML中的时间字符串"""
    if not time_str:
        return None
    
    time_str = str(time_str).strip()
    
    for fmt in [
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d %H:%M:%S',
    ]:
        try:
            return datetime.strptime(time_str, fmt)
        except ValueError:
            continue
    
    return None


def parse_settings_yaml(file_path: str) -> Dict[str, Any]:
    """
    解析保护定值YAML文件
    
    YAML格式示例:
    version: "2024-01-01"
    effective_date: "2024-01-01"
    devices:
      - name: "1#牵引变过流保护"
        type: "过流保护"
        settings:
          - name: "过流I段定值"
            value: 5.0
            unit: "A"
            effective_date: "2024-01-01"
          - name: "过流I段时限"
            value: 0.1
            unit: "s"
          - name: "接地保护定值"
            value: 2.0
            unit: "A"
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    settings_data = {
        'version': data.get('version', 'unknown'),
        'effective_date': parse_datetime_yaml(data.get('effective_date')),
        'devices': [],
    }
    
    devices = data.get('devices', [])
    for device in devices:
        device_info = {
            'name': device.get('name', device.get('device_name', '')).strip(),
            'type': device.get('type', device.get('device_type', '')).strip(),
            'settings': [],
            'settings_by_name': {},
        }
        
        settings = device.get('settings', [])
        for setting in settings:
            setting_info = {
                'name': setting.get('name', '').strip(),
                'value': setting.get('value', 0.0),
                'unit': setting.get('unit', '').strip(),
                'effective_date': parse_datetime_yaml(setting.get('effective_date')),
                'expiry_date': parse_datetime_yaml(setting.get('expiry_date')),
            }
            
            device_info['settings'].append(setting_info)
            device_info['settings_by_name'][setting_info['name']] = setting_info
            
            alt_names = generate_alternative_names(setting_info['name'])
            for alt_name in alt_names:
                if alt_name not in device_info['settings_by_name']:
                    device_info['settings_by_name'][alt_name] = setting_info
        
        settings_data['devices'].append(device_info)
    
    settings_data['devices_by_name'] = {d['name']: d for d in settings_data['devices']}
    
    return settings_data


def generate_alternative_names(name: str) -> List[str]:
    """生成定值名称的变体，用于匹配"""
    variants = []
    
    name_lower = name.lower()
    
    variants.append(name_lower)
    
    variants.append(name_lower.replace('保护', ''))
    
    replacements = {
        'i段': ['1段', '一段'],
        'ii段': ['2段', '二段'],
        'iii段': ['3段', '三段'],
        '过流': ['oc', '过电流'],
        '接地': ['ground', 'earth', '零序'],
        '定值': ['整定值', '设定值'],
        '时限': ['时间', '延时'],
    }
    
    for key, values in replacements.items():
        for value in values:
            if key in name_lower:
                variants.append(name_lower.replace(key, value))
            if value in name_lower:
                variants.append(name_lower.replace(value, key))
    
    additional_variants = []
    for variant in variants:
        if '保护' in variant:
            additional_variants.append(variant.replace('保护', ''))
    
    variants.extend(additional_variants)
    
    return list(set(variants))


def parse_inventory_yaml(file_path: str) -> Dict[str, Any]:
    """
    解析设备台账YAML文件
    
    YAML格式示例:
    inventory:
      - id: "TR-001"
        name: "1#牵引变压器"
        type: "牵引变压器"
        location: "牵引变电所A"
        voltage: "27.5kV"
        protection_devices:
          - "1#牵引变过流保护"
          - "1#牵引变接地保护"
        related_buses:
          - "27.5kV I段母线"
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    inventory_data = {
        'devices': [],
        'devices_by_id': {},
        'devices_by_name': {},
    }
    
    devices = data.get('inventory', data.get('devices', []))
    for device in devices:
        device_info = {
            'id': device.get('id', device.get('device_id', '')).strip(),
            'name': device.get('name', device.get('device_name', '')).strip(),
            'type': device.get('type', device.get('device_type', '')).strip(),
            'location': device.get('location', '').strip(),
            'voltage': device.get('voltage', '').strip(),
            'protection_devices': device.get('protection_devices', []),
            'related_buses': device.get('related_buses', []),
            'parent_devices': device.get('parent_devices', []),
            'child_devices': device.get('child_devices', []),
            'raw_data': dict(device),
        }
        
        inventory_data['devices'].append(device_info)
        
        if device_info['id']:
            inventory_data['devices_by_id'][device_info['id']] = device_info
        
        if device_info['name']:
            inventory_data['devices_by_name'][device_info['name']] = device_info
    
    return inventory_data


def find_setting_for_protection_action(settings_data: Dict[str, Any], 
                                         action: Dict[str, Any],
                                         event_time: datetime = None) -> Optional[Dict[str, Any]]:
    """
    根据保护动作查找对应的定值
    处理定值版本生效日跨越的情况
    """
    device_name = action.get('device_name', '')
    protection_type = action.get('protection_type', '')
    
    devices_by_name = settings_data.get('devices_by_name', {})
    device = devices_by_name.get(device_name)
    
    if not device:
        for dev_name, dev_info in devices_by_name.items():
            if device_name in dev_name or dev_name in device_name:
                device = dev_info
                break
    
    if not device:
        return None
    
    settings_by_name = device.get('settings_by_name', {})
    
    search_names = [
        protection_type,
        f"{protection_type}定值",
        f"{protection_type}动作值",
    ]
    
    for search_name in search_names:
        for alt_name in generate_alternative_names(search_name):
            if alt_name in settings_by_name:
                setting = settings_by_name[alt_name]
                
                if event_time and setting.get('effective_date'):
                    if setting['effective_date'] > event_time:
                        continue
                
                if event_time and setting.get('expiry_date'):
                    if setting['expiry_date'] < event_time:
                        continue
                
                return setting
    
    for setting in device.get('settings', []):
        setting_name = setting.get('name', '').lower()
        prot_type_lower = protection_type.lower()
        
        if any(word in setting_name for word in prot_type_lower.split()):
            if event_time and setting.get('effective_date'):
                if setting['effective_date'] > event_time:
                    continue
            
            if event_time and setting.get('expiry_date'):
                if setting['expiry_date'] < event_time:
                    continue
            
            return setting
    
    return None
