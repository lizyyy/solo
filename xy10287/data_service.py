import hashlib
import os
import json
from datetime import datetime
from typing import Dict, List, Any, Tuple
import pandas as pd

from app import db, app
from models import InspectionRecord, AcousticFeature, AnomalyResult, ReviewRecord, BatchRun
from acoustic_feature_extractor import AcousticFeatureExtractor
from anomaly_classifier import AnomalyClassifier

class DataProcessingService:
    def __init__(self):
        self.feature_extractor = AcousticFeatureExtractor()
        self.classifier = AnomalyClassifier()
    
    def generate_record_id(self, row: pd.Series, index: int) -> str:
        base_str = f"{row.get('pump_room', '')}_{row.get('pump_name', '')}_{row.get('inspection_date', '')}_{index}"
        return hashlib.md5(base_str.encode('utf-8')).hexdigest()[:12]
    
    def generate_batch_id(self, filename: str, timestamp: datetime) -> str:
        base_str = f"{filename}_{timestamp.strftime('%Y%m%d%H%M%S')}"
        return hashlib.md5(base_str.encode('utf-8')).hexdigest()[:10]
    
    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        required_cols = ['pump_room', 'pump_name', 'inspection_date', 'inspector', 'noise_description']
        for col in required_cols:
            if col not in df.columns:
                df[col] = ''
        
        df['pump_room'] = df['pump_room'].astype(str).str.strip()
        df['pump_name'] = df['pump_name'].astype(str).str.strip()
        df['inspector'] = df['inspector'].astype(str).str.strip()
        df['noise_description'] = df['noise_description'].astype(str).str.strip()
        
        df = df[df['noise_description'].str.len() > 0]
        
        try:
            df['inspection_date'] = pd.to_datetime(df['inspection_date'], errors='coerce')
            df = df.dropna(subset=['inspection_date'])
        except Exception:
            df['inspection_date'] = datetime.now()
        
        df = df.drop_duplicates(subset=['pump_room', 'pump_name', 'inspection_date'], keep='last')
        
        return df
    
    def process_file(self, file_path: str) -> Dict[str, Any]:
        timestamp = datetime.now()
        filename = os.path.basename(file_path)
        
        df = self._read_file(file_path)
        if df.empty:
            return {'success': False, 'message': '文件为空或无法读取'}
        
        total_records = len(df)
        
        cleaned_df = self.clean_data(df)
        cleaned_records = len(cleaned_df)
        
        batch_id = self.generate_batch_id(filename, timestamp)
        
        existing_batch = BatchRun.query.filter_by(batch_id=batch_id).first()
        if existing_batch:
            return self._get_existing_batch_result(existing_batch)
        
        new_records = []
        normal_count = 0
        anomaly_count = 0
        
        for idx, row in cleaned_df.iterrows():
            record_id = self.generate_record_id(row, idx)
            
            existing = InspectionRecord.query.filter_by(record_id=record_id).first()
            if existing:
                continue
            
            inspection_record = self._create_inspection_record(row, record_id, batch_id)
            db.session.add(inspection_record)
            
            acoustic_features = self.feature_extractor.extract(
                row['noise_description'],
                record_id
            )
            feature_record = self._create_acoustic_feature(acoustic_features)
            db.session.add(feature_record)
            
            anomaly_result = self.classifier.classify(
                acoustic_features,
                record_id,
                batch_id
            )
            anomaly_record = self._create_anomaly_result(anomaly_result)
            db.session.add(anomaly_record)
            
            new_records.append(record_id)
            
            if anomaly_result['anomaly_level'] == 'normal':
                normal_count += 1
            else:
                anomaly_count += 1
        
        batch_run = BatchRun(
            batch_id=batch_id,
            input_file=filename,
            total_records=total_records,
            cleaned_records=cleaned_records,
            normal_count=normal_count,
            anomaly_count=anomaly_count,
            reviewed_count=0
        )
        db.session.add(batch_run)
        db.session.commit()
        
        return {
            'success': True,
            'batch_id': batch_id,
            'total_records': total_records,
            'cleaned_records': cleaned_records,
            'new_records': len(new_records),
            'normal_count': normal_count,
            'anomaly_count': anomaly_count,
            'message': f'成功处理 {len(new_records)} 条新记录'
        }
    
    def _read_file(self, file_path: str) -> pd.DataFrame:
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.xlsx', '.xls']:
            return pd.read_excel(file_path)
        elif ext == '.csv':
            return pd.read_csv(file_path)
        else:
            raise ValueError(f'不支持的文件格式: {ext}')
    
    def _create_inspection_record(self, row: pd.Series, record_id: str, batch_id: str) -> InspectionRecord:
        return InspectionRecord(
            record_id=record_id,
            pump_room=row['pump_room'],
            pump_name=row['pump_name'],
            inspection_date=row['inspection_date'],
            inspector=row['inspector'],
            noise_description=row['noise_description'],
            original_data=json.dumps(row.to_dict(), ensure_ascii=False, default=str),
            batch_id=batch_id
        )
    
    def _create_acoustic_feature(self, data: Dict[str, Any]) -> AcousticFeature:
        return AcousticFeature(
            record_id=data['record_id'],
            rms_level=data['rms_level'],
            peak_frequency=data['peak_frequency'],
            spectral_centroid=data['spectral_centroid'],
            harmonic_ratio=data['harmonic_ratio'],
            noise_type_keywords=data['noise_type_keywords'],
            feature_vector=data['feature_vector'],
            extraction_method=data['extraction_method']
        )
    
    def _create_anomaly_result(self, data: Dict[str, Any]) -> AnomalyResult:
        return AnomalyResult(
            record_id=data['record_id'],
            anomaly_type=data['anomaly_type'],
            anomaly_level=data['anomaly_level'],
            confidence_score=data['confidence_score'],
            rule_matched=data['rule_matched'],
            explanation=data['explanation'],
            status=data['status'],
            batch_id=data['batch_id']
        )
    
    def _get_existing_batch_result(self, batch: BatchRun) -> Dict[str, Any]:
        return {
            'success': True,
            'batch_id': batch.batch_id,
            'total_records': batch.total_records,
            'cleaned_records': batch.cleaned_records,
            'new_records': 0,
            'normal_count': batch.normal_count,
            'anomaly_count': batch.anomaly_count,
            'message': f'该批次数据已存在 (批次ID: {batch.batch_id})，跳过重复处理',
            'duplicate': True
        }
    
    def review_record(self, record_id: str, reviewer: str, comment: str, 
                      final_type: str, final_level: str) -> Dict[str, Any]:
        inspection = InspectionRecord.query.filter_by(record_id=record_id).first()
        if not inspection:
            return {'success': False, 'message': '记录不存在'}
        
        existing_review = ReviewRecord.query.filter_by(record_id=record_id).first()
        if existing_review:
            existing_review.reviewer = reviewer
            existing_review.review_comment = comment
            existing_review.final_anomaly_type = final_type
            existing_review.final_anomaly_level = final_level
            existing_review.reviewed_at = datetime.utcnow()
        else:
            review = ReviewRecord(
                record_id=record_id,
                reviewer=reviewer,
                review_comment=comment,
                final_anomaly_type=final_type,
                final_anomaly_level=final_level
            )
            db.session.add(review)
        
        anomaly = AnomalyResult.query.filter_by(record_id=record_id).first()
        if anomaly:
            anomaly.status = 'reviewed'
            anomaly.anomaly_type = final_type
            anomaly.anomaly_level = final_level
        
        batch = BatchRun.query.filter_by(batch_id=inspection.batch_id).first()
        if batch:
            batch.reviewed_count = ReviewRecord.query.filter(
                InspectionRecord.batch_id == inspection.batch_id,
                ReviewRecord.record_id == InspectionRecord.record_id
            ).count()
        
        db.session.commit()
        return {'success': True, 'message': '复核完成'}
    
    def export_results(self, batch_id: str = None) -> str:
        query = db.session.query(
            InspectionRecord,
            AcousticFeature,
            AnomalyResult,
            ReviewRecord
        ).outerjoin(AcousticFeature, InspectionRecord.record_id == AcousticFeature.record_id
        ).outerjoin(AnomalyResult, InspectionRecord.record_id == AnomalyResult.record_id
        ).outerjoin(ReviewRecord, InspectionRecord.record_id == ReviewRecord.record_id)
        
        if batch_id:
            query = query.filter(InspectionRecord.batch_id == batch_id)
        
        results = query.all()
        
        export_data = []
        for rec, feat, anom, rev in results:
            row = {
                '记录ID': rec.record_id,
                '泵房': rec.pump_room,
                '水泵名称': rec.pump_name,
                '巡检日期': rec.inspection_date.strftime('%Y-%m-%d %H:%M:%S') if rec.inspection_date else '',
                '巡检人': rec.inspector,
                '异响描述': rec.noise_description,
                'RMS值': feat.rms_level if feat else '',
                '峰值频率(Hz)': feat.peak_frequency if feat else '',
                '频谱质心': feat.spectral_centroid if feat else '',
                '谐波比': feat.harmonic_ratio if feat else '',
                '噪声类型关键词': feat.noise_type_keywords if feat else '',
                '异常类型': anom.anomaly_type if anom else '',
                '异常级别': anom.anomaly_level if anom else '',
                '置信度': anom.confidence_score if anom else '',
                '规则匹配': anom.rule_matched if anom else '',
                '解释说明': anom.explanation if anom else '',
                '状态': anom.status if anom else '',
                '复核人': rev.reviewer if rev else '',
                '复核意见': rev.review_comment if rev else '',
                '最终异常类型': rev.final_anomaly_type if rev else '',
                '最终异常级别': rev.final_anomaly_level if rev else '',
                '批次ID': rec.batch_id
            }
            export_data.append(row)
        
        df = pd.DataFrame(export_data)
        
        export_dir = app.config['EXPORT_FOLDER']
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        filename = f'inspection_export_{batch_id or "all"}_{timestamp}.xlsx'
        file_path = os.path.join(export_dir, filename)
        
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='巡检结果', index=False)
            
            stats_df = self._generate_stats(df)
            stats_df.to_excel(writer, sheet_name='统计汇总', index=False)
        
        return file_path
    
    def _generate_stats(self, df: pd.DataFrame) -> pd.DataFrame:
        stats = []
        
        level_counts = df['异常级别'].value_counts().to_dict()
        stats.append({'统计项': '正常', '数量': level_counts.get('normal', 0)})
        stats.append({'统计项': '预警', '数量': level_counts.get('warning', 0)})
        stats.append({'统计项': '告警', '数量': level_counts.get('alert', 0)})
        stats.append({'统计项': '严重', '数量': level_counts.get('critical', 0)})
        stats.append({'统计项': '已复核', '数量': df['状态'].eq('reviewed').sum()})
        stats.append({'统计项': '待复核', '数量': df['状态'].eq('pending').sum()})
        
        return pd.DataFrame(stats)
    
    def get_records_list(self, page: int = 1, per_page: int = 20, 
                         status: str = None, level: str = None,
                         batch_id: str = None) -> Dict[str, Any]:
        query = db.session.query(
            InspectionRecord,
            AcousticFeature,
            AnomalyResult,
            ReviewRecord
        ).outerjoin(AcousticFeature, InspectionRecord.record_id == AcousticFeature.record_id
        ).outerjoin(AnomalyResult, InspectionRecord.record_id == AnomalyResult.record_id
        ).outerjoin(ReviewRecord, InspectionRecord.record_id == ReviewRecord.record_id)
        
        if status:
            query = query.filter(AnomalyResult.status == status)
        if level:
            query = query.filter(AnomalyResult.anomaly_level == level)
        if batch_id:
            query = query.filter(InspectionRecord.batch_id == batch_id)
        
        total = query.count()
        
        query = query.order_by(InspectionRecord.inspection_date.desc())
        query = query.offset((page - 1) * per_page).limit(per_page)
        
        results = query.all()
        
        records = []
        for rec, feat, anom, rev in results:
            records.append({
                'record_id': rec.record_id,
                'pump_room': rec.pump_room,
                'pump_name': rec.pump_name,
                'inspection_date': rec.inspection_date.strftime('%Y-%m-%d %H:%M:%S') if rec.inspection_date else '',
                'inspector': rec.inspector,
                'noise_description': rec.noise_description,
                'rms_level': feat.rms_level if feat else None,
                'peak_frequency': feat.peak_frequency if feat else None,
                'harmonic_ratio': feat.harmonic_ratio if feat else None,
                'anomaly_type': anom.anomaly_type if anom else '',
                'anomaly_level': anom.anomaly_level if anom else '',
                'confidence_score': anom.confidence_score if anom else None,
                'explanation': anom.explanation if anom else '',
                'status': anom.status if anom else 'pending',
                'batch_id': rec.batch_id,
                'reviewed': rev is not None,
                'final_anomaly_type': rev.final_anomaly_type if rev else ''
            })
        
        return {
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page,
            'records': records
        }
    
    def get_record_detail(self, record_id: str) -> Dict[str, Any]:
        result = db.session.query(
            InspectionRecord,
            AcousticFeature,
            AnomalyResult,
            ReviewRecord
        ).outerjoin(AcousticFeature, InspectionRecord.record_id == AcousticFeature.record_id
        ).outerjoin(AnomalyResult, InspectionRecord.record_id == AnomalyResult.record_id
        ).outerjoin(ReviewRecord, InspectionRecord.record_id == ReviewRecord.record_id
        ).filter(InspectionRecord.record_id == record_id).first()
        
        if not result:
            return None
        
        rec, feat, anom, rev = result
        
        return {
            'inspection': {
                'record_id': rec.record_id,
                'pump_room': rec.pump_room,
                'pump_name': rec.pump_name,
                'inspection_date': rec.inspection_date.strftime('%Y-%m-%d %H:%M:%S') if rec.inspection_date else '',
                'inspector': rec.inspector,
                'noise_description': rec.noise_description,
                'batch_id': rec.batch_id
            },
            'acoustic_feature': {
                'rms_level': feat.rms_level if feat else None,
                'peak_frequency': feat.peak_frequency if feat else None,
                'spectral_centroid': feat.spectral_centroid if feat else None,
                'harmonic_ratio': feat.harmonic_ratio if feat else None,
                'noise_type_keywords': json.loads(feat.noise_type_keywords) if feat and feat.noise_type_keywords else [],
                'feature_vector': json.loads(feat.feature_vector) if feat and feat.feature_vector else [],
                'extraction_method': feat.extraction_method if feat else ''
            },
            'anomaly_result': {
                'anomaly_type': anom.anomaly_type if anom else '',
                'anomaly_level': anom.anomaly_level if anom else '',
                'confidence_score': anom.confidence_score if anom else None,
                'rule_matched': json.loads(anom.rule_matched) if anom and anom.rule_matched else [],
                'explanation': anom.explanation if anom else '',
                'status': anom.status if anom else 'pending'
            },
            'review': {
                'reviewer': rev.reviewer if rev else '',
                'review_comment': rev.review_comment if rev else '',
                'final_anomaly_type': rev.final_anomaly_type if rev else '',
                'final_anomaly_level': rev.final_anomaly_level if rev else '',
                'reviewed_at': rev.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if rev and rev.reviewed_at else ''
            } if rev else None
        }
    
    def get_dashboard_stats(self) -> Dict[str, Any]:
        total_records = InspectionRecord.query.count()
        
        anomalies = AnomalyResult.query
        normal_count = anomalies.filter(AnomalyResult.anomaly_level == 'normal').count()
        warning_count = anomalies.filter(AnomalyResult.anomaly_level == 'warning').count()
        alert_count = anomalies.filter(AnomalyResult.anomaly_level == 'alert').count()
        critical_count = anomalies.filter(AnomalyResult.anomaly_level == 'critical').count()
        
        pending_count = anomalies.filter(AnomalyResult.status == 'pending').count()
        reviewed_count = anomalies.filter(AnomalyResult.status == 'reviewed').count()
        
        batches = BatchRun.query.order_by(BatchRun.run_at.desc()).limit(5).all()
        batch_list = []
        for b in batches:
            batch_list.append({
                'batch_id': b.batch_id,
                'input_file': b.input_file,
                'total_records': b.total_records,
                'cleaned_records': b.cleaned_records,
                'normal_count': b.normal_count,
                'anomaly_count': b.anomaly_count,
                'reviewed_count': b.reviewed_count,
                'run_at': b.run_at.strftime('%Y-%m-%d %H:%M:%S') if b.run_at else ''
            })
        
        return {
            'total_records': total_records,
            'normal_count': normal_count,
            'warning_count': warning_count,
            'alert_count': alert_count,
            'critical_count': critical_count,
            'pending_count': pending_count,
            'reviewed_count': reviewed_count,
            'recent_batches': batch_list
        }
