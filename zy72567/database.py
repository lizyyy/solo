"""
数据库操作层
统一数据访问入口，确保导出/页面/接口读同一份结果
"""
import sqlite3
import json
from datetime import datetime
from typing import List, Optional, Tuple
from contextlib import contextmanager

from models import (
    BoundarySample, YAMLVersion, YAMLLineRecord,
    EvaluationSlice, FeatureVersion, SampleStatus, AnomalyType,
    init_db
)


class Database:
    def __init__(self, db_path: str = "boundary_samples.db"):
        self.db_path = db_path
        init_db(db_path)
    
    @contextmanager
    def get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _row_to_sample(self, row: sqlite3.Row) -> BoundarySample:
        """将数据库行转换为样本对象"""
        sample = BoundarySample(
            id=row['id'],
            sample_key=row['sample_key'],
            batch_id=row['batch_id'],
            text_content=row['text_content'],
            predicted_category=row['predicted_category'],
            actual_category=row['actual_category'],
            status=SampleStatus(row['status']),
            anomaly_types=[AnomalyType(t) for t in json.loads(row['anomaly_types'])],
            yaml_version_id=row['yaml_version_id'],
            yaml_line_number=row['yaml_line_number'],
            created_at=datetime.fromisoformat(row['created_at']) if isinstance(row['created_at'], str) else row['created_at'],
            updated_at=datetime.fromisoformat(row['updated_at']) if isinstance(row['updated_at'], str) else row['updated_at'],
            last_updated_by=row['last_updated_by']
        )
        return sample
    
    # ==================== YAML版本相关 ====================
    
    def save_yaml_version(self, version: YAMLVersion, lines: List[YAMLLineRecord]) -> int:
        """保存YAML版本及其行记录，返回版本ID"""
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO yaml_versions 
                (version_name, import_time, imported_by, file_name, raw_content, line_count, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                version.version_name,
                version.import_time.isoformat(),
                version.imported_by,
                version.file_name,
                version.raw_content,
                version.line_count,
                1 if version.is_active else 0
            ))
            version_id = cursor.lastrowid
            
            for line in lines:
                line.yaml_version_id = version_id
                cursor.execute('''
                    INSERT INTO yaml_line_records
                    (yaml_version_id, line_number, original_content, current_content, 
                     is_modified, modified_by, modified_at, remark)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    version_id,
                    line.line_number,
                    line.original_content,
                    line.current_content,
                    1 if line.is_modified else 0,
                    line.modified_by,
                    line.modified_at.isoformat() if line.modified_at else None,
                    line.remark
                ))
            
            conn.commit()
            return version_id
    
    def get_yaml_version(self, version_id: int) -> Optional[YAMLVersion]:
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM yaml_versions WHERE id = ?', (version_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return YAMLVersion(
                id=row['id'],
                version_name=row['version_name'],
                import_time=datetime.fromisoformat(row['import_time']),
                imported_by=row['imported_by'],
                file_name=row['file_name'],
                raw_content=row['raw_content'],
                line_count=row['line_count'],
                is_active=row['is_active'] == 1
            )
    
    def get_yaml_lines(self, version_id: int) -> List[YAMLLineRecord]:
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM yaml_line_records WHERE yaml_version_id = ? ORDER BY line_number', (version_id,))
            rows = cursor.fetchall()
            return [YAMLLineRecord(
                id=r['id'],
                yaml_version_id=r['yaml_version_id'],
                line_number=r['line_number'],
                original_content=r['original_content'],
                current_content=r['current_content'],
                is_modified=r['is_modified'] == 1,
                modified_by=r['modified_by'],
                modified_at=datetime.fromisoformat(r['modified_at']) if r['modified_at'] else None,
                remark=r['remark']
            ) for r in rows]
    
    def update_yaml_line(self, line_id: int, new_content: str, modified_by: str, remark: str = ""):
        """更新YAML某一行内容，记录改动"""
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM yaml_line_records WHERE id = ?', (line_id,))
            row = cursor.fetchone()
            if not row:
                return
            
            cursor.execute('''
                UPDATE yaml_line_records
                SET current_content = ?, is_modified = 1, modified_by = ?, modified_at = ?, remark = ?
                WHERE id = ?
            ''', (new_content, modified_by, datetime.now().isoformat(), remark, line_id))
            conn.commit()
    
    # ==================== 边界样本相关 ====================
    
    def save_sample(self, sample: BoundarySample) -> int:
        """保存或更新边界样本"""
        with self.get_conn() as conn:
            cursor = conn.cursor()
            
            if sample.id is None:
                cursor.execute('''
                    INSERT INTO boundary_samples
                    (sample_key, batch_id, text_content, predicted_category, actual_category,
                     status, anomaly_types, yaml_version_id, yaml_line_number,
                     created_at, updated_at, last_updated_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    sample.sample_key,
                    sample.batch_id,
                    sample.text_content,
                    sample.predicted_category,
                    sample.actual_category,
                    sample.status.value,
                    json.dumps([t.value for t in sample.anomaly_types]),
                    sample.yaml_version_id,
                    sample.yaml_line_number,
                    sample.created_at.isoformat(),
                    sample.updated_at.isoformat(),
                    sample.last_updated_by
                ))
                sample_id = cursor.lastrowid
            else:
                sample.updated_at = datetime.now()
                cursor.execute('''
                    UPDATE boundary_samples
                    SET sample_key = ?, batch_id = ?, text_content = ?, predicted_category = ?,
                        actual_category = ?, status = ?, anomaly_types = ?, yaml_version_id = ?,
                        yaml_line_number = ?, updated_at = ?, last_updated_by = ?
                    WHERE id = ?
                ''', (
                    sample.sample_key,
                    sample.batch_id,
                    sample.text_content,
                    sample.predicted_category,
                    sample.actual_category,
                    sample.status.value,
                    json.dumps([t.value for t in sample.anomaly_types]),
                    sample.yaml_version_id,
                    sample.yaml_line_number,
                    sample.updated_at.isoformat(),
                    sample.last_updated_by,
                    sample.id
                ))
                sample_id = sample.id
            
            conn.commit()
            return sample_id
    
    def get_sample(self, sample_id: int, include_related: bool = True) -> Optional[BoundarySample]:
        """
        获取单个样本（统一读取入口，页面/接口/导出都走这里
        """
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM boundary_samples WHERE id = ?', (sample_id,))
            row = cursor.fetchone()
            if not row:
                return None
            
            sample = self._row_to_sample(row)
            
            if include_related:
                sample.yaml_lines = self.get_yaml_lines(sample.yaml_version_id)
                sample.slices = self.get_slices_by_sample(sample_id)
                sample.feature_versions = self.get_feature_versions_by_sample(sample_id)
            
            return sample
    
    def get_sample_by_key(self, sample_key: str) -> Optional[BoundarySample]:
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM boundary_samples WHERE sample_key = ?', (sample_key,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_sample(row)
    
    def list_samples(
        self,
        status: Optional[SampleStatus] = None,
        batch_id: Optional[str] = None,
        has_anomaly: Optional[bool] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[BoundarySample], int]:
        """
        统一的样本列表查询入口
        页面展示、API接口、文件导出全部走这里，保证数据一致
        """
        offset = (page - 1) * page_size
        
        conditions = []
        params = []
        
        if status:
            conditions.append("status = ?")
            params.append(status.value)
        if batch_id:
            conditions.append("batch_id = ?")
            params.append(batch_id)
        if has_anomaly is True:
            conditions.append("json_array_length(anomaly_types) > 0")
        elif has_anomaly is False:
            conditions.append("json_array_length(anomaly_types) = 0")
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        with self.get_conn() as conn:
            cursor = conn.cursor()
            
            cursor.execute(f'''
                SELECT COUNT(*) as total FROM boundary_samples {where_clause}
            ''', params)
            total = cursor.fetchone()['total']
            
            cursor.execute(f'''
                SELECT * FROM boundary_samples {where_clause}
                ORDER BY updated_at DESC
                LIMIT ? OFFSET ?
            ''', params + [page_size, offset])
            
            rows = cursor.fetchall()
            samples = [self._row_to_sample(r) for r in rows]
            
            return samples, total
    
    def check_duplicate_sample_key(self, sample_key: str) -> bool:
        """检查sample_key是否已存在（重复导入检测用）"""
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) as cnt FROM boundary_samples WHERE sample_key = ?', (sample_key,))
            return cursor.fetchone()['cnt'] > 0
    
    def count_samples_in_batch(self, batch_id: str) -> int:
        """统计某个批次的样本数"""
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) as cnt FROM boundary_samples WHERE batch_id = ?', (batch_id,))
            return cursor.fetchone()['cnt']
    
    def add_anomaly_to_sample(self, sample_id: int, anomaly_type: AnomalyType, operator: str):
        """给样本添加异常类型"""
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT anomaly_types FROM boundary_samples WHERE id = ?', (sample_id,))
            row = cursor.fetchone()
            if not row:
                return
            
            types = json.loads(row['anomaly_types'])
            if anomaly_type.value not in types:
                types.append(anomaly_type.value)
            
            cursor.execute('''
                UPDATE boundary_samples
                SET anomaly_types = ?, status = ?, updated_at = ?, last_updated_by = ?
                WHERE id = ?
            ''', (json.dumps(types), SampleStatus.PENDING_REVIEW.value, datetime.now().isoformat(), operator, sample_id))
            
            self._add_audit_log(conn, sample_id, "add_anomaly", None, SampleStatus.PENDING_REVIEW.value,
                              operator, f"添加异常: {anomaly_type.value}")
            conn.commit()
    
    def update_sample_status(self, sample_id: int, new_status: SampleStatus, operator: str, remark: str = ""):
        """更新样本状态"""
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT status FROM boundary_samples WHERE id = ?', (sample_id,))
            row = cursor.fetchone()
            if not row:
                return
            
            old_status = row['status']
            
            cursor.execute('''
                UPDATE boundary_samples
                SET status = ?, updated_at = ?, last_updated_by = ?
                WHERE id = ?
            ''', (new_status.value, datetime.now().isoformat(), operator, sample_id))
            
            self._add_audit_log(conn, sample_id, "status_change", old_status, new_status.value,
                              operator, remark)
            conn.commit()
    
    # ==================== 评测切片相关 ====================
    
    def save_slice(self, slice_obj: EvaluationSlice) -> int:
        with self.get_conn() as conn:
            cursor = conn.cursor()
            if slice_obj.id is None:
                cursor.execute('''
                    INSERT INTO evaluation_slices (sample_id, slice_data, viewed_by, viewed_at, viewer_remark)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    slice_obj.sample_id,
                    slice_obj.slice_data,
                    slice_obj.viewed_by,
                    slice_obj.viewed_at.isoformat() if slice_obj.viewed_at else None,
                    slice_obj.viewer_remark
                ))
                slice_id = cursor.lastrowid
            else:
                cursor.execute('''
                    UPDATE evaluation_slices
                    SET sample_id = ?, slice_data = ?, viewed_by = ?, viewed_at = ?, viewer_remark = ?
                    WHERE id = ?
                ''', (
                    slice_obj.sample_id,
                    slice_obj.slice_data,
                    slice_obj.viewed_by,
                    slice_obj.viewed_at.isoformat() if slice_obj.viewed_at else None,
                    slice_obj.viewer_remark,
                    slice_obj.id
                ))
                slice_id = slice_obj.id
            conn.commit()
            return slice_id
    
    def get_slices_by_sample(self, sample_id: int) -> List[EvaluationSlice]:
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM evaluation_slices WHERE sample_id = ?', (sample_id,))
            rows = cursor.fetchall()
            return [EvaluationSlice(
                id=r['id'],
                sample_id=r['sample_id'],
                slice_data=r['slice_data'],
                viewed_by=r['viewed_by'],
                viewed_at=datetime.fromisoformat(r['viewed_at']) if r['viewed_at'] else None,
                viewer_remark=r['viewer_remark']
            ) for r in rows]
    
    def mark_slice_viewed(self, slice_id: int, viewed_by: str, remark: str = ""):
        """老唐标记已查看评测切片"""
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE evaluation_slices
                SET viewed_by = ?, viewed_at = ?, viewer_remark = ?
                WHERE id = ?
            ''', (viewed_by, datetime.now().isoformat(), remark, slice_id))
            conn.commit()
    
    # ==================== 特征版本相关 ====================
    
    def save_feature_version(self, fv: FeatureVersion) -> int:
        with self.get_conn() as conn:
            cursor = conn.cursor()
            if fv.id is None:
                cursor.execute('''
                    INSERT INTO feature_versions (sample_id, feature_version, updated_by, updated_at, update_remark)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    fv.sample_id,
                    fv.feature_version,
                    fv.updated_by,
                    fv.updated_at.isoformat() if fv.updated_at else datetime.now().isoformat(),
                    fv.update_remark
                ))
                fv_id = cursor.lastrowid
            else:
                cursor.execute('''
                    UPDATE feature_versions
                    SET sample_id = ?, feature_version = ?, updated_by = ?, updated_at = ?, update_remark = ?
                    WHERE id = ?
                ''', (
                    fv.sample_id,
                    fv.feature_version,
                    fv.updated_by,
                    fv.updated_at.isoformat() if fv.updated_at else datetime.now().isoformat(),
                    fv.update_remark,
                    fv.id
                ))
                fv_id = fv.id
            conn.commit()
            return fv_id
    
    def get_feature_versions_by_sample(self, sample_id: int) -> List[FeatureVersion]:
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM feature_versions WHERE sample_id = ?', (sample_id,))
            rows = cursor.fetchall()
            return [FeatureVersion(
                id=r['id'],
                sample_id=r['sample_id'],
                feature_version=r['feature_version'],
                updated_by=r['updated_by'],
                updated_at=datetime.fromisoformat(r['updated_at']),
                update_remark=r['update_remark']
            ) for r in rows]
    
    # ==================== 审计日志相关 ====================
    
    def _add_audit_log(self, conn, sample_id, action, old_status, new_status, operator, remark="", detail=""):
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO audit_logs (sample_id, action, old_status, new_status, operator, operate_time, remark, detail)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (sample_id, action, old_status, new_status, operator, datetime.now().isoformat(), remark, detail))
    
    def get_audit_logs(self, sample_id: int) -> List[dict]:
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM audit_logs WHERE sample_id = ? ORDER BY operate_time DESC
            ''', (sample_id,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
