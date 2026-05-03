"""
人工巡检解析器 - 解析人工巡检备注文件
"""

import json
import csv
from datetime import datetime
from typing import Dict, List, Optional


class InspectionParser:
    """解析人工巡检备注数据"""
    
    def __init__(self):
        self.data: Optional[List[Dict]] = None
        self.tray_inspections: Dict[str, List[Dict]] = {}
    
    def parse(self, file_path: str) -> List[Dict]:
        """
        解析人工巡检文件（支持JSON或CSV格式）
        
        Args:
            file_path: 巡检文件路径
            
        Returns:
            解析后的巡检数据列表
            
        Raises:
            ValueError: 如果文件格式不正确
        """
        if file_path.endswith('.json'):
            return self._parse_json(file_path)
        elif file_path.endswith('.csv'):
            return self._parse_csv(file_path)
        else:
            raise ValueError(f"不支持的巡检文件格式: {file_path}")
    
    def _parse_json(self, file_path: str) -> List[Dict]:
        """解析JSON格式的巡检数据"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
            
            if isinstance(raw_data, dict):
                if 'inspections' in raw_data:
                    raw_data = raw_data['inspections']
                else:
                    raw_data = [raw_data]
            
            self._validate_and_normalize(raw_data)
            self.data = raw_data
            self._build_tray_index()
            return self.data
        except json.JSONDecodeError as e:
            raise ValueError(f"巡检JSON解析错误: {str(e)}")
    
    def _parse_csv(self, file_path: str) -> List[Dict]:
        """解析CSV格式的巡检数据"""
        try:
            raw_data = []
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    raw_data.append(dict(row))
            
            self._validate_and_normalize(raw_data)
            self.data = raw_data
            self._build_tray_index()
            return self.data
        except Exception as e:
            raise ValueError(f"巡检CSV解析错误: {str(e)}")
    
    def _validate_and_normalize(self, data: List[Dict]):
        """验证并规范化数据"""
        for i, item in enumerate(data):
            if 'timestamp' not in item:
                raise ValueError(f"巡检记录第{i+1}项缺少timestamp字段")
            
            try:
                ts = str(item['timestamp'])
                if ' ' in ts:
                    dt = datetime.strptime(ts, '%Y-%m-%d %H:%M:%S')
                else:
                    dt = datetime.strptime(ts, '%Y-%m-%d')
                item['timestamp'] = dt.strftime('%Y-%m-%d %H:%M:%S')
                item['date'] = dt.strftime('%Y-%m-%d')
            except ValueError:
                raise ValueError(f"巡检记录第{i+1}项的timestamp格式不正确")
            
            item['tray_id'] = str(item.get('tray_id', '')).strip()
            item['inspector'] = str(item.get('inspector', '未指定')).strip()
            item['notes'] = str(item.get('notes', '')).strip()
            
            item['appearance'] = self._parse_appearance(item.get('appearance', ''))
            item['moisture_assessment'] = self._parse_moisture_assessment(item.get('moisture', ''))
            item['pest_disease'] = str(item.get('pest_disease', '否')).strip()
            item['action_taken'] = str(item.get('action_taken', '')).strip()
            
            item['rating'] = int(item.get('rating', 3)) if item.get('rating') else 3
            item['rating'] = max(1, min(5, item['rating']))
    
    def _parse_appearance(self, appearance_str: str) -> Dict:
        """解析外观描述"""
        appearance = {
            'color': '正常',
            'growth': '正常',
            'wilting': False,
            'yellowing': False
        }
        
        appearance_lower = appearance_str.lower()
        
        if '黄' in appearance_str or 'yellow' in appearance_lower:
            appearance['yellowing'] = True
            appearance['color'] = '发黄'
        if '萎' in appearance_str or '蔫' in appearance_str or 'wilt' in appearance_lower:
            appearance['wilting'] = True
        if '快' in appearance_str or '快长' in appearance_str:
            appearance['growth'] = '过快'
        if '慢' in appearance_str or '停滞' in appearance_str:
            appearance['growth'] = '过慢'
        
        return appearance
    
    def _parse_moisture_assessment(self, moisture_str: str) -> str:
        """解析湿度评估"""
        moisture_lower = moisture_str.lower()
        
        if '干' in moisture_str or '低' in moisture_str or 'dry' in moisture_lower or 'low' in moisture_lower:
            return '偏低'
        elif '湿' in moisture_str or '高' in moisture_str or 'wet' in moisture_lower or 'high' in moisture_lower:
            return '偏高'
        elif '过湿' in moisture_str or '积水' in moisture_str:
            return '过高'
        elif '合适' in moisture_str or '正常' in moisture_str:
            return '正常'
        else:
            return '未评估'
    
    def _build_tray_index(self):
        """构建按苗盘ID的索引"""
        self.tray_inspections = {}
        for inspection in self.data:
            tray_id = inspection.get('tray_id', '')
            if tray_id:
                if tray_id not in self.tray_inspections:
                    self.tray_inspections[tray_id] = []
                self.tray_inspections[tray_id].append(inspection)
        
        for tray_id in self.tray_inspections:
            self.tray_inspections[tray_id].sort(
                key=lambda x: x['timestamp'],
                reverse=True
            )
    
    def get_tray_inspections(self, tray_id: str) -> List[Dict]:
        """
        获取指定苗盘的所有巡检记录
        
        Args:
            tray_id: 苗盘ID
            
        Returns:
            巡检记录列表（按时间倒序排列）
        """
        return self.tray_inspections.get(tray_id, [])
    
    def get_latest_inspection(self, tray_id: str) -> Optional[Dict]:
        """
        获取指定苗盘的最新巡检记录
        
        Args:
            tray_id: 苗盘ID
            
        Returns:
            最新巡检记录，无记录则返回None
        """
        inspections = self.get_tray_inspections(tray_id)
        return inspections[0] if inspections else None
    
    def has_watering_issue_flag(self, tray_id: str) -> bool:
        """
        检查是否有浇水相关问题标记
        
        Args:
            tray_id: 苗盘ID
            
        Returns:
            是否存在浇水相关问题
        """
        latest = self.get_latest_inspection(tray_id)
        if not latest:
            return False
        
        moisture = latest.get('moisture_assessment', '')
        if moisture in ['偏低', '偏高', '过高']:
            return True
        
        appearance = latest.get('appearance', {})
        if appearance.get('wilting') or appearance.get('yellowing'):
            return True
        
        notes = latest.get('notes', '').lower()
        if '水' in notes or '浇' in notes or 'water' in notes:
            return True
        
        return False
    
    def get_summary(self) -> Dict:
        """获取数据摘要"""
        if not self.data:
            return {}
        
        inspected_trays = list(self.tray_inspections.keys())
        
        rating_dist = {}
        moisture_dist = {}
        for inspection in self.data:
            rating = inspection.get('rating', 3)
            rating_dist[rating] = rating_dist.get(rating, 0) + 1
            
            moisture = inspection.get('moisture_assessment', '未评估')
            moisture_dist[moisture] = moisture_dist.get(moisture, 0) + 1
        
        return {
            'total_inspections': len(self.data),
            'inspected_tray_count': len(inspected_trays),
            'inspected_trays': inspected_trays,
            'rating_distribution': rating_dist,
            'moisture_distribution': moisture_dist
        }
