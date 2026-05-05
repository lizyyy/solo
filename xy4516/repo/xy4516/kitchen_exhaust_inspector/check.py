from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from .models import (
    CleaningRecord, SensorReading, PhotoRecord, Rectification, Risk, Store
)
from .db import get_db

class RiskChecker:
    """风险检查器"""
    
    # 风险类型定义
    RISK_TYPES = {
        'MISSING_CLEANING': 'missing_cleaning',
        'OVERDUE_CLEANING': 'overdue_cleaning',
        'EMISSION_EXCEEDING': 'emission_exceeding',
        'PHOTO_MISMATCH': 'photo_mismatch',
        'RECTIFICATION_OVERDUE': 'rectification_overdue',
        'MISSING_PHOTOS': 'missing_photos',
    }
    
    # 风险等级
    RISK_LEVELS = {
        'HIGH': 'high',
        'MEDIUM': 'medium',
        'LOW': 'low',
    }
    
    # 排放阈值
    EMISSION_THRESHOLDS = {
        'pm25': 35.0,      # PM2.5 阈值 (μg/m³)
        'pm10': 70.0,       # PM10 阈值 (μg/m³)
        'oil_concentration': 2.0,  # 油烟浓度阈值 (mg/m³)
    }
    
    # 清洗周期（月）
    CLEANING_INTERVAL_MONTHS = 1
    
    def __init__(self, batch_id):
        self.batch_id = batch_id
        self.risks = []
        self.stats = {
            'total_risks': 0,
            'high_risk': 0,
            'medium_risk': 0,
            'low_risk': 0,
            'by_type': {}
        }
    
    def check_all(self):
        """执行所有风险检查"""
        self.check_missing_cleaning()
        self.check_overdue_cleaning()
        self.check_emission_exceeding()
        self.check_photo_mismatch()
        self.check_rectification_overdue()
        self.check_missing_photos()
        
        return self.risks
    
    def check_missing_cleaning(self):
        """检查遗漏清洗记录"""
        # 获取所有门店
        stores = Store.get_all()
        store_codes = {s['store_code'] for s in stores}
        
        # 获取有清洗记录的门店
        cleaning_records = CleaningRecord.get_all(batch_id=self.batch_id)
        cleaned_stores = {r['store_code'] for r in cleaning_records}
        
        # 找出没有清洗记录的门店
        missing_stores = store_codes - cleaned_stores
        
        for store_code in missing_stores:
            risk = self._create_risk(
                store_code=store_code,
                risk_type=self.RISK_TYPES['MISSING_CLEANING'],
                risk_level=self.RISK_LEVELS['HIGH'],
                description=f"门店 {store_code} 本月未提交油烟净化器清洗记录",
                related_record_type='cleaning',
                related_record_id=None
            )
            self.risks.append(risk)
    
    def check_overdue_cleaning(self):
        """检查清洗超期"""
        cleaning_records = CleaningRecord.get_all(batch_id=self.batch_id)
        
        for record in cleaning_records:
            # 检查是否有下次清洗日期
            next_cleaning_date = record.get('next_cleaning_date')
            cleaning_date = record.get('cleaning_date')
            
            if next_cleaning_date:
                try:
                    next_date = datetime.strptime(next_cleaning_date, '%Y-%m-%d')
                    today = datetime.now()
                    
                    if next_date < today:
                        risk = self._create_risk(
                            store_code=record['store_code'],
                            risk_type=self.RISK_TYPES['OVERDUE_CLEANING'],
                            risk_level=self.RISK_LEVELS['HIGH'],
                            description=f"门店 {record['store_code']} 清洗已超期，下次清洗日期为 {next_cleaning_date}",
                            related_record_type='cleaning',
                            related_record_id=record['id']
                        )
                        self.risks.append(risk)
                except ValueError:
                    pass
            
            # 如果没有下次清洗日期，根据清洗日期计算
            elif cleaning_date:
                try:
                    clean_date = datetime.strptime(cleaning_date, '%Y-%m-%d')
                    expected_next_date = clean_date + relativedelta(months=self.CLEANING_INTERVAL_MONTHS)
                    today = datetime.now()
                    
                    if expected_next_date < today:
                        risk = self._create_risk(
                            store_code=record['store_code'],
                            risk_type=self.RISK_TYPES['OVERDUE_CLEANING'],
                            risk_level=self.RISK_LEVELS['MEDIUM'],
                            description=f"门店 {record['store_code']} 上次清洗时间为 {cleaning_date}，已超过1个月未清洗",
                            related_record_type='cleaning',
                            related_record_id=record['id']
                        )
                        self.risks.append(risk)
                except ValueError:
                    pass
    
    def check_emission_exceeding(self):
        """检查排放超限"""
        sensor_readings = SensorReading.get_all(batch_id=self.batch_id)
        
        for reading in sensor_readings:
            issues = []
            
            # 检查 PM2.5
            if reading.get('pm25') is not None:
                if reading['pm25'] > self.EMISSION_THRESHOLDS['pm25']:
                    issues.append(f"PM2.5: {reading['pm25']} μg/m³ (阈值: {self.EMISSION_THRESHOLDS['pm25']})")
            
            # 检查 PM10
            if reading.get('pm10') is not None:
                if reading['pm10'] > self.EMISSION_THRESHOLDS['pm10']:
                    issues.append(f"PM10: {reading['pm10']} μg/m³ (阈值: {self.EMISSION_THRESHOLDS['pm10']})")
            
            # 检查油烟浓度
            if reading.get('oil_concentration') is not None:
                if reading['oil_concentration'] > self.EMISSION_THRESHOLDS['oil_concentration']:
                    issues.append(f"油烟浓度: {reading['oil_concentration']} mg/m³ (阈值: {self.EMISSION_THRESHOLDS['oil_concentration']})")
            
            if issues:
                risk_level = self.RISK_LEVELS['HIGH'] if len(issues) >= 2 else self.RISK_LEVELS['MEDIUM']
                
                risk = self._create_risk(
                    store_code=reading['store_code'],
                    risk_type=self.RISK_TYPES['EMISSION_EXCEEDING'],
                    risk_level=risk_level,
                    description=f"门店 {reading['store_code']} 排放超限 - {', '.join(issues)}",
                    related_record_type='sensor',
                    related_record_id=reading['id']
                )
                self.risks.append(risk)
    
    def check_photo_mismatch(self):
        """检查照片与门店不匹配"""
        # 获取所有照片记录
        photo_records = PhotoRecord.get_all(batch_id=self.batch_id)
        
        # 按门店分组统计照片数量
        store_photos = {}
        for photo in photo_records:
            store_code = photo['store_code']
            if store_code not in store_photos:
                store_photos[store_code] = []
            store_photos[store_code].append(photo)
        
        # 检查门店是否有对应清洗记录或传感器数据
        cleaning_stores = {r['store_code'] for r in CleaningRecord.get_all(batch_id=self.batch_id)}
        sensor_stores = {r['store_code'] for r in SensorReading.get_all(batch_id=self.batch_id)}
        active_stores = cleaning_stores | sensor_stores
        
        for store_code, photos in store_photos.items():
            # 如果门店不在活跃门店列表中，可能是照片归属错误
            if store_code not in active_stores:
                # 检查是否有其他门店的照片可能被误归类
                for photo in photos:
                    risk = self._create_risk(
                        store_code=store_code,
                        risk_type=self.RISK_TYPES['PHOTO_MISMATCH'],
                        risk_level=self.RISK_LEVELS['MEDIUM'],
                        description=f"门店 {store_code} 的照片可能归属错误，该门店无对应清洗记录或传感器数据。照片路径: {photo['photo_path']}",
                        related_record_type='photo',
                        related_record_id=photo['id']
                    )
                    self.risks.append(risk)
            
            # 检查照片类型完整性
            photo_types = {p.get('photo_type', '') for p in photos}
            required_types = ['烟道入口', '烟道出口', '净化器前', '净化器后']
            missing_types = [t for t in required_types if t not in photo_types]
            
            if missing_types:
                risk = self._create_risk(
                    store_code=store_code,
                    risk_type=self.RISK_TYPES['MISSING_PHOTOS'],
                    risk_level=self.RISK_LEVELS['MEDIUM'],
                    description=f"门店 {store_code} 缺少以下类型照片: {', '.join(missing_types)}",
                    related_record_type='photo',
                    related_record_id=None
                )
                self.risks.append(risk)
    
    def check_rectification_overdue(self):
        """检查整改超期"""
        rectifications = Rectification.get_all(batch_id=self.batch_id)
        
        for rect in rectifications:
            status = rect.get('status', 'pending')
            deadline_date = rect.get('deadline_date')
            appointment_date = rect.get('appointment_date')
            
            today = datetime.now()
            
            # 检查截止日期
            if deadline_date:
                try:
                    deadline = datetime.strptime(deadline_date, '%Y-%m-%d')
                    
                    if status in ['pending', 'in_progress']:
                        if deadline < today:
                            risk = self._create_risk(
                                store_code=rect['store_code'],
                                risk_type=self.RISK_TYPES['RECTIFICATION_OVERDUE'],
                                risk_level=self.RISK_LEVELS['HIGH'],
                                description=f"门店 {rect['store_code']} 整改已超期，问题: {rect['issue_description']}，截止日期: {deadline_date}",
                                related_record_type='rectification',
                                related_record_id=rect['id']
                            )
                            self.risks.append(risk)
                except ValueError:
                    pass
            
            # 检查预约日期（即使没有截止日期）
            elif appointment_date and status in ['pending', 'in_progress']:
                try:
                    appointment = datetime.strptime(appointment_date, '%Y-%m-%d')
                    expected_deadline = appointment + timedelta(days=7)  # 默认预约后7天内完成
                    
                    if expected_deadline < today:
                        risk = self._create_risk(
                            store_code=rect['store_code'],
                            risk_type=self.RISK_TYPES['RECTIFICATION_OVERDUE'],
                            risk_level=self.RISK_LEVELS['MEDIUM'],
                            description=f"门店 {rect['store_code']} 整改可能超期，预约日期: {appointment_date}，问题: {rect['issue_description']}",
                            related_record_type='rectification',
                            related_record_id=rect['id']
                        )
                        self.risks.append(risk)
                except ValueError:
                    pass
    
    def check_missing_photos(self):
        """检查遗漏照片（已有清洗记录但无照片）"""
        cleaning_stores = {r['store_code'] for r in CleaningRecord.get_all(batch_id=self.batch_id)}
        photo_stores = {p['store_code'] for p in PhotoRecord.get_all(batch_id=self.batch_id)}
        
        stores_without_photos = cleaning_stores - photo_stores
        
        for store_code in stores_without_photos:
            risk = self._create_risk(
                store_code=store_code,
                risk_type=self.RISK_TYPES['MISSING_PHOTOS'],
                risk_level=self.RISK_LEVELS['HIGH'],
                description=f"门店 {store_code} 有清洗记录但未提交烟道照片",
                related_record_type='cleaning',
                related_record_id=None
            )
            self.risks.append(risk)
    
    def _create_risk(self, store_code, risk_type, risk_level, description, 
                      related_record_type=None, related_record_id=None):
        """创建风险记录并保存到数据库"""
        # 检查是否已存在相同风险
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT id FROM risks 
               WHERE batch_id = ? AND store_code = ? AND risk_type = ? 
               AND related_record_type = ? AND related_record_id = ?""",
            (self.batch_id, store_code, risk_type, related_record_type, related_record_id)
        )
        existing = cursor.fetchone()
        conn.close()
        
        if existing:
            return Risk.get_by_id(existing[0])
        
        # 创建新风险
        risk_id = Risk.create_risk(
            batch_id=self.batch_id,
            store_code=store_code,
            risk_type=risk_type,
            risk_level=risk_level,
            description=description,
            related_record_type=related_record_type,
            related_record_id=related_record_id
        )
        
        # 更新统计
        self.stats['total_risks'] += 1
        if risk_level == self.RISK_LEVELS['HIGH']:
            self.stats['high_risk'] += 1
        elif risk_level == self.RISK_LEVELS['MEDIUM']:
            self.stats['medium_risk'] += 1
        else:
            self.stats['low_risk'] += 1
        
        if risk_type not in self.stats['by_type']:
            self.stats['by_type'][risk_type] = 0
        self.stats['by_type'][risk_type] += 1
        
        return Risk.get_by_id(risk_id)
    
    def get_stats(self):
        """获取检查统计"""
        return self.stats
    
    def get_risks_by_level(self, risk_level):
        """按风险等级获取风险"""
        return [r for r in self.risks if r.get('risk_level') == risk_level]
    
    def get_risks_by_store(self, store_code):
        """按门店获取风险"""
        return [r for r in self.risks if r.get('store_code') == store_code]
