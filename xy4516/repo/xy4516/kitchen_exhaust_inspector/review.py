from datetime import datetime
from .models import Risk, Review
from .db import get_db

class ReviewManager:
    """复核管理器"""
    
    # 复核结果类型
    REVIEW_RESULTS = {
        'CONFIRMED': 'confirmed',      # 确认风险属实
        'FALSE_ALARM': 'false_alarm',  # 误报
        'RESOLVED': 'resolved',        # 已解决
    }
    
    def __init__(self):
        pass
    
    def add_review(self, risk_id, reviewer, review_result, comments=''):
        """添加复核记录"""
        # 验证风险存在
        risk = Risk.get_by_id(risk_id)
        if not risk:
            raise ValueError(f"风险记录不存在: {risk_id}")
        
        # 验证复核结果
        valid_results = list(self.REVIEW_RESULTS.values())
        if review_result not in valid_results:
            raise ValueError(f"无效的复核结果: {review_result}，有效值: {valid_results}")
        
        # 创建复核记录
        review_id = Review.create(
            risk_id=risk_id,
            reviewer=reviewer,
            review_result=review_result,
            comments=comments
        )
        
        return Review.get_by_id(review_id)
    
    def get_reviews_by_risk(self, risk_id):
        """获取指定风险的所有复核记录"""
        return Review.get_all(risk_id=risk_id)
    
    def get_reviews_by_reviewer(self, reviewer):
        """获取指定复核人的所有复核记录"""
        return Review.get_all(reviewer=reviewer)
    
    def get_unreviewed_risks(self, batch_id=None):
        """获取未复核的风险"""
        conn = get_db()
        cursor = conn.cursor()
        
        if batch_id:
            cursor.execute('''
                SELECT r.* FROM risks r
                LEFT JOIN reviews rv ON r.id = rv.risk_id
                WHERE r.batch_id = ? AND rv.id IS NULL
            ''', (batch_id,))
        else:
            cursor.execute('''
                SELECT r.* FROM risks r
                LEFT JOIN reviews rv ON r.id = rv.risk_id
                WHERE rv.id IS NULL
            ''')
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_reviewed_risks(self, batch_id=None, review_result=None):
        """获取已复核的风险"""
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT r.*, rv.reviewer, rv.review_date, rv.review_result, rv.comments
            FROM risks r
            JOIN reviews rv ON r.id = rv.risk_id
        '''
        conditions = []
        params = []
        
        if batch_id:
            conditions.append('r.batch_id = ?')
            params.append(batch_id)
        
        if review_result:
            conditions.append('rv.review_result = ?')
            params.append(review_result)
        
        if conditions:
            query += ' WHERE ' + ' AND '.join(conditions)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_review_stats(self, batch_id=None):
        """获取复核统计"""
        conn = get_db()
        cursor = conn.cursor()
        
        stats = {
            'total_risks': 0,
            'unreviewed': 0,
            'reviewed': 0,
            'by_result': {
                'confirmed': 0,
                'false_alarm': 0,
                'resolved': 0
            }
        }
        
        # 总风险数
        if batch_id:
            cursor.execute('SELECT COUNT(*) FROM risks WHERE batch_id = ?', (batch_id,))
        else:
            cursor.execute('SELECT COUNT(*) FROM risks')
        stats['total_risks'] = cursor.fetchone()[0]
        
        # 未复核数
        if batch_id:
            cursor.execute('''
                SELECT COUNT(DISTINCT r.id) FROM risks r
                LEFT JOIN reviews rv ON r.id = rv.risk_id
                WHERE r.batch_id = ? AND rv.id IS NULL
            ''', (batch_id,))
        else:
            cursor.execute('''
                SELECT COUNT(DISTINCT r.id) FROM risks r
                LEFT JOIN reviews rv ON r.id = rv.risk_id
                WHERE rv.id IS NULL
            ''')
        stats['unreviewed'] = cursor.fetchone()[0]
        
        # 已复核数
        stats['reviewed'] = stats['total_risks'] - stats['unreviewed']
        
        # 按结果统计
        query = '''
            SELECT rv.review_result, COUNT(*) as cnt
            FROM reviews rv
            JOIN risks r ON rv.risk_id = r.id
        '''
        params = []
        if batch_id:
            query += ' WHERE r.batch_id = ?'
            params.append(batch_id)
        query += ' GROUP BY rv.review_result'
        
        cursor.execute(query, params)
        for row in cursor.fetchall():
            result = row[0]
            count = row[1]
            if result in stats['by_result']:
                stats['by_result'][result] = count
        
        conn.close()
        return stats
    
    def list_risks_for_review(self, batch_id=None, risk_level=None, store_code=None):
        """列出待复核的风险"""
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT r.* FROM risks r
            LEFT JOIN reviews rv ON r.id = rv.risk_id
            WHERE rv.id IS NULL
        '''
        conditions = []
        params = []
        
        if batch_id:
            conditions.append('r.batch_id = ?')
            params.append(batch_id)
        
        if risk_level:
            conditions.append('r.risk_level = ?')
            params.append(risk_level)
        
        if store_code:
            conditions.append('r.store_code = ?')
            params.append(store_code)
        
        if conditions:
            query += ' AND ' + ' AND '.join(conditions)
        
        query += ' ORDER BY r.risk_level DESC, r.detected_at DESC'
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
