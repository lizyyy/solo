"""修复 database.py 的三个 bug"""
import re

with open('database.py', 'r') as f:
    content = f.read()

# 1. Add Dict to typing import
content = content.replace(
    'from typing import List, Optional, Tuple\n',
    'from typing import List, Optional, Tuple, Dict\n'
)

# 2. Fix add_anomaly_to_sample
old_anomaly = '''    def add_anomaly_to_sample(self, sample_id: int, anomaly_type: AnomalyType, operator: str):
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
            conn.commit()'''

new_anomaly = '''    def add_anomaly_to_sample(self, sample_id: int, anomaly_type: AnomalyType, operator: str):
        """给样本添加异常类型。如果异常已存在则跳过，不重复写审计日志。"""
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT anomaly_types, status FROM boundary_samples WHERE id = ?', (sample_id,))
            row = cursor.fetchone()
            if not row:
                return False

            types = json.loads(row['anomaly_types'])
            old_status = row['status']

            if anomaly_type.value in types:
                return False

            types.append(anomaly_type.value)

            cursor.execute('''
                UPDATE boundary_samples
                SET anomaly_types = ?, status = ?, updated_at = ?, last_updated_by = ?
                WHERE id = ?
            ''', (json.dumps(types), SampleStatus.PENDING_REVIEW.value, datetime.now().isoformat(), operator, sample_id))

            self._add_audit_log(conn, sample_id, "add_anomaly", old_status, SampleStatus.PENDING_REVIEW.value,
                              operator, f"添加异常: {anomaly_type.value}")
            conn.commit()
            return True'''

content = content.replace(old_anomaly, new_anomaly)

# 3. Add get_all_batch_feature_versions method
new_method = '''    def get_all_batch_feature_versions(self) -> Dict[str, set]:
        """
        查所有批次的特征版本分布：返回 {batch_id: {feature_version, ...}}
        自检用，直接 JOIN 查数据库，不依赖 list_samples 的关联数据
        """
        with self.get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT bs.batch_id, fv.feature_version
                FROM boundary_samples bs
                JOIN feature_versions fv ON fv.sample_id = bs.id
            """)
            rows = cursor.fetchall()
            result: Dict[str, set] = {}
            for r in rows:
                bid = r['batch_id']
                if bid not in result:
                    result[bid] = set()
                result[bid].add(r['feature_version'])
            return result

    # ==================== 审计日志相关 ===================='''

content = content.replace('    # ==================== 审计日志相关 ====================', new_method)

with open('database.py', 'w') as f:
    f.write(content)

print("OK - database.py patched")
