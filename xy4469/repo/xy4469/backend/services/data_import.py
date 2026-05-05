import os
import csv
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from werkzeug.utils import secure_filename

from models import db, Batch, Particle, Control, AuditLog
from services.classifier import MicroplasticClassifier
from config import Config

class DataImporter:
    @staticmethod
    def allowed_file(filename: str) -> bool:
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
    
    @staticmethod
    def parse_batch_info(df: pd.DataFrame) -> Dict:
        if 'batch_id' in df.columns:
            batch_id = str(df['batch_id'].iloc[0]).strip()
        else:
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            batch_id = f'BATCH-{timestamp}'
        
        sample_name = '未命名样本'
        if 'sample_name' in df.columns:
            sample_name = str(df['sample_name'].iloc[0]).strip()
        
        collection_date = None
        if 'collection_date' in df.columns:
            date_str = str(df['collection_date'].iloc[0]).strip()
            try:
                collection_date = pd.to_datetime(date_str).date()
            except:
                pass
        
        location = None
        if 'location' in df.columns:
            location = str(df['location'].iloc[0]).strip()
        
        sample_type = None
        if 'sample_type' in df.columns:
            sample_type = str(df['sample_type'].iloc[0]).strip()
        
        technician = None
        if 'technician' in df.columns:
            technician = str(df['technician'].iloc[0]).strip()
        
        notes = None
        if 'notes' in df.columns:
            notes = str(df['notes'].iloc[0]).strip()
        
        return {
            'batch_id': batch_id,
            'sample_name': sample_name,
            'collection_date': collection_date,
            'location': location,
            'sample_type': sample_type,
            'technician': technician,
            'notes': notes
        }
    
    @staticmethod
    def parse_annotations(df: pd.DataFrame, batch_id: str) -> List[Dict]:
        particles = []
        
        required_columns = ['particle_id']
        if not all(col in df.columns for col in required_columns):
            missing = [col for col in required_columns if col not in df.columns]
            raise ValueError(f'CSV 缺少必要列: {", ".join(missing)}')
        
        for idx, row in df.iterrows():
            particle_id = str(row.get('particle_id', f'{batch_id}-{idx+1:04d}')).strip()
            
            features = {
                'area': DataImporter._safe_float(row.get('area')),
                'perimeter': DataImporter._safe_float(row.get('perimeter')),
                'aspect_ratio': DataImporter._safe_float(row.get('aspect_ratio')),
                'circularity': DataImporter._safe_float(row.get('circularity')),
                'solidity': DataImporter._safe_float(row.get('solidity')),
                'extent': DataImporter._safe_float(row.get('extent')),
                'mean_intensity': DataImporter._safe_float(row.get('mean_intensity')),
                'max_intensity': DataImporter._safe_float(row.get('max_intensity')),
                'min_intensity': DataImporter._safe_float(row.get('min_intensity')),
            }
            
            auto_class, auto_conf = MicroplasticClassifier.classify(features)
            risk_level = MicroplasticClassifier.assess_risk(auto_class, features)
            
            manual_class = None
            if 'manual_classification' in df.columns and pd.notna(row.get('manual_classification')):
                manual_class = str(row['manual_classification']).strip().lower()
                if manual_class not in Config.CLASSIFICATION_CLASSES:
                    manual_class = None
            
            manual_conf = None
            if 'manual_confidence' in df.columns and pd.notna(row.get('manual_confidence')):
                try:
                    manual_conf = float(row['manual_confidence'])
                except:
                    pass
            
            particle = {
                'particle_id': particle_id,
                'image_path': str(row.get('image_path', '')).strip() if pd.notna(row.get('image_path')) else None,
                'x_coordinate': DataImporter._safe_float(row.get('x_coordinate')),
                'y_coordinate': DataImporter._safe_float(row.get('y_coordinate')),
                'area': features['area'],
                'perimeter': features['perimeter'],
                'aspect_ratio': features['aspect_ratio'],
                'circularity': features['circularity'],
                'solidity': features['solidity'],
                'extent': features['extent'],
                'mean_intensity': features['mean_intensity'],
                'max_intensity': features['max_intensity'],
                'min_intensity': features['min_intensity'],
                'color_r': DataImporter._safe_int(row.get('color_r')),
                'color_g': DataImporter._safe_int(row.get('color_g')),
                'color_b': DataImporter._safe_int(row.get('color_b')),
                'auto_classification': auto_class,
                'auto_confidence': auto_conf,
                'manual_classification': manual_class,
                'manual_confidence': manual_conf,
                'reviewed_by': str(row.get('reviewed_by', '')).strip() if pd.notna(row.get('reviewed_by')) else None,
                'review_notes': str(row.get('review_notes', '')).strip() if pd.notna(row.get('review_notes')) else None,
                'risk_level': risk_level,
                'is_flagged': bool(row.get('is_flagged', False)) if pd.notna(row.get('is_flagged')) else False,
            }
            
            particles.append(particle)
        
        return particles
    
    @staticmethod
    def parse_controls(df: pd.DataFrame) -> List[Dict]:
        controls = []
        
        for idx, row in df.iterrows():
            control_type = str(row.get('control_type', 'blank')).strip()
            control_name = str(row.get('control_name', f'对照-{idx+1}')).strip()
            
            control = {
                'control_type': control_type,
                'control_name': control_name,
                'particle_count': DataImporter._safe_int(row.get('particle_count'), 0),
                'fiber_count': DataImporter._safe_int(row.get('fiber_count'), 0),
                'bubble_count': DataImporter._safe_int(row.get('bubble_count'), 0),
                'notes': str(row.get('notes', '')).strip() if pd.notna(row.get('notes')) else None,
            }
            controls.append(control)
        
        return controls
    
    @staticmethod
    def _safe_float(value) -> Optional[float]:
        if pd.isna(value) or value is None or value == '':
            return None
        try:
            return float(value)
        except:
            return None
    
    @staticmethod
    def _safe_int(value, default: int = None) -> Optional[int]:
        if pd.isna(value) or value is None or value == '':
            return default
        try:
            return int(value)
        except:
            return default
    
    @classmethod
    def import_from_csv(cls, batch_csv_path: str, annotations_csv_path: str = None, 
                        controls_csv_path: str = None, user: str = None) -> Tuple[Batch, List[Particle], List[Control]]:
        try:
            batch_df = pd.read_csv(batch_csv_path, encoding='utf-8')
        except UnicodeDecodeError:
            batch_df = pd.read_csv(batch_csv_path, encoding='gbk')
        
        batch_info = cls.parse_batch_info(batch_df)
        
        existing_batch = Batch.query.filter_by(batch_id=batch_info['batch_id']).first()
        if existing_batch:
            raise ValueError(f'批次 {batch_info["batch_id"]} 已存在')
        
        batch = Batch(**batch_info)
        db.session.add(batch)
        db.session.flush()
        
        particles = []
        if annotations_csv_path and os.path.exists(annotations_csv_path):
            try:
                annot_df = pd.read_csv(annotations_csv_path, encoding='utf-8')
            except UnicodeDecodeError:
                annot_df = pd.read_csv(annotations_csv_path, encoding='gbk')
            
            particle_dicts = cls.parse_annotations(annot_df, batch.batch_id)
            
            for p_dict in particle_dicts:
                existing_particle = Particle.query.filter_by(particle_id=p_dict['particle_id']).first()
                if existing_particle:
                    raise ValueError(f'颗粒 {p_dict["particle_id"]} 已存在')
                
                particle = Particle(batch_id=batch.id, **p_dict)
                db.session.add(particle)
                particles.append(particle)
        
        controls = []
        if controls_csv_path and os.path.exists(controls_csv_path):
            try:
                ctrl_df = pd.read_csv(controls_csv_path, encoding='utf-8')
            except UnicodeDecodeError:
                ctrl_df = pd.read_csv(controls_csv_path, encoding='gbk')
            
            control_dicts = cls.parse_controls(ctrl_df)
            
            for c_dict in control_dicts:
                control = Control(batch_id=batch.id, **c_dict)
                db.session.add(control)
                controls.append(control)
        
        audit_log = AuditLog(
            action='import',
            entity_type='batch',
            entity_id=batch.id,
            details=f'导入批次 {batch.batch_id}，包含 {len(particles)} 个颗粒，{len(controls)} 个对照',
            user=user
        )
        db.session.add(audit_log)
        
        db.session.commit()
        
        return batch, particles, controls
