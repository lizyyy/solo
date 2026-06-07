import hashlib
import pandas as pd
from datetime import datetime
from models import db, ManualCorrectionSheet, ReviewSample, SheetChangeHistory, SampleChangeHistory
from config import Config


class ImportService:
    
    @staticmethod
    def calculate_file_hash(file_content):
        return hashlib.sha256(file_content).hexdigest()
    
    @staticmethod
    def generate_sample_unique_key(row):
        key_parts = []
        for col in ['original_text', 'model_prediction', 'manual_label']:
            if col in row and pd.notna(row[col]):
                key_parts.append(str(row[col]))
        combined = '|'.join(key_parts)
        return hashlib.md5(combined.encode('utf-8')).hexdigest()
    
    @staticmethod
    def check_duplicate_sheet(file_hash):
        existing = ManualCorrectionSheet.query.filter_by(
            file_hash=file_hash, 
            is_current=True
        ).first()
        return existing is not None
    
    @staticmethod
    def get_existing_sheet_by_hash(file_hash):
        return ManualCorrectionSheet.query.filter_by(
            file_hash=file_hash
        ).order_by(ManualCorrectionSheet.version.desc()).first()
    
    @staticmethod
    def import_correction_sheet(file_path, sheet_name, imported_by, file_content=None):
        if file_content:
            file_hash = ImportService.calculate_file_hash(file_content)
        else:
            with open(file_path, 'rb') as f:
                file_hash = ImportService.calculate_file_hash(f.read())
        
        existing_sheet = ImportService.get_existing_sheet_by_hash(file_hash)
        if existing_sheet and existing_sheet.is_current:
            return {
                'success': False,
                'message': '该改判表已存在，请勿重复导入',
                'existing_sheet_id': existing_sheet.id,
                'is_duplicate': True
            }
        
        df = pd.read_excel(file_path)
        
        if existing_sheet:
            return ImportService._update_existing_sheet(
                existing_sheet, df, file_hash, imported_by, sheet_name
            )
        else:
            return ImportService._create_new_sheet(
                df, file_hash, imported_by, sheet_name
            )
    
    @staticmethod
    def _create_new_sheet(df, file_hash, imported_by, sheet_name):
        sheet = ManualCorrectionSheet(
            sheet_name=sheet_name,
            file_hash=file_hash,
            imported_by=imported_by,
            total_samples=len(df),
            version=1,
            is_current=True
        )
        db.session.add(sheet)
        db.session.flush()
        
        ImportService._import_samples(df, sheet, imported_by, is_new_import=True)
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'成功导入 {len(df)} 条样本',
            'sheet_id': sheet.id,
            'sample_count': len(df),
            'is_duplicate': False,
            'version': 1
        }
    
    @staticmethod
    def _update_existing_sheet(existing_sheet, df, file_hash, imported_by, sheet_name):
        existing_samples = {s.unique_key: s for s in existing_sheet.samples}
        
        updated_count = 0
        added_count = 0
        changes = []
        
        for _, row in df.iterrows():
            unique_key = ImportService.generate_sample_unique_key(row)
            
            if unique_key in existing_samples:
                sample = existing_samples[unique_key]
                changed_fields = ImportService._update_sample_fields(sample, row, imported_by, changes)
                if changed_fields:
                    updated_count += 1
            else:
                ImportService._create_sample_from_row(row, existing_sheet, imported_by, unique_key)
                added_count += 1
        
        if updated_count > 0 or added_count > 0:
            old_version = existing_sheet.version
            existing_sheet.version = old_version + 1
            existing_sheet.total_samples = len(existing_sheet.samples)
            
            change_summary = f'更新{updated_count}条，新增{added_count}条'
            history = SheetChangeHistory(
                sheet_id=existing_sheet.id,
                changed_by=imported_by,
                change_type='reimport_update',
                change_summary=change_summary
            )
            db.session.add(history)
            
            db.session.commit()
        
        return {
            'success': True,
            'message': f'更新版本{existing_sheet.version}：更新{updated_count}条，新增{added_count}条',
            'sheet_id': existing_sheet.id,
            'updated_count': updated_count,
            'added_count': added_count,
            'is_duplicate': False,
            'version': existing_sheet.version
        }
    
    @staticmethod
    def _import_samples(df, sheet, imported_by, is_new_import=True):
        for _, row in df.iterrows():
            ImportService._create_sample_from_row(row, sheet, imported_by)
    
    @staticmethod
    def _create_sample_from_row(row, sheet, imported_by, unique_key=None):
        if unique_key is None:
            unique_key = ImportService.generate_sample_unique_key(row)
        
        model_confidence = float(row['model_confidence']) if 'model_confidence' in row and pd.notna(row['model_confidence']) else None
        is_low_conf = model_confidence is not None and model_confidence < Config.LOW_CONFIDENCE_THRESHOLD
        
        raw_remark_parts = []
        for col in row.index:
            if 'remark' in col.lower() or '备注' in col or 'note' in col.lower():
                if pd.notna(row[col]):
                    raw_remark_parts.append(f"{col}: {row[col]}")
        raw_remark = '\n'.join(raw_remark_parts) if raw_remark_parts else None
        
        sample = ReviewSample(
            unique_key=unique_key,
            correction_sheet_id=sheet.id,
            original_text=str(row['original_text']) if 'original_text' in row and pd.notna(row['original_text']) else None,
            model_prediction=str(row['model_prediction']) if 'model_prediction' in row and pd.notna(row['model_prediction']) else None,
            model_confidence=model_confidence,
            manual_label=str(row['manual_label']) if 'manual_label' in row and pd.notna(row['manual_label']) else None,
            status='low_confidence' if is_low_conf else 'pending',
            is_low_confidence=is_low_conf,
            masked_by_average=False,
            raw_remark=raw_remark
        )
        db.session.add(sample)
        return sample
    
    @staticmethod
    def _update_sample_fields(sample, row, changed_by, changes_list):
        changed_fields = []
        field_mapping = {
            'manual_label': 'manual_label',
            'model_prediction': 'model_prediction',
            'model_confidence': 'model_confidence',
            'original_text': 'original_text'
        }
        
        for row_col, model_field in field_mapping.items():
            if row_col in row and pd.notna(row[row_col]):
                new_val = str(row[row_col])
                old_val = str(getattr(sample, model_field) or '')
                if new_val != old_val:
                    history = SampleChangeHistory(
                        sample_id=sample.id,
                        changed_by=changed_by,
                        change_type='field_update',
                        field_name=model_field,
                        old_value=old_val,
                        new_value=new_val
                    )
                    db.session.add(history)
                    setattr(sample, model_field, new_val)
                    changed_fields.append(model_field)
        
        raw_remark_parts = []
        for col in row.index:
            if 'remark' in col.lower() or '备注' in col or 'note' in col.lower():
                if pd.notna(row[col]):
                    raw_remark_parts.append(f"{col}: {row[col]}")
        new_remark = '\n'.join(raw_remark_parts) if raw_remark_parts else None
        
        if new_remark != sample.raw_remark:
            history = SampleChangeHistory(
                sample_id=sample.id,
                changed_by=changed_by,
                change_type='remark_update',
                field_name='raw_remark',
                old_value=sample.raw_remark or '',
                new_value=new_remark or ''
            )
            db.session.add(history)
            sample.raw_remark = new_remark
            changed_fields.append('raw_remark')
        
        return changed_fields
