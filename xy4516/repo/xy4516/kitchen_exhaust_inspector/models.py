from .db import get_db
from datetime import datetime
from pathlib import Path
import hashlib
import csv

class BaseModel:
    table_name = None
    fields = []
    
    @classmethod
    def create(cls, **kwargs):
        conn = get_db()
        cursor = conn.cursor()
        
        keys = [k for k in kwargs.keys() if k in cls.fields]
        values = [kwargs[k] for k in keys]
        placeholders = ', '.join(['?' for _ in keys])
        
        query = f"INSERT INTO {cls.table_name} ({', '.join(keys)}) VALUES ({placeholders})"
        cursor.execute(query, values)
        
        conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return last_id
    
    @classmethod
    def get_by_id(cls, record_id):
        conn = get_db()
        cursor = conn.cursor()
        
        query = f"SELECT * FROM {cls.table_name} WHERE id = ?"
        cursor.execute(query, (record_id,))
        row = cursor.fetchone()
        
        conn.close()
        if row:
            return dict(row)
        return None
    
    @classmethod
    def get_all(cls, **filters):
        conn = get_db()
        cursor = conn.cursor()
        
        if filters:
            keys = list(filters.keys())
            values = list(filters.values())
            conditions = ' AND '.join([f"{k} = ?" for k in keys])
            query = f"SELECT * FROM {cls.table_name} WHERE {conditions}"
            cursor.execute(query, values)
        else:
            query = f"SELECT * FROM {cls.table_name}"
            cursor.execute(query)
        
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

class Store(BaseModel):
    table_name = 'stores'
    fields = ['store_code', 'store_name', 'created_at']

class InspectionBatch(BaseModel):
    table_name = 'inspection_batches'
    fields = ['batch_name', 'inspection_month', 'created_at']
    
    @classmethod
    def get_or_create(cls, batch_name, inspection_month):
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id FROM inspection_batches WHERE batch_name = ? AND inspection_month = ?",
            (batch_name, inspection_month)
        )
        row = cursor.fetchone()
        
        if row:
            batch_id = row[0]
        else:
            cursor.execute(
                "INSERT INTO inspection_batches (batch_name, inspection_month) VALUES (?, ?)",
                (batch_name, inspection_month)
            )
            batch_id = cursor.lastrowid
            conn.commit()
        
        conn.close()
        return batch_id

class FileRecord(BaseModel):
    table_name = 'file_records'
    fields = ['batch_id', 'file_path', 'file_hash', 'file_type', 'uploaded_at']
    
    @staticmethod
    def calculate_hash(file_path):
        """计算文件SHA256哈希值"""
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    @classmethod
    def create_from_file(cls, batch_id, file_path, file_type):
        """从文件创建记录，自动计算哈希"""
        file_hash = cls.calculate_hash(file_path)
        
        # 检查是否已存在相同哈希的文件
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM file_records WHERE batch_id = ? AND file_hash = ?",
            (batch_id, file_hash)
        )
        existing = cursor.fetchone()
        conn.close()
        
        if existing:
            return existing[0], False  # 返回现有ID，表示已存在
        
        record_id = cls.create(
            batch_id=batch_id,
            file_path=str(file_path),
            file_hash=file_hash,
            file_type=file_type
        )
        return record_id, True

class CleaningRecord(BaseModel):
    table_name = 'cleaning_records'
    fields = ['batch_id', 'store_code', 'cleaning_date', 'cleaning_company', 
              'technician_name', 'next_cleaning_date', 'file_record_id']

class SensorReading(BaseModel):
    table_name = 'sensor_readings'
    fields = ['batch_id', 'store_code', 'reading_date', 'reading_time', 
              'pm25', 'pm10', 'oil_concentration', 'temperature', 'humidity', 'file_record_id']

class PhotoRecord(BaseModel):
    table_name = 'photo_records'
    fields = ['batch_id', 'store_code', 'photo_path', 'photo_hash', 
              'photo_type', 'taken_date', 'file_record_id']

class Rectification(BaseModel):
    table_name = 'rectifications'
    fields = ['batch_id', 'store_code', 'issue_description', 'appointment_date', 
              'deadline_date', 'status', 'completion_date', 'file_record_id']

class Risk(BaseModel):
    table_name = 'risks'
    fields = ['batch_id', 'store_code', 'risk_type', 'risk_level', 
              'description', 'related_record_type', 'related_record_id', 'detected_at']
    
    @classmethod
    def create_risk(cls, batch_id, store_code, risk_type, risk_level, description, 
                    related_record_type=None, related_record_id=None):
        return cls.create(
            batch_id=batch_id,
            store_code=store_code,
            risk_type=risk_type,
            risk_level=risk_level,
            description=description,
            related_record_type=related_record_type,
            related_record_id=related_record_id
        )

class Review(BaseModel):
    table_name = 'reviews'
    fields = ['risk_id', 'reviewer', 'review_date', 'review_result', 'comments']
