import os
import json
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from models import (
    KilnRun, TemperatureLog, BodyThickness, GlazeRecipe,
    KilnPosition, DefectRecord, ReviewConclusion
)


class DataStore:
    """数据存储管理器"""
    
    def __init__(self, storage_dir: str = './kiln_data'):
        """
        初始化数据存储
        
        Args:
            storage_dir: 存储目录路径
        """
        self.storage_dir = storage_dir
        self._ensure_storage_dir()
    
    def _ensure_storage_dir(self):
        """确保存储目录存在"""
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir)
        
        kiln_runs_dir = os.path.join(self.storage_dir, 'kiln_runs')
        if not os.path.exists(kiln_runs_dir):
            os.makedirs(kiln_runs_dir)
        
        analysis_dir = os.path.join(self.storage_dir, 'analysis_results')
        if not os.path.exists(analysis_dir):
            os.makedirs(analysis_dir)
    
    def save_kiln_run(self, kiln_run: KilnRun) -> str:
        """
        保存窑次记录
        
        Args:
            kiln_run: 窑次记录
        
        Returns:
            窑次ID
        """
        kiln_run_file = os.path.join(self.storage_dir, 'kiln_runs', f'{kiln_run.id}.json')
        
        with open(kiln_run_file, 'w', encoding='utf-8') as f:
            json.dump(kiln_run.to_dict(), f, ensure_ascii=False, indent=2, default=self._datetime_serializer)
        
        return kiln_run.id
    
    def load_kiln_run(self, kiln_run_id: str) -> Optional[KilnRun]:
        """
        加载窑次记录
        
        Args:
            kiln_run_id: 窑次ID
        
        Returns:
            窑次记录或None
        """
        kiln_run_file = os.path.join(self.storage_dir, 'kiln_runs', f'{kiln_run_id}.json')
        
        if not os.path.exists(kiln_run_file):
            return None
        
        with open(kiln_run_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._dict_to_kiln_run(data)
    
    def list_kiln_runs(self) -> List[Dict[str, Any]]:
        """
        列出所有窑次
        
        Returns:
            窑次列表（包含基本信息）
        """
        kiln_runs_dir = os.path.join(self.storage_dir, 'kiln_runs')
        
        if not os.path.exists(kiln_runs_dir):
            return []
        
        kiln_runs = []
        
        for filename in os.listdir(kiln_runs_dir):
            if filename.endswith('.json'):
                file_path = os.path.join(kiln_runs_dir, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    kiln_runs.append({
                        'id': data.get('id'),
                        'name': data.get('name'),
                        'start_date': data.get('start_date'),
                        'end_date': data.get('end_date'),
                        'position_count': len(data.get('kiln_positions', [])),
                        'defect_count': len(data.get('defect_records', [])),
                        'review_count': len(data.get('review_conclusions', []))
                    })
                except Exception as e:
                    print(f"Error loading {filename}: {e}")
        
        return sorted(kiln_runs, key=lambda x: x.get('start_date', ''), reverse=True)
    
    def delete_kiln_run(self, kiln_run_id: str) -> bool:
        """
        删除窑次记录
        
        Args:
            kiln_run_id: 窑次ID
        
        Returns:
            是否成功删除
        """
        kiln_run_file = os.path.join(self.storage_dir, 'kiln_runs', f'{kiln_run_id}.json')
        
        if os.path.exists(kiln_run_file):
            os.remove(kiln_run_file)
            return True
        
        return False
    
    def save_analysis_result(self, kiln_run_id: str, analysis_data: Dict[str, Any]) -> str:
        """
        保存分析结果
        
        Args:
            kiln_run_id: 窑次ID
            analysis_data: 分析数据
        
        Returns:
            保存的文件路径
        """
        analysis_file = os.path.join(self.storage_dir, 'analysis_results', f'{kiln_run_id}.json')
        
        with open(analysis_file, 'w', encoding='utf-8') as f:
            json.dump(analysis_data, f, ensure_ascii=False, indent=2, default=self._datetime_serializer)
        
        return analysis_file
    
    def load_analysis_result(self, kiln_run_id: str) -> Optional[Dict[str, Any]]:
        """
        加载分析结果
        
        Args:
            kiln_run_id: 窑次ID
        
        Returns:
            分析数据或None
        """
        analysis_file = os.path.join(self.storage_dir, 'analysis_results', f'{kiln_run_id}.json')
        
        if not os.path.exists(analysis_file):
            return None
        
        with open(analysis_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _dict_to_kiln_run(self, data: Dict[str, Any]) -> KilnRun:
        """
        将字典转换为KilnRun对象
        
        Args:
            data: 字典数据
        
        Returns:
            KilnRun对象
        """
        start_date = None
        if data.get('start_date'):
            start_date = datetime.fromisoformat(data['start_date'])
        
        end_date = None
        if data.get('end_date'):
            end_date = datetime.fromisoformat(data['end_date'])
        
        temperature_logs = []
        for log_data in data.get('temperature_logs', []):
            temperature_logs.append(TemperatureLog(
                id=log_data.get('id', str(uuid.uuid4())),
                time=log_data.get('time', 0),
                temperature=log_data.get('temperature', 0),
                zone=log_data.get('zone')
            ))
        
        body_thicknesses = []
        for bt_data in data.get('body_thicknesses', []):
            body_thicknesses.append(BodyThickness(
                id=bt_data.get('id', str(uuid.uuid4())),
                position_id=bt_data.get('position_id', ''),
                thickness=bt_data.get('thickness', 0),
                material=bt_data.get('material')
            ))
        
        glaze_recipes = []
        for gr_data in data.get('glaze_recipes', []):
            glaze_recipes.append(GlazeRecipe(
                id=gr_data.get('id', str(uuid.uuid4())),
                name=gr_data.get('name', ''),
                components=gr_data.get('components', {}),
                melting_temperature=gr_data.get('melting_temperature'),
                notes=gr_data.get('notes')
            ))
        
        kiln_positions = []
        for kp_data in data.get('kiln_positions', []):
            kiln_positions.append(KilnPosition(
                id=kp_data.get('id', str(uuid.uuid4())),
                code=kp_data.get('code', ''),
                row=kp_data.get('row', 0),
                column=kp_data.get('column', 0),
                shelf=kp_data.get('shelf'),
                glaze_recipe_id=kp_data.get('glaze_recipe_id'),
                body_thickness_id=kp_data.get('body_thickness_id'),
                notes=kp_data.get('notes')
            ))
        
        defect_records = []
        for dr_data in data.get('defect_records', []):
            defect_records.append(DefectRecord(
                id=dr_data.get('id', str(uuid.uuid4())),
                kiln_run_id=dr_data.get('kiln_run_id', ''),
                position_id=dr_data.get('position_id', ''),
                defect_type=dr_data.get('defect_type', ''),
                severity=dr_data.get('severity', '轻微'),
                description=dr_data.get('description'),
                photos=dr_data.get('photos')
            ))
        
        review_conclusions = []
        for rc_data in data.get('review_conclusions', []):
            review_date = None
            if rc_data.get('review_date'):
                review_date = datetime.fromisoformat(rc_data['review_date'])
            
            review_conclusions.append(ReviewConclusion(
                id=rc_data.get('id', str(uuid.uuid4())),
                kiln_run_id=rc_data.get('kiln_run_id', ''),
                position_id=rc_data.get('position_id', ''),
                reviewer=rc_data.get('reviewer', ''),
                review_date=review_date,
                conclusion=rc_data.get('conclusion', ''),
                root_cause=rc_data.get('root_cause'),
                corrective_action=rc_data.get('corrective_action'),
                notes=rc_data.get('notes')
            ))
        
        return KilnRun(
            id=data.get('id', str(uuid.uuid4())),
            name=data.get('name', ''),
            start_date=start_date,
            end_date=end_date,
            temperature_logs=temperature_logs,
            body_thicknesses=body_thicknesses,
            glaze_recipes=glaze_recipes,
            kiln_positions=kiln_positions,
            defect_records=defect_records,
            review_conclusions=review_conclusions,
            target_curve=data.get('target_curve'),
            notes=data.get('notes')
        )
    
    @staticmethod
    def _datetime_serializer(obj):
        """日期时间序列化器"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f'Object of type {obj.__class__.__name__} is not JSON serializable')
