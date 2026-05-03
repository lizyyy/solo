"""状态存储模块 - 数据持久化和文件管理"""

import json
import csv
import shutil
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, TypeVar, Type
from pydantic import BaseModel

from .config import ProjectConfig, CropConfig, SubstrateConfig, ThresholdConfig, BedConfig
from .csv_parser import DailyRecord, ValidationError
from .calculator import DailySaltBalance, SaltTrend, FlushingRequirement, RiskLevel


T = TypeVar('T')


class EnhancedJSONEncoder(json.JSONEncoder):
    """增强的JSON编码器 - 支持日期和数据类"""
    
    def default(self, obj: Any) -> Any:
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        elif isinstance(obj, RiskLevel):
            return obj.value
        elif is_dataclass(obj):
            return asdict(obj)
        elif isinstance(obj, BaseModel):
            return obj.model_dump()
        return super().default(obj)


class StorageManager:
    """存储管理器 - 管理项目数据的持久化"""
    
    # 目录结构常量
    CONFIG_DIR = "config"
    DATA_DIR = "data"
    REPORTS_DIR = "reports"
    AUDIT_DIR = "audit"
    TEMP_DIR = "temp"
    
    # 文件名常量
    CONFIG_FILE = "project_config.json"
    RECORDS_FILE = "daily_records.json"
    CALCULATIONS_FILE = "salt_balances.json"
    
    def __init__(self, project_path: str):
        """
        初始化存储管理器
        
        Args:
            project_path: 项目根目录路径
        """
        self.project_path = Path(project_path)
        self._ensure_directory_structure()
    
    def _ensure_directory_structure(self):
        """确保目录结构存在"""
        directories = [
            self.project_path,
            self.project_path / self.CONFIG_DIR,
            self.project_path / self.DATA_DIR,
            self.project_path / self.REPORTS_DIR,
            self.project_path / self.AUDIT_DIR,
            self.project_path / self.TEMP_DIR
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
    
    def is_initialized(self) -> bool:
        """检查项目是否已初始化"""
        config_file = self.project_path / self.CONFIG_DIR / self.CONFIG_FILE
        return config_file.exists()
    
    # ==================== 配置存储 ====================
    
    def save_config(self, config: ProjectConfig) -> Path:
        """
        保存项目配置
        
        Args:
            config: ProjectConfig 实例
            
        Returns:
            配置文件路径
        """
        config_file = self.project_path / self.CONFIG_DIR / self.CONFIG_FILE
        
        # 使用pydantic的model_dump_json
        json_data = config.model_dump_json(indent=2, by_alias=True)
        
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(json_data)
        
        return config_file
    
    def load_config(self) -> ProjectConfig:
        """
        加载项目配置
        
        Returns:
            ProjectConfig 实例
        """
        config_file = self.project_path / self.CONFIG_DIR / self.CONFIG_FILE
        
        if not config_file.exists():
            raise FileNotFoundError(f"配置文件不存在: {config_file}")
        
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return ProjectConfig(**data)
    
    # ==================== 记录存储 ====================
    
    def save_records(self, records: List[DailyRecord]) -> Path:
        """
        保存每日记录
        
        Args:
            records: DailyRecord 实例列表
            
        Returns:
            记录文件路径
        """
        records_file = self.project_path / self.DATA_DIR / self.RECORDS_FILE
        
        # 转换为可序列化格式
        serializable = []
        for record in records:
            serializable.append({
                'record_date': record.record_date.isoformat(),
                'bed_id': record.bed_id,
                'irrigation_volume': record.irrigation_volume,
                'irrigation_ec': record.irrigation_ec,
                'drainage_volume': record.drainage_volume,
                'drainage_ec': record.drainage_ec,
                'substrate_water_content': record.substrate_water_content,
                'ec_unit_original': record.ec_unit_original,
                'notes': record.notes
            })
        
        # 如果文件已存在，合并数据
        if records_file.exists():
            with open(records_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            # 去重（按日期和畦号）
            existing_keys = set((r['record_date'], r['bed_id']) for r in existing)
            for record in serializable:
                key = (record['record_date'], record['bed_id'])
                if key not in existing_keys:
                    existing.append(record)
                    existing_keys.add(key)
            serializable = existing
        
        # 按日期排序
        serializable.sort(key=lambda x: (x['record_date'], x['bed_id']))
        
        with open(records_file, 'w', encoding='utf-8') as f:
            json.dump(serializable, f, indent=2, ensure_ascii=False)
        
        return records_file
    
    def load_records(self) -> List[DailyRecord]:
        """
        加载所有每日记录
        
        Returns:
            DailyRecord 实例列表
        """
        records_file = self.project_path / self.DATA_DIR / self.RECORDS_FILE
        
        if not records_file.exists():
            return []
        
        with open(records_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        records = []
        for item in data:
            record = DailyRecord(
                record_date=date.fromisoformat(item['record_date']),
                bed_id=item['bed_id'],
                irrigation_volume=item['irrigation_volume'],
                irrigation_ec=item['irrigation_ec'],
                drainage_volume=item['drainage_volume'],
                drainage_ec=item['drainage_ec'],
                substrate_water_content=item['substrate_water_content'],
                ec_unit_original=item.get('ec_unit_original'),
                notes=item.get('notes')
            )
            records.append(record)
        
        return records
    
    def get_existing_bed_dates(self) -> Dict[str, List[date]]:
        """
        获取已存在的畦号和日期映射
        
        Returns:
            字典: {畦号: [日期列表]}
        """
        records = self.load_records()
        result: Dict[str, List[date]] = {}
        
        for record in records:
            if record.bed_id not in result:
                result[record.bed_id] = []
            result[record.bed_id].append(record.record_date)
        
        return result
    
    # ==================== 计算结果存储 ====================
    
    def save_calculations(self, balances: List[DailySaltBalance]) -> Path:
        """
        保存盐平衡计算结果
        
        Args:
            balances: DailySaltBalance 实例列表
            
        Returns:
            计算结果文件路径
        """
        calc_file = self.project_path / self.DATA_DIR / self.CALCULATIONS_FILE
        
        # 转换为可序列化格式
        serializable = []
        for balance in balances:
            serializable.append({
                'record_date': balance.record_date.isoformat(),
                'bed_id': balance.bed_id,
                'input_salt_mass': balance.input_salt_mass,
                'input_irrigation_volume': balance.input_irrigation_volume,
                'input_irrigation_ec': balance.input_irrigation_ec,
                'output_salt_mass': balance.output_salt_mass,
                'output_drainage_volume': balance.output_drainage_volume,
                'output_drainage_ec': balance.output_drainage_ec,
                'net_salt_change': balance.net_salt_change,
                'drainage_ratio': balance.drainage_ratio,
                'substrate_water_content': balance.substrate_water_content,
                'estimated_root_ec': balance.estimated_root_ec,
                'cumulative_salt_change': balance.cumulative_salt_change,
                'days_since_last_flush': balance.days_since_last_flush
            })
        
        # 按日期和畦号排序
        serializable.sort(key=lambda x: (x['record_date'], x['bed_id']))
        
        with open(calc_file, 'w', encoding='utf-8') as f:
            json.dump(serializable, f, indent=2, ensure_ascii=False)
        
        return calc_file
    
    def load_calculations(self) -> List[DailySaltBalance]:
        """
        加载盐平衡计算结果
        
        Returns:
            DailySaltBalance 实例列表
        """
        calc_file = self.project_path / self.DATA_DIR / self.CALCULATIONS_FILE
        
        if not calc_file.exists():
            return []
        
        with open(calc_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        balances = []
        for item in data:
            balance = DailySaltBalance(
                record_date=date.fromisoformat(item['record_date']),
                bed_id=item['bed_id'],
                input_salt_mass=item['input_salt_mass'],
                input_irrigation_volume=item['input_irrigation_volume'],
                input_irrigation_ec=item['input_irrigation_ec'],
                output_salt_mass=item['output_salt_mass'],
                output_drainage_volume=item['output_drainage_volume'],
                output_drainage_ec=item['output_drainage_ec'],
                net_salt_change=item['net_salt_change'],
                drainage_ratio=item['drainage_ratio'],
                substrate_water_content=item['substrate_water_content'],
                estimated_root_ec=item['estimated_root_ec'],
                cumulative_salt_change=item.get('cumulative_salt_change', 0.0),
                days_since_last_flush=item.get('days_since_last_flush', 0)
            )
            balances.append(balance)
        
        return balances
    
    # ==================== 报告存储 ====================
    
    def save_report_file(self, content: str, filename: str, subdir: str = "") -> Path:
        """
        保存报告文件
        
        Args:
            content: 文件内容
            filename: 文件名
            subdir: 子目录（可选）
            
        Returns:
            文件路径
        """
        if subdir:
            report_dir = self.project_path / self.REPORTS_DIR / subdir
            report_dir.mkdir(parents=True, exist_ok=True)
        else:
            report_dir = self.project_path / self.REPORTS_DIR
        
        file_path = report_dir / filename
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return file_path
    
    def save_csv_report(self, rows: List[List[Any]], filename: str, headers: List[str] = None) -> Path:
        """
        保存CSV报告
        
        Args:
            rows: 数据行
            filename: 文件名
            headers: 表头（可选）
            
        Returns:
            文件路径
        """
        file_path = self.project_path / self.REPORTS_DIR / filename
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            if headers:
                writer.writerow(headers)
            writer.writerows(rows)
        
        return file_path
    
    # ==================== 审计包存储 ====================
    
    def create_audit_package(self, 
                              timestamp: datetime = None,
                              extra_data: Dict[str, Any] = None) -> Path:
        """
        创建审计包（包含配置、记录、计算结果的JSON归档）
        
        Args:
            timestamp: 时间戳（默认当前时间）
            extra_data: 额外数据（如趋势分析、冲洗建议）
            
        Returns:
            审计包文件路径
        """
        if timestamp is None:
            timestamp = datetime.now()
        
        timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
        audit_filename = f"audit_{timestamp_str}.json"
        audit_file = self.project_path / self.AUDIT_DIR / audit_filename
        
        # 收集数据
        audit_data = {
            'audit_info': {
                'timestamp': timestamp.isoformat(),
                'version': '0.1.0'
            },
            'config': None,
            'records': [],
            'calculations': [],
            'extra': extra_data or {}
        }
        
        # 加载配置
        try:
            config = self.load_config()
            audit_data['config'] = config.model_dump()
        except Exception:
            pass
        
        # 加载记录
        try:
            records = self.load_records()
            audit_data['records'] = [
                {
                    'record_date': r.record_date.isoformat(),
                    'bed_id': r.bed_id,
                    'irrigation_volume': r.irrigation_volume,
                    'irrigation_ec': r.irrigation_ec,
                    'drainage_volume': r.drainage_volume,
                    'drainage_ec': r.drainage_ec,
                    'substrate_water_content': r.substrate_water_content
                }
                for r in records
            ]
        except Exception:
            pass
        
        # 加载计算结果
        try:
            calculations = self.load_calculations()
            audit_data['calculations'] = [
                {
                    'record_date': c.record_date.isoformat(),
                    'bed_id': c.bed_id,
                    'estimated_root_ec': c.estimated_root_ec,
                    'net_salt_change': c.net_salt_change,
                    'cumulative_salt_change': c.cumulative_salt_change
                }
                for c in calculations
            ]
        except Exception:
            pass
        
        # 保存审计包
        with open(audit_file, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, indent=2, ensure_ascii=False, cls=EnhancedJSONEncoder)
        
        return audit_file
    
    # ==================== 临时文件管理 ====================
    
    def save_temp_file(self, content: str, filename: str) -> Path:
        """保存临时文件"""
        temp_path = self.project_path / self.TEMP_DIR / filename
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return temp_path
    
    def clear_temp_files(self):
        """清理临时文件"""
        temp_dir = self.project_path / self.TEMP_DIR
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
            temp_dir.mkdir(parents=True, exist_ok=True)
    
    # ==================== 项目信息 ====================
    
    def get_project_info(self) -> Dict[str, Any]:
        """获取项目概要信息"""
        info = {
            'initialized': self.is_initialized(),
            'project_path': str(self.project_path),
            'record_count': 0,
            'bed_count': 0,
            'date_range': None
        }
        
        if self.is_initialized():
            try:
                records = self.load_records()
                info['record_count'] = len(records)
                
                if records:
                    bed_ids = set(r.bed_id for r in records)
                    info['bed_count'] = len(bed_ids)
                    
                    dates = [r.record_date for r in records]
                    info['date_range'] = {
                        'start': min(dates).isoformat(),
                        'end': max(dates).isoformat()
                    }
            except Exception:
                pass
        
        return info
