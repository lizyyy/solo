from pathlib import Path
from datetime import datetime
import csv
from .models import (
    InspectionBatch, FileRecord, CleaningRecord, SensorReading,
    PhotoRecord, Rectification, Store
)
from .db import get_db

class Ingestor:
    """文件导入器"""
    
    def __init__(self, batch_name, inspection_month):
        self.batch_id = InspectionBatch.get_or_create(batch_name, inspection_month)
        self.batch_name = batch_name
        self.inspection_month = inspection_month
        self.stats = {
            'total_files': 0,
            'new_files': 0,
            'existing_files': 0,
            'records': {
                'cleaning': 0,
                'sensor': 0,
                'photo': 0,
                'rectification': 0
            }
        }
    
    def ingest_cleaning_records(self, file_path):
        """导入清洗记录 CSV 文件"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        file_record_id, is_new = FileRecord.create_from_file(
            self.batch_id, file_path, 'cleaning_csv'
        )
        
        self.stats['total_files'] += 1
        if is_new:
            self.stats['new_files'] += 1
        else:
            self.stats['existing_files'] += 1
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                store_code = row.get('门店编号', '').strip()
                if not store_code:
                    continue
                
                # 记录门店信息
                self._ensure_store(store_code, row.get('门店名称', ''))
                
                CleaningRecord.create(
                    batch_id=self.batch_id,
                    store_code=store_code,
                    cleaning_date=row.get('清洗日期', '').strip(),
                    cleaning_company=row.get('清洗公司', '').strip(),
                    technician_name=row.get(' technician_name', '').strip(),
                    next_cleaning_date=row.get('下次清洗日期', '').strip(),
                    file_record_id=file_record_id
                )
                self.stats['records']['cleaning'] += 1
        
        print(f"已导入清洗记录文件: {file_path.name}")
    
    def ingest_sensor_readings(self, file_path):
        """导入传感器读数 CSV 文件"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        file_record_id, is_new = FileRecord.create_from_file(
            self.batch_id, file_path, 'sensor_csv'
        )
        
        self.stats['total_files'] += 1
        if is_new:
            self.stats['new_files'] += 1
        else:
            self.stats['existing_files'] += 1
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                store_code = row.get('门店编号', '').strip()
                if not store_code:
                    continue
                
                # 记录门店信息
                self._ensure_store(store_code, row.get('门店名称', ''))
                
                # 尝试转换数值
                def to_float(val):
                    try:
                        return float(val.strip()) if val and val.strip() else None
                    except (ValueError, AttributeError):
                        return None
                
                SensorReading.create(
                    batch_id=self.batch_id,
                    store_code=store_code,
                    reading_date=row.get('读数日期', '').strip(),
                    reading_time=row.get('读数时间', '').strip(),
                    pm25=to_float(row.get('PM2.5')),
                    pm10=to_float(row.get('PM10')),
                    oil_concentration=to_float(row.get('油烟浓度')),
                    temperature=to_float(row.get('温度')),
                    humidity=to_float(row.get('湿度')),
                    file_record_id=file_record_id
                )
                self.stats['records']['sensor'] += 1
        
        print(f"已导入传感器读数文件: {file_path.name}")
    
    def ingest_photo_directory(self, directory_path):
        """导入照片目录"""
        dir_path = Path(directory_path)
        if not dir_path.exists() or not dir_path.is_dir():
            raise FileNotFoundError(f"目录不存在或不是目录: {directory_path}")
        
        # 支持的图片格式
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        
        for photo_path in dir_path.rglob('*'):
            if photo_path.suffix.lower() in image_extensions:
                self._ingest_single_photo(photo_path)
    
    def _ingest_single_photo(self, photo_path):
        """导入单张照片"""
        # 从文件名或路径推断门店编号
        store_code = self._extract_store_code_from_path(photo_path)
        if not store_code:
            # 尝试从目录结构推断
            parent_dir = photo_path.parent.name
            if parent_dir and len(parent_dir) >= 3:
                store_code = parent_dir
        
        if not store_code:
            print(f"警告: 无法从路径提取门店编号，跳过: {photo_path}")
            return
        
        # 记录门店信息
        self._ensure_store(store_code, '')
        
        # 推断照片类型
        photo_type = self._infer_photo_type(photo_path)
        
        # 从文件元数据或文件名推断拍摄日期
        taken_date = self._extract_date_from_path(photo_path)
        
        file_record_id, is_new = FileRecord.create_from_file(
            self.batch_id, photo_path, 'photo'
        )
        
        self.stats['total_files'] += 1
        if is_new:
            self.stats['new_files'] += 1
        else:
            self.stats['existing_files'] += 1
        
        # 检查是否已存在相同照片记录
        photo_hash = FileRecord.calculate_hash(photo_path)
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM photo_records WHERE batch_id = ? AND photo_hash = ?",
            (self.batch_id, photo_hash)
        )
        existing = cursor.fetchone()
        conn.close()
        
        if not existing:
            PhotoRecord.create(
                batch_id=self.batch_id,
                store_code=store_code,
                photo_path=str(photo_path),
                photo_hash=photo_hash,
                photo_type=photo_type,
                taken_date=taken_date,
                file_record_id=file_record_id
            )
            self.stats['records']['photo'] += 1
    
    def ingest_rectification_records(self, file_path):
        """导入整改预约表 CSV 文件"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        file_record_id, is_new = FileRecord.create_from_file(
            self.batch_id, file_path, 'rectification_csv'
        )
        
        self.stats['total_files'] += 1
        if is_new:
            self.stats['new_files'] += 1
        else:
            self.stats['existing_files'] += 1
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                store_code = row.get('门店编号', '').strip()
                if not store_code:
                    continue
                
                # 记录门店信息
                self._ensure_store(store_code, row.get('门店名称', ''))
                
                # 确定状态
                status = row.get('状态', 'pending').strip().lower()
                valid_statuses = ['pending', 'in_progress', 'completed', 'overdue']
                if status not in valid_statuses:
                    status = 'pending'
                
                Rectification.create(
                    batch_id=self.batch_id,
                    store_code=store_code,
                    issue_description=row.get('问题描述', '').strip(),
                    appointment_date=row.get('预约日期', '').strip(),
                    deadline_date=row.get('截止日期', '').strip(),
                    status=status,
                    completion_date=row.get('完成日期', '').strip(),
                    file_record_id=file_record_id
                )
                self.stats['records']['rectification'] += 1
        
        print(f"已导入整改预约表文件: {file_path.name}")
    
    def _ensure_store(self, store_code, store_name):
        """确保门店存在"""
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM stores WHERE store_code = ?", (store_code,))
        existing = cursor.fetchone()
        
        if not existing:
            cursor.execute(
                "INSERT INTO stores (store_code, store_name) VALUES (?, ?)",
                (store_code, store_name or store_code)
            )
            conn.commit()
        
        conn.close()
    
    def _extract_store_code_from_path(self, path):
        """从文件路径提取门店编号"""
        # 尝试从文件名提取 (如: S001_烟道入口.jpg)
        name = path.stem
        
        # 常见模式: S001, 001, STORE001 等
        import re
        
        # 匹配以S开头的门店编号: S001, S123等
        match = re.search(r'[Ss](\d{3,})', name)
        if match:
            return f"S{match.group(1)}"
        
        # 匹配纯数字的门店编号
        match = re.search(r'(\d{3,})', name)
        if match:
            return match.group(1)
        
        return None
    
    def _infer_photo_type(self, path):
        """从文件名推断照片类型"""
        name = path.stem.lower()
        parent_dir = path.parent.name.lower() if path.parent else ''
        
        type_keywords = {
            '烟道入口': ['烟道入口', '入口', 'inlet', 'entrance'],
            '烟道出口': ['烟道出口', '出口', 'outlet', 'exit'],
            '净化器前': ['净化器前', '净化器前端', 'before_purifier'],
            '净化器后': ['净化器后', '净化器后端', 'after_purifier'],
            '净化器整体': ['净化器', 'purifier'],
            '清洗中': ['清洗中', 'cleaning'],
            '清洗后': ['清洗后', 'after_cleaning'],
        }
        
        # 检查文件名
        for photo_type, keywords in type_keywords.items():
            for keyword in keywords:
                if keyword.lower() in name or keyword.lower() in parent_dir:
                    return photo_type
        
        return '其他'
    
    def _extract_date_from_path(self, path):
        """从文件路径提取日期"""
        name = path.stem
        
        import re
        # 匹配日期格式: 20240115, 2024-01-15, 2024_01_15 等
        match = re.search(r'(\d{4})[-_]?(\d{2})[-_]?(\d{2})', name)
        if match:
            return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
        
        return None
    
    def get_stats(self):
        """获取导入统计"""
        return self.stats
