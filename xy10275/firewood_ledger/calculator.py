"""
消耗核算模块 - 核心业务逻辑
根据房间炉具类型、入住天数核算柴火消耗
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date, timedelta
from .database import Database
from .models import RoomManager, StoveManager, StayManager, FirewoodInManager


class ConsumptionCalculator:
    """消耗计算器"""
    
    # 冬季取暖月份（根据乡村实际情况）
    HEATING_SEASON_MONTHS = [11, 12, 1, 2, 3]  # 11月到次年3月
    
    def __init__(self, db: Database):
        self.db = db
        self.stove_manager = StoveManager(db)
        self.stay_manager = StayManager(db)
        self.firewood_manager = FirewoodInManager(db)
    
    def _is_heating_season(self, target_date: date) -> bool:
        """判断是否为取暖季"""
        return target_date.month in self.HEATING_SEASON_MONTHS
    
    def _parse_date(self, date_str: str) -> date:
        """解析日期字符串"""
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    
    def _get_heating_days(self, check_in: date, 
                          check_out: Optional[date] = None) -> List[date]:
        """
        获取入住期间的取暖天数
        返回日期列表（仅限取暖季的日期）
        """
        if check_out is None:
            check_out = date.today()
        
        days = []
        current = check_in
        while current < check_out:
            if self._is_heating_season(current):
                days.append(current)
            current += timedelta(days=1)
        
        return days
    
    def calculate_stay_consumption(self, stay_id: int) -> Dict:
        """
        计算单个入住记录的消耗
        返回：{stay_id, days_used, estimated_total, details: [...]}
        """
        stay = self.stay_manager.get_stay(stay_id)
        if not stay:
            raise ValueError(f"入住记录不存在: {stay_id}")
        
        room_id = stay['room_id']
        check_in = self._parse_date(stay['check_in_date'])
        check_out = self._parse_date(stay['check_out_date']) if stay['check_out_date'] else None
        
        # 获取房间炉具
        stoves = self.stove_manager.get_room_stoves(room_id)
        if not stoves:
            return {
                'stay_id': stay_id,
                'stay_code': stay['stay_code'],
                'room_number': stay['room_number'],
                'days_used': 0,
                'estimated_total': 0.0,
                'details': [],
                'warning': '房间未配置炉具',
                'has_error': True
            }
        
        # 计算取暖天数
        heating_days = self._get_heating_days(check_in, check_out)
        
        details = []
        total_consumption = 0.0
        
        for stove in stoves:
            for heating_day in heating_days:
                estimated = stove['daily_consumption_kg']
                total_consumption += estimated
                
                details.append({
                    'stove_id': stove['id'],
                    'stove_type': stove['stove_type'],
                    'consumption_date': heating_day.strftime('%Y-%m-%d'),
                    'daily_consumption_kg': stove['daily_consumption_kg'],
                    'estimated_kg': estimated
                })
        
        return {
            'stay_id': stay_id,
            'stay_code': stay['stay_code'],
            'room_number': stay['room_number'],
            'check_in': stay['check_in_date'],
            'check_out': stay['check_out_date'],
            'guest_name': stay['guest_name'],
            'guest_count': stay['guest_count'],
            'total_heating_days': len(heating_days),
            'estimated_total': total_consumption,
            'stove_count': len(stoves),
            'details': details,
            'has_error': False
        }
    
    def run_consumption_check(self, 
                              start_date: str = None,
                              end_date: str = None,
                              status: str = None) -> Tuple[List[Dict], List[Dict]]:
        """
        执行消耗核算检查
        返回：(正常记录列表, 异常记录列表)
        """
        stays = self.stay_manager.list_stays(
            status=status, 
            start_date=start_date,
            end_date=end_date
        )
        
        normal_records = []
        abnormal_records = []
        
        for stay in stays:
            try:
                result = self.calculate_stay_consumption(stay['id'])
                if result.get('has_error'):
                    abnormal_records.append(result)
                else:
                    normal_records.append(result)
            except Exception as e:
                abnormal_records.append({
                    'stay_id': stay['id'],
                    'stay_code': stay['stay_code'],
                    'room_number': stay['room_number'],
                    'error': str(e)
                })
        
        return normal_records, abnormal_records
    
    def save_consumption_results(self, results: List[Dict]) -> int:
        """
        保存核算结果到数据库
        支持重复运行：已存在则更新
        """
        saved_count = 0
        
        for result in results:
            if result.get('has_error'):
                continue
            
            stay_id = result['stay_id']
            
            for detail in result.get('details', []):
                # 检查是否已存在
                existing = self.db.query_one(
                    '''SELECT id FROM consumption 
                       WHERE stay_id = ? AND stove_id = ? AND consumption_date = ?''',
                    (stay_id, detail['stove_id'], detail['consumption_date'])
                )
                
                if existing:
                    # 更新
                    self.db.execute(
                        '''UPDATE consumption 
                           SET estimated_kg = ?, verification_status = 'rechecked'
                           WHERE id = ?''',
                        (detail['estimated_kg'], existing['id'])
                    )
                else:
                    # 新增
                    self.db.execute(
                        '''INSERT INTO consumption 
                           (stay_id, stove_id, consumption_date, days_used, 
                            estimated_kg, verification_status)
                           VALUES (?, ?, ?, 1, ?, 'calculated')''',
                        (stay_id, detail['stove_id'], detail['consumption_date'],
                         detail['estimated_kg'])
                    )
                
                saved_count += 1
        
        return saved_count
    
    def get_statistics(self, start_date: str = None, 
                       end_date: str = None) -> Dict:
        """
        获取统计数据
        """
        # 总入库
        total_in = self.firewood_manager.get_total_in(start_date, end_date)
        
        # 总估算消耗
        query = '''
            SELECT SUM(estimated_kg) as total_estimated
            FROM consumption
            WHERE 1=1
        '''
        params = []
        
        if start_date:
            query += " AND consumption_date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND consumption_date <= ?"
            params.append(end_date)
        
        row = self.db.query_one(query, tuple(params) if params else None)
        total_estimated = row['total_estimated'] or 0.0
        
        # 按炉具类型统计
        stove_stats = self.db.query('''
            SELECT s.stove_type, 
                   COUNT(DISTINCT c.stay_id) as stay_count,
                   SUM(c.estimated_kg) as total_consumption,
                   AVG(s.daily_consumption_kg) as avg_daily_rate
            FROM consumption c
            JOIN stoves s ON c.stove_id = s.id
            GROUP BY s.stove_type
            ORDER BY total_consumption DESC
        ''')
        
        # 按房间统计
        room_stats = self.db.query('''
            SELECT r.room_number, r.name,
                   COUNT(DISTINCT c.stay_id) as stay_count,
                   SUM(c.estimated_kg) as total_consumption
            FROM consumption c
            JOIN stays s ON c.stay_id = s.id
            JOIN rooms r ON s.room_id = r.id
            GROUP BY r.id
            ORDER BY total_consumption DESC
        ''')
        
        return {
            'period': {
                'start_date': start_date,
                'end_date': end_date
            },
            'inventory': {
                'total_in_kg': total_in,
                'total_estimated_kg': total_estimated,
                'remaining_kg': total_in - total_estimated
            },
            'stove_type_breakdown': [dict(row) for row in stove_stats],
            'room_breakdown': [dict(row) for row in room_stats]
        }
    
    def find_anomalies(self) -> List[Dict]:
        """
        查询异常记录
        """
        anomalies = []
        
        # 1. 入住记录没有对应炉具
        stays_without_stove = self.db.query('''
            SELECT s.id, s.stay_code, s.check_in_date, 
                   r.room_number, r.name as room_name
            FROM stays s
            JOIN rooms r ON s.room_id = r.id
            WHERE NOT EXISTS (
                SELECT 1 FROM stoves st 
                WHERE st.room_id = r.id AND st.is_active = 1
            )
        ''')
        for row in stays_without_stove:
            anomalies.append({
                'type': 'room_without_stove',
                'severity': 'high',
                'message': f"房间 {row['room_number']} 没有配置炉具",
                'stay_code': row['stay_code'],
                'room_number': row['room_number']
            })
        
        # 2. 已退房但未设置退房日期
        missing_checkout = self.db.query('''
            SELECT id, stay_code, check_in_date, status
            FROM stays
            WHERE status = 'checked_out' 
              AND (check_out_date IS NULL OR check_out_date = '')
        ''')
        for row in missing_checkout:
            anomalies.append({
                'type': 'missing_checkout_date',
                'severity': 'medium',
                'message': f"入住记录 {row['stay_code']} 已标记退房但缺少退房日期",
                'stay_code': row['stay_code']
            })
        
        # 3. 炉具日消耗量异常（过高或过低）
        abnormal_stoves = self.db.query('''
            SELECT s.id, s.stove_type, s.daily_consumption_kg,
                   r.room_number
            FROM stoves s
            JOIN rooms r ON s.room_id = r.id
            WHERE s.is_active = 1
              AND (s.daily_consumption_kg < 1 OR s.daily_consumption_kg > 15)
        ''')
        for row in abnormal_stoves:
            anomalies.append({
                'type': 'abnormal_consumption_rate',
                'severity': 'low',
                'message': f"房间 {row['room_number']} 的 {row['stove_type']} 日消耗量 {row['daily_consumption_kg']}kg 异常",
                'room_number': row['room_number'],
                'stove_type': row['stove_type']
            })
        
        # 4. 重复的入住编码
        duplicate_stays = self.db.query('''
            SELECT stay_code, COUNT(*) as cnt
            FROM stays
            GROUP BY stay_code
            HAVING COUNT(*) > 1
        ''')
        for row in duplicate_stays:
            anomalies.append({
                'type': 'duplicate_stay_code',
                'severity': 'high',
                'message': f"入住编码 {row['stay_code']} 重复 {row['cnt']} 次",
                'stay_code': row['stay_code']
            })
        
        # 5. 消耗估算大于入库量
        stats = self.get_statistics()
        if stats['inventory']['remaining_kg'] < 0:
            anomalies.append({
                'type': 'inventory_deficit',
                'severity': 'high',
                'message': f"消耗估算 ({stats['inventory']['total_estimated_kg']:.1f}kg) 大于入库量 ({stats['inventory']['total_in_kg']:.1f}kg)",
                'deficit_kg': abs(stats['inventory']['remaining_kg'])
            })
        
        return anomalies
