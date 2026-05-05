import json
import pandas as pd
import re
from datetime import datetime
from models import db, Sample, AnomalySample, DuplicateSample, AuditLog
from config import config
from flask import current_app

class ImportService:
    def __init__(self):
        self.config = config['default']
        self.required_fields = {
            'registration': ['sample_id'],
            'colorimeter': ['sample_id', 'delta_e'],
            'friction': ['sample_id', 'friction_dry_grade'],
            'washing': ['sample_id', 'washing_color_fastness'],
            'review': ['sample_id']
        }
    
    def validate_sample_id(self, sample_id):
        """验证样本编号格式是否有效
        有效格式示例：TF-2024-001, TEX-20241201-001
        """
        if not sample_id:
            return False, "样本编号为空"
        
        sample_id = str(sample_id).strip()
        if not sample_id:
            return False, "样本编号为空"
        
        # 基本格式检查：至少包含字母、数字和分隔符
        pattern = r'^[A-Za-z0-9\-_]+$'
        if not re.match(pattern, sample_id):
            return False, f"样本编号格式无效: {sample_id}"
        
        # 长度检查
        if len(sample_id) < 3 or len(sample_id) > 50:
            return False, f"样本编号长度超出范围(3-50字符): {sample_id}"
        
        return True, None
    
    def validate_colorimeter_range(self, delta_e, delta_l=None, delta_a=None, delta_b=None):
        """验证色差仪读数范围"""
        errors = []
        
        if delta_e is not None:
            try:
                delta_e = float(delta_e)
                if delta_e < self.config.COLOR_DELTA_E_MIN or delta_e > self.config.COLOR_DELTA_E_MAX:
                    errors.append(f"ΔE值超出范围({self.config.COLOR_DELTA_E_MIN}-{self.config.COLOR_DELTA_E_MAX}): {delta_e}")
            except (TypeError, ValueError):
                errors.append(f"ΔE值不是有效数字: {delta_e}")
        
        return errors
    
    def validate_grade_range(self, grade, grade_type, min_val, max_val):
        """验证测试等级范围"""
        if grade is None or pd.isna(grade):
            return []
        
        errors = []
        try:
            grade = int(float(grade))
            if grade < min_val or grade > max_val:
                errors.append(f"{grade_type}等级超出范围({min_val}-{max_val}): {grade}")
        except (TypeError, ValueError):
            errors.append(f"{grade_type}等级不是有效数字: {grade}")
        
        return errors
    
    def check_missing_fields(self, data, data_type):
        """检查缺失字段"""
        missing = []
        required = self.required_fields.get(data_type, ['sample_id'])
        
        for field in required:
            if field not in data or data[field] is None or pd.isna(data[field]):
                if isinstance(data[field], str) and data[field].strip() == '':
                    missing.append(field)
                elif data[field] is None or pd.isna(data[field]):
                    missing.append(field)
        
        return missing
    
    def import_csv(self, file_path, filename, data_type='registration'):
        """导入CSV文件"""
        results = {
            'total': 0,
            'success': 0,
            'anomalies': 0,
            'duplicates': 0,
            'errors': []
        }
        
        try:
            df = pd.read_csv(file_path)
            results['total'] = len(df)
            
            for idx, row in df.iterrows():
                line_number = idx + 2  # 考虑表头行
                row_dict = row.to_dict()
                
                try:
                    self._process_row(row_dict, filename, line_number, data_type, results)
                except Exception as e:
                    results['errors'].append(f"行{line_number}: 处理异常 - {str(e)}")
            
            # 记录审计日志
            audit_log = AuditLog(
                action='import',
                entity_type='csv_import',
                details=json.dumps({
                    'filename': filename,
                    'data_type': data_type,
                    'results': results
                }, ensure_ascii=False),
                import_source=filename
            )
            db.session.add(audit_log)
            db.session.commit()
            
        except Exception as e:
            results['errors'].append(f"文件读取失败: {str(e)}")
        
        return results
    
    def import_json(self, file_path, filename, data_type='colorimeter'):
        """导入JSON文件"""
        results = {
            'total': 0,
            'success': 0,
            'anomalies': 0,
            'duplicates': 0,
            'errors': []
        }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 支持数组格式和单个对象格式
            if isinstance(data, dict):
                data = [data]
            
            results['total'] = len(data)
            
            for idx, item in enumerate(data):
                line_number = idx + 1  # JSON中按索引计数
                
                try:
                    self._process_row(item, filename, line_number, data_type, results)
                except Exception as e:
                    results['errors'].append(f"条目{line_number}: 处理异常 - {str(e)}")
            
            # 记录审计日志
            audit_log = AuditLog(
                action='import',
                entity_type='json_import',
                details=json.dumps({
                    'filename': filename,
                    'data_type': data_type,
                    'results': results
                }, ensure_ascii=False),
                import_source=filename
            )
            db.session.add(audit_log)
            db.session.commit()
            
        except Exception as e:
            results['errors'].append(f"文件读取失败: {str(e)}")
        
        return results
    
    def _process_row(self, row_data, filename, line_number, data_type, results):
        """处理单行数据"""
        sample_id = str(row_data.get('sample_id', '')).strip() if row_data.get('sample_id') else ''
        
        # 1. 检查缺失字段
        missing_fields = self.check_missing_fields(row_data, data_type)
        if missing_fields:
            self._save_anomaly(
                row_data, filename, line_number,
                anomaly_type='missing_field',
                anomaly_reason=f"缺失必需字段: {', '.join(missing_fields)}",
                affected_fields=missing_fields,
                sample_id=sample_id
            )
            results['anomalies'] += 1
            return
        
        # 2. 验证样本编号
        valid_id, id_error = self.validate_sample_id(sample_id)
        if not valid_id:
            self._save_anomaly(
                row_data, filename, line_number,
                anomaly_type='invalid_id',
                anomaly_reason=id_error,
                affected_fields=['sample_id'],
                sample_id=sample_id
            )
            results['anomalies'] += 1
            return
        
        # 3. 验证数值范围
        range_errors = []
        affected_fields = []
        
        # 色差仪数据验证
        if data_type == 'colorimeter':
            delta_e = row_data.get('delta_e')
            ce_errors = self.validate_colorimeter_range(delta_e)
            range_errors.extend(ce_errors)
            if ce_errors:
                affected_fields.append('delta_e')
        
        # 摩擦测试验证
        if data_type == 'friction':
            dry_grade = row_data.get('friction_dry_grade')
            wet_grade = row_data.get('friction_wet_grade')
            
            dry_errors = self.validate_grade_range(dry_grade, '干摩擦', 
                                                    self.config.FRICTION_GRADE_MIN, 
                                                    self.config.FRICTION_GRADE_MAX)
            wet_errors = self.validate_grade_range(wet_grade, '湿摩擦',
                                                  self.config.FRICTION_GRADE_MIN,
                                                  self.config.FRICTION_GRADE_MAX)
            range_errors.extend(dry_errors)
            range_errors.extend(wet_errors)
            if dry_errors:
                affected_fields.append('friction_dry_grade')
            if wet_errors:
                affected_fields.append('friction_wet_grade')
        
        # 洗涤测试验证
        if data_type == 'washing':
            color_fastness = row_data.get('washing_color_fastness')
            staining = row_data.get('washing_staining')
            
            cf_errors = self.validate_grade_range(color_fastness, '色牢度',
                                                    self.config.WASHING_GRADE_MIN,
                                                    self.config.WASHING_GRADE_MAX)
            st_errors = self.validate_grade_range(staining, '沾色',
                                                    self.config.WASHING_GRADE_MIN,
                                                    self.config.WASHING_GRADE_MAX)
            range_errors.extend(cf_errors)
            range_errors.extend(st_errors)
            if cf_errors:
                affected_fields.append('washing_color_fastness')
            if st_errors:
                affected_fields.append('washing_staining')
        
        if range_errors:
            self._save_anomaly(
                row_data, filename, line_number,
                anomaly_type='out_of_range',
                anomaly_reason='; '.join(range_errors),
                affected_fields=affected_fields,
                sample_id=sample_id
            )
            results['anomalies'] += 1
            return
        
        # 4. 检查重复
        existing_sample = Sample.query.filter_by(sample_id=sample_id).first()
        
        if existing_sample:
            # 检查是否是更新操作还是真正的重复
            differing_fields = self._find_differing_fields(existing_sample, row_data, data_type)
            
            if differing_fields:
                # 有差异，保存为重复记录
                self._save_duplicate(
                    row_data, filename, line_number, sample_id,
                    existing_sample.id, differing_fields
                )
                results['duplicates'] += 1
                return
            else:
                # 完全相同，可能是重复导入
                self._save_anomaly(
                    row_data, filename, line_number,
                    anomaly_type='duplicate',
                    anomaly_reason=f"样本编号 {sample_id} 已存在且数据完全相同",
                    affected_fields=['sample_id'],
                    sample_id=sample_id
                )
                results['anomalies'] += 1
                return
        
        # 5. 保存正常样本
        self._save_sample(row_data, sample_id, filename, data_type)
        results['success'] += 1
    
    def _find_differing_fields(self, existing_sample, new_data, data_type):
        """查找与现有样本的差异字段"""
        differing = {}
        
        # 根据数据类型检查相关字段
        if data_type == 'registration':
            new_name = new_data.get('sample_name')
            new_fabric = new_data.get('fabric_type')
            
            if new_name and existing_sample.sample_name and str(new_name).strip() != str(existing_sample.sample_name).strip():
                differing['sample_name'] = {
                    'old': existing_sample.sample_name,
                    'new': str(new_name).strip()
                }
            if new_fabric and existing_sample.fabric_type and str(new_fabric).strip() != str(existing_sample.fabric_type).strip():
                differing['fabric_type'] = {
                    'old': existing_sample.fabric_type,
                    'new': str(new_fabric).strip()
                }
        
        elif data_type == 'colorimeter':
            for field in ['delta_e', 'delta_l', 'delta_a', 'delta_b']:
                new_val = new_data.get(field)
                old_val = getattr(existing_sample, field)
                if new_val is not None and not pd.isna(new_val):
                    try:
                        new_val_float = float(new_val)
                        if old_val is not None and abs(new_val_float - old_val) > 0.001:
                            differing[field] = {
                                'old': old_val,
                                'new': new_val_float
                            }
                    except (TypeError, ValueError):
                        pass
        
        elif data_type == 'friction':
            for field in ['friction_dry_grade', 'friction_wet_grade']:
                new_val = new_data.get(field)
                old_val = getattr(existing_sample, field)
                if new_val is not None and not pd.isna(new_val):
                    try:
                        new_val_int = int(float(new_val))
                        if old_val is not None and new_val_int != old_val:
                            differing[field] = {
                                'old': old_val,
                                'new': new_val_int
                            }
                    except (TypeError, ValueError):
                        pass
        
        elif data_type == 'washing':
            for field in ['washing_color_fastness', 'washing_staining']:
                new_val = new_data.get(field)
                old_val = getattr(existing_sample, field)
                if new_val is not None and not pd.isna(new_val):
                    try:
                        new_val_int = int(float(new_val))
                        if old_val is not None and new_val_int != old_val:
                            differing[field] = {
                                'old': old_val,
                                'new': new_val_int
                            }
                    except (TypeError, ValueError):
                        pass
        
        elif data_type == 'review':
            new_notes = new_data.get('review_notes')
            if new_notes and existing_sample.review_notes and str(new_notes).strip() != str(existing_sample.review_notes).strip():
                differing['review_notes'] = {
                    'old': existing_sample.review_notes,
                    'new': str(new_notes).strip()
                }
        
        return differing
    
    def _save_sample(self, row_data, sample_id, filename, data_type):
        """保存正常样本"""
        sample = Sample(
            sample_id=sample_id,
            import_source=filename
        )
        
        # 根据数据类型设置字段
        if data_type == 'registration':
            sample.sample_name = str(row_data.get('sample_name', '')).strip() if row_data.get('sample_name') else None
            sample.fabric_type = str(row_data.get('fabric_type', '')).strip() if row_data.get('fabric_type') else None
        
        elif data_type == 'colorimeter':
            for field in ['delta_e', 'delta_l', 'delta_a', 'delta_b']:
                val = row_data.get(field)
                if val is not None and not pd.isna(val):
                    try:
                        setattr(sample, field, float(val))
                    except (TypeError, ValueError):
                        pass
        
        elif data_type == 'friction':
            for field in ['friction_dry_grade', 'friction_wet_grade']:
                val = row_data.get(field)
                if val is not None and not pd.isna(val):
                    try:
                        setattr(sample, field, int(float(val)))
                    except (TypeError, ValueError):
                        pass
        
        elif data_type == 'washing':
            for field in ['washing_color_fastness', 'washing_staining']:
                val = row_data.get(field)
                if val is not None and not pd.isna(val):
                    try:
                        setattr(sample, field, int(float(val)))
                    except (TypeError, ValueError):
                        pass
        
        elif data_type == 'review':
            sample.review_notes = str(row_data.get('review_notes', '')).strip() if row_data.get('review_notes') else None
            sample.reviewed_by = str(row_data.get('reviewed_by', '')).strip() if row_data.get('reviewed_by') else None
            if row_data.get('reviewed_at'):
                try:
                    sample.reviewed_at = datetime.fromisoformat(str(row_data.get('reviewed_at')))
                except (ValueError, TypeError):
                    sample.reviewed_at = datetime.utcnow()
        
        # 计算初始风险
        sample.risk_score, sample.risk_level = self._calculate_risk(sample)
        
        db.session.add(sample)
        db.session.commit()
        
        return sample
    
    def _save_anomaly(self, row_data, filename, line_number, anomaly_type, anomaly_reason, affected_fields, sample_id=''):
        """保存异常样本"""
        anomaly = AnomalySample(
            original_filename=filename,
            line_number=line_number,
            sample_id=sample_id if sample_id else None,
            raw_data=json.dumps(row_data, ensure_ascii=False),
            anomaly_type=anomaly_type,
            anomaly_reason=anomaly_reason,
            affected_fields=json.dumps(affected_fields, ensure_ascii=False) if affected_fields else None
        )
        
        db.session.add(anomaly)
        db.session.commit()
        
        return anomaly
    
    def _save_duplicate(self, row_data, filename, line_number, sample_id, original_sample_id, differing_fields):
        """保存重复样本"""
        duplicate = DuplicateSample(
            sample_id=sample_id,
            original_sample_id=original_sample_id,
            source_filename=filename,
            line_number=line_number,
            raw_data=json.dumps(row_data, ensure_ascii=False),
            differing_fields=json.dumps(differing_fields, ensure_ascii=False)
        )
        
        db.session.add(duplicate)
        db.session.commit()
        
        return duplicate
    
    def _calculate_risk(self, sample):
        """计算样本风险评分和风险等级"""
        score = 0.0
        
        # 色差风险
        if sample.delta_e is not None:
            if sample.delta_e >= 4.0:
                score += 50  # 高风险
            elif sample.delta_e >= 3.0:
                score += 30  # 中风险
            elif sample.delta_e >= 2.0:
                score += 10  # 低风险
        
        # 摩擦测试风险
        if sample.friction_dry_grade is not None and sample.friction_dry_grade < 3:
            score += 25
        if sample.friction_wet_grade is not None and sample.friction_wet_grade < 3:
            score += 35
        
        # 洗涤测试风险
        if sample.washing_color_fastness is not None and sample.washing_color_fastness < 3:
            score += 30
        if sample.washing_staining is not None and sample.washing_staining < 3:
            score += 25
        
        # 确定风险等级
        if score >= 70:
            level = 'critical'
        elif score >= 40:
            level = 'warning'
        else:
            level = 'normal'
        
        return score, level
    
    def recalculate_risk(self, sample_id):
        """重新计算指定样本的风险"""
        sample = Sample.query.filter_by(sample_id=sample_id).first()
        if not sample:
            return None, "样本不存在"
        
        sample.risk_score, sample.risk_level = self._calculate_risk(sample)
        db.session.commit()
        
        return sample, None
    
    def fix_anomaly(self, anomaly_id, fix_data, fixed_by=None):
        """修复异常样本"""
        anomaly = AnomalySample.query.get(anomaly_id)
        if not anomaly:
            return None, "异常记录不存在"
        
        if anomaly.is_fixed:
            return None, "该异常已被修复"
        
        # 验证修复数据
        if 'sample_id' not in fix_data:
            return None, "修复数据必须包含样本编号"
        
        valid_id, id_error = self.validate_sample_id(fix_data['sample_id'])
        if not valid_id:
            return None, id_error
        
        # 检查样本编号是否已存在
        existing = Sample.query.filter_by(sample_id=fix_data['sample_id']).first()
        if existing:
            return None, f"样本编号 {fix_data['sample_id']} 已存在"
        
        # 创建新样本
        sample = Sample(
            sample_id=fix_data['sample_id'],
            sample_name=fix_data.get('sample_name'),
            fabric_type=fix_data.get('fabric_type'),
            import_source=f"修复自: {anomaly.original_filename}",
            status='fixed'
        )
        
        # 从原始数据和修复数据合并字段
        original_data = json.loads(anomaly.raw_data)
        
        # 合并修复数据
        for key, value in fix_data.items():
            if hasattr(sample, key) and value is not None:
                setattr(sample, key, value)
        
        # 从原始数据填充未修复的字段
        for key in ['delta_e', 'delta_l', 'delta_a', 'delta_b',
                    'friction_dry_grade', 'friction_wet_grade',
                    'washing_color_fastness', 'washing_staining',
                    'review_notes']:
            if getattr(sample, key) is None and key in original_data:
                val = original_data[key]
                if val is not None and not pd.isna(val):
                    try:
                        if key in ['delta_e', 'delta_l', 'delta_a', 'delta_b']:
                            setattr(sample, key, float(val))
                        elif key in ['friction_dry_grade', 'friction_wet_grade',
                                     'washing_color_fastness', 'washing_staining']:
                            setattr(sample, key, int(float(val)))
                        else:
                            setattr(sample, key, str(val).strip())
                    except (TypeError, ValueError):
                        pass
        
        # 计算风险
        sample.risk_score, sample.risk_level = self._calculate_risk(sample)
        
        # 更新异常记录
        anomaly.is_fixed = True
        anomaly.fixed_by = fixed_by
        anomaly.fixed_at = datetime.utcnow()
        anomaly.fix_notes = fix_data.get('fix_notes', '')
        anomaly.fixed_sample = sample
        
        db.session.add(sample)
        db.session.commit()
        
        # 记录审计日志
        audit_log = AuditLog(
            action='fix',
            entity_type='anomaly',
            entity_id=anomaly.id,
            details=json.dumps({
                'anomaly_id': anomaly.id,
                'new_sample_id': sample.sample_id,
                'fix_notes': fix_data.get('fix_notes', '')
            }, ensure_ascii=False),
            user=fixed_by
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return sample, None
