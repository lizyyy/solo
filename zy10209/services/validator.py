from typing import Dict, List, Any, Tuple
from database.db import Database


class BusinessValidator:
    def __init__(self, db: Database):
        self.db = db
    
    def validate_sampling_no_duplicates(self) -> List[Dict[str, Any]]:
        issues = []
        samplings = self.db.get_all_samplings()
        seen = {}
        for s in samplings:
            no = s['sampling_no']
            if no in seen:
                issues.append({
                    "type": "采样号重复",
                    "sampling_no": no,
                    "details": f"编号 {no} 出现多次"
                })
            seen[no] = True
        return issues
    
    def validate_test_without_sampling(self) -> List[Dict[str, Any]]:
        issues = []
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT t.sampling_no, t.test_date, t.status
                FROM test_results t
                LEFT JOIN samplings s ON t.sampling_no = s.sampling_no
                WHERE s.id IS NULL
            ''')
            for row in cursor.fetchall():
                issues.append({
                    "type": "检验单无采样记录",
                    "sampling_no": row['sampling_no'],
                    "details": f"检验日期: {row['test_date']}，状态: {row['status']}"
                })
        return issues
    
    def validate_abnormal_completed_without_notification(self) -> List[Dict[str, Any]]:
        issues = []
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT DISTINCT t.sampling_no, t.test_date, t.status
                FROM test_results t
                JOIN abnormal_indicators ai ON t.id = ai.test_result_id
                LEFT JOIN notifications n ON t.sampling_no = n.sampling_no
                WHERE t.status = 'completed' AND n.id IS NULL
            ''')
            for row in cursor.fetchall():
                issues.append({
                    "type": "异常已完成但未通知",
                    "sampling_no": row['sampling_no'],
                    "details": f"检验日期: {row['test_date']}，有异常指标但无通知记录"
                })
        return issues
    
    def validate_followup_conflicts(self) -> List[Dict[str, Any]]:
        issues = []
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    f1.sampling_no,
                    f1.appointment_date,
                    COUNT(*) as count
                FROM followup_appointments f1
                WHERE f1.status = 'pending'
                GROUP BY f1.sampling_no, f1.appointment_date
                HAVING COUNT(*) > 1
            ''')
            for row in cursor.fetchall():
                issues.append({
                    "type": "复查日期冲突",
                    "sampling_no": row['sampling_no'],
                    "details": f"日期 {row['appointment_date']} 有 {row['count']} 个待处理预约"
                })
        return issues
    
    def run_all_validations(self) -> Dict[str, Any]:
        results = {
            "issues": [],
            "summary": {},
            "has_errors": False
        }
        
        validations = [
            ("采样号重复", self.validate_sampling_no_duplicates),
            ("检验单无采样记录", self.validate_test_without_sampling),
            ("异常已完成但未通知", self.validate_abnormal_completed_without_notification),
            ("复查日期冲突", self.validate_followup_conflicts)
        ]
        
        for name, validator in validations:
            issues = validator()
            if issues:
                results["issues"].extend(issues)
                results["summary"][name] = len(issues)
                results["has_errors"] = True
            else:
                results["summary"][name] = 0
        
        return results
    
    def can_mark_completed(self, sampling_no: str) -> Tuple[bool, str]:
        test_result = self.db.get_test_result(sampling_no)
        if not test_result:
            return False, "未找到检验结果"
        
        has_abnormal = self.db.has_any_abnormal(sampling_no)
        if has_abnormal:
            has_notification = self.db.has_any_notification(sampling_no)
            if not has_notification:
                return False, "存在异常指标但无通知记录，不能标记完成"
        
        return True, "可以标记完成"
    
    def mark_test_completed(self, sampling_no: str) -> Tuple[bool, str]:
        can_do, reason = self.can_mark_completed(sampling_no)
        if not can_do:
            return False, reason
        
        return self.db.update_test_result_status(sampling_no, 'completed')
