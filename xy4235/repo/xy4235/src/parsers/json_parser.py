import os
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

from .base_parser import BaseParser, ParseResult
from models.medication import Medication, MedicationRecord, MedicationRoute, MedicationType


class JSONParser(BaseParser):
    """
    JSON数据解析器
    支持解析给药记录JSON和人工备注
    """
    
    def __init__(self):
        super().__init__()
    
    def can_parse(self, file_path: str) -> bool:
        """
        检查是否能解析该文件
        """
        if not file_path.lower().endswith('.json'):
            return False
        
        if not os.path.exists(file_path):
            return False
        
        # 检查文件是否可读且是有效的JSON
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return True
        except:
            pass
        
        # 尝试其他编码
        try:
            with open(file_path, 'r', encoding='gbk') as f:
                data = json.load(f)
                return True
        except:
            return False
    
    def parse(self, file_path: str) -> ParseResult:
        """
        解析JSON文件
        """
        self.result = ParseResult()
        
        if not self.can_parse(file_path):
            self.result.add_error(f"无法解析文件: {file_path}")
            return self.result
        
        try:
            # 读取JSON数据
            data = self._read_json_with_encoding(file_path)
            
            if data is None:
                self.result.add_error("JSON文件为空或无法读取")
                return self.result
            
            # 检测数据类型并解析
            case_id = os.path.splitext(os.path.basename(file_path))[0]
            
            # 尝试解析为给药记录
            medication = self._parse_medication(data, case_id)
            
            if medication and medication.records:
                self.result.data = medication
                self.result.add_warning(f"成功解析 {len(medication.records)} 条给药记录")
            else:
                # 如果不是给药记录，可能是人工备注或其他数据
                self.result.add_warning("未检测到有效的给药记录格式")
                # 返回原始数据供上层处理
                self.result.data = data
            
        except Exception as e:
            self.result.add_error(f"解析JSON文件时出错: {str(e)}")
        
        return self.result
    
    def _read_json_with_encoding(self, file_path: str) -> Optional[Dict]:
        """
        尝试用多种编码读取JSON
        """
        encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030', 'latin1']
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    return json.load(f)
            except:
                pass
        
        return None
    
    def _parse_medication(self, data: Dict, case_id: str) -> Optional[Medication]:
        """
        解析给药记录
        支持多种JSON格式
        """
        medication = Medication(case_id=case_id)
        
        # 格式1: 直接是records数组
        if isinstance(data, list):
            for record_data in data:
                record = self._parse_medication_record(record_data)
                if record:
                    medication.add_record(record)
        
        # 格式2: 包含records字段
        elif isinstance(data, dict):
            # 检查是否有records字段
            if 'records' in data and isinstance(data['records'], list):
                for record_data in data['records']:
                    record = self._parse_medication_record(record_data)
                    if record:
                        medication.add_record(record)
            
            # 检查是否是单条记录格式
            elif self._looks_like_medication_record(data):
                record = self._parse_medication_record(data)
                if record:
                    medication.add_record(record)
            
            # 检查是否有medications字段
            elif 'medications' in data and isinstance(data['medications'], list):
                for record_data in data['medications']:
                    record = self._parse_medication_record(record_data)
                    if record:
                        medication.add_record(record)
            
            # 检查是否有drugs字段
            elif 'drugs' in data and isinstance(data['drugs'], list):
                for record_data in data['drugs']:
                    record = self._parse_medication_record(record_data)
                    if record:
                        medication.add_record(record)
        
        return medication
    
    def _looks_like_medication_record(self, data: Dict) -> bool:
        """
        检查数据是否看起来像一条给药记录
        """
        # 检查关键字段
        key_fields = ['medication_name', 'drug_name', 'name', '药物', '药品']
        for field in key_fields:
            if field in data:
                return True
        
        # 检查是否有时间和剂量
        if ('timestamp' in data or 'time' in data or '时间' in data) and \
           ('dose' in data or '剂量' in data or 'amount' in data):
            return True
        
        return False
    
    def _parse_medication_record(self, data: Dict) -> Optional[MedicationRecord]:
        """
        解析单条给药记录
        """
        try:
            # 解析时间戳
            timestamp = self._parse_timestamp(data)
            if timestamp is None:
                return None
            
            # 解析药物名称
            medication_name = self._get_field(data, [
                'medication_name', 'drug_name', 'name', '药物', '药品', 'drug', 'medication'
            ])
            if not medication_name:
                return None
            
            # 解析剂量
            dose = self._parse_numeric(self._get_field(data, [
                'dose', 'dosage', '剂量', '用量', 'amount'
            ]))
            if dose is None:
                return None
            
            # 解析单位
            unit = self._get_field(data, [
                'unit', '单位', 'uom'
            ], default='mg')
            
            # 解析给药途径
            route = self._parse_route(data)
            
            # 解析药物类型
            medication_type = self._parse_medication_type(data, medication_name)
            
            # 解析浓度
            concentration = self._get_field(data, [
                'concentration', '浓度'
            ])
            
            # 解析给药人员
            administered_by = self._get_field(data, [
                'administered_by', 'given_by', '给药人', '操作者'
            ])
            
            # 解析备注
            notes = self._get_field(data, [
                'notes', '备注', 'comments', 'description'
            ])
            
            return MedicationRecord(
                timestamp=timestamp,
                medication_name=medication_name,
                dose=dose,
                unit=unit,
                route=route,
                medication_type=medication_type,
                concentration=concentration,
                administered_by=administered_by,
                notes=notes
            )
            
        except Exception as e:
            self.result.add_warning(f"解析给药记录时出错: {str(e)}")
            return None
    
    def _get_field(self, data: Dict, possible_keys: List[str], default: Any = None) -> Any:
        """
        从多个可能的键中获取值
        """
        for key in possible_keys:
            if key in data and data[key] is not None:
                value = data[key]
                if isinstance(value, str):
                    value = value.strip()
                    if value:
                        return value
                else:
                    return value
        return default
    
    def _parse_timestamp(self, data: Dict) -> Optional[datetime]:
        """
        解析时间戳
        """
        time_value = self._get_field(data, [
            'timestamp', 'time', '日期时间', '时间', 'date_time', 'datetime', 'administered_time'
        ])
        
        if time_value is None:
            return None
        
        # 尝试各种时间格式
        time_formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%H:%M:%S",
            "%H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
        ]
        
        time_str = str(time_value).strip()
        
        for fmt in time_formats:
            try:
                dt = datetime.strptime(time_str, fmt)
                
                # 如果只有时间没有日期，使用今天的日期
                if '%Y' not in fmt and '%y' not in fmt:
                    today = datetime.now().date()
                    dt = datetime.combine(today, dt.time())
                
                return dt
            except:
                continue
        
        # 尝试解析ISO格式
        try:
            from dateutil import parser
            return parser.isoparse(time_str)
        except:
            pass
        
        return None
    
    def _parse_route(self, data: Dict) -> MedicationRoute:
        """
        解析给药途径
        """
        route_value = self._get_field(data, [
            'route', '途径', '给药途径', 'administration_route'
        ])
        
        if route_value is None:
            return MedicationRoute.OTHER
        
        route_str = str(route_value).strip().upper()
        
        # 映射常见的给药途径
        route_mapping = {
            'IV': MedicationRoute.IV,
            '静脉': MedicationRoute.IV,
            '静脉注射': MedicationRoute.IV,
            'IM': MedicationRoute.IM,
            '肌肉': MedicationRoute.IM,
            '肌肉注射': MedicationRoute.IM,
            'SC': MedicationRoute.SC,
            'SQ': MedicationRoute.SC,
            '皮下': MedicationRoute.SC,
            '皮下注射': MedicationRoute.SC,
            'INHALATION': MedicationRoute.INHALATION,
            '吸入': MedicationRoute.INHALATION,
            '雾化': MedicationRoute.INHALATION,
            'ORAL': MedicationRoute.ORAL,
            'PO': MedicationRoute.ORAL,
            '口服': MedicationRoute.ORAL,
        }
        
        # 尝试精确匹配
        if route_str in route_mapping:
            return route_mapping[route_str]
        
        # 尝试部分匹配
        for key, value in route_mapping.items():
            if key in route_str or route_str in key:
                return value
        
        return MedicationRoute.OTHER
    
    def _parse_medication_type(self, data: Dict, medication_name: str = "") -> MedicationType:
        """
        解析药物类型
        """
        # 首先尝试从数据中获取
        type_value = self._get_field(data, [
            'type', '类型', 'category', '分类', 'medication_type'
        ])
        
        if type_value:
            type_str = str(type_value).strip().upper()
            
            type_mapping = {
                'INDUCTION': MedicationType.INDUCTION,
                '诱导': MedicationType.INDUCTION,
                '诱导药': MedicationType.INDUCTION,
                'MAINTENANCE': MedicationType.MAINTENANCE,
                '维持': MedicationType.MAINTENANCE,
                '维持药': MedicationType.MAINTENANCE,
                'ANALGESIC': MedicationType.ANALGESIC,
                '镇痛': MedicationType.ANALGESIC,
                '镇痛药': MedicationType.ANALGESIC,
                'MUSCLE_RELAXANT': MedicationType.MUSCLE_RELAXANT,
                '肌松': MedicationType.MUSCLE_RELAXANT,
                '肌松药': MedicationType.MUSCLE_RELAXANT,
                'EMERGENCY': MedicationType.EMERGENCY,
                '急救': MedicationType.EMERGENCY,
                '急救药': MedicationType.EMERGENCY,
            }
            
            if type_str in type_mapping:
                return type_mapping[type_str]
            
            for key, value in type_mapping.items():
                if key in type_str:
                    return value
        
        # 根据药物名称推断
        if medication_name:
            name_lower = medication_name.lower()
            
            # 诱导药
            if any(drug in name_lower for drug in ['propofol', '异丙酚', '依托咪酯', 'etomidate', '硫喷妥钠', 'thiopental']):
                return MedicationType.INDUCTION
            
            # 维持药
            if any(drug in name_lower for drug in ['异氟烷', 'isoflurane', '七氟烷', 'sevoflurane', '地氟烷', 'desflurane']):
                return MedicationType.MAINTENANCE
            
            # 镇痛药
            if any(drug in name_lower for drug in ['芬太尼', 'fentanyl', '吗啡', 'morphine', '布托啡诺', 'butorphanol', '美沙酮', 'methadone']):
                return MedicationType.ANALGESIC
            
            # 肌松药
            if any(drug in name_lower for drug in ['阿曲库铵', 'atracurium', '维库溴铵', 'vecuronium', '罗库溴铵', 'rocuronium', '琥珀胆碱', 'succinylcholine']):
                return MedicationType.MUSCLE_RELAXANT
            
            # 急救药
            if any(drug in name_lower for drug in ['肾上腺素', 'epinephrine', '阿托品', 'atropine', '多巴胺', 'dopamine', '去甲肾上腺素', 'norepinephrine']):
                return MedicationType.EMERGENCY
        
        return MedicationType.OTHER
    
    def _parse_numeric(self, value) -> Optional[float]:
        """
        解析数值
        """
        if value is None:
            return None
        
        if isinstance(value, (int, float)):
            return float(value)
        
        try:
            str_value = str(value).strip()
            
            # 移除单位
            str_value = str_value.replace('mg', '').replace('ml', '').replace('mcg', '')
            str_value = str_value.replace('g', '').replace('kg', '').replace('μg', '')
            
            return float(str_value)
        except:
            return None
