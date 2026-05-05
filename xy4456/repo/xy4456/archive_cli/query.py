from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Union
from .models import (
    FilmRoll, Scanner, MaintenanceRecord, TemperatureHumidityLog,
    Reservation, Note, CheckResult, CheckStatus, BlockReason
)
from .database import Database
from .exceptions import DatabaseError


class QueryService:
    """查询服务 - 提供本地查询接口"""
    
    def __init__(self, db: Database):
        self.db = db
    
    # ==================== 胶片卷查询 ====================
    
    def get_film_roll_by_id(self, film_roll_id: str) -> Optional[FilmRoll]:
        """根据ID获取胶片卷"""
        return self.db.get_film_roll(film_roll_id)
    
    def search_film_rolls(self, 
                           keyword: Optional[str] = None,
                           format: Optional[str] = None,
                           location: Optional[str] = None,
                           status: Optional[str] = None) -> List[FilmRoll]:
        """
        搜索胶片卷
        
        Args:
            keyword: 关键词（搜索标题和描述）
            format: 胶片格式
            location: 存储位置
            status: 状态
        
        Returns:
            匹配的胶片卷列表
        """
        film_rolls = self.db.get_all_film_rolls()
        results = []
        
        for film_roll in film_rolls:
            match = True
            
            # 关键词搜索
            if keyword:
                keyword_lower = keyword.lower()
                in_title = film_roll.title and keyword_lower in film_roll.title.lower()
                in_description = film_roll.description and keyword_lower in film_roll.description.lower()
                if not (in_title or in_description):
                    match = False
            
            # 格式过滤
            if format and film_roll.format != format:
                match = False
            
            # 位置过滤
            if location and film_roll.location != location:
                match = False
            
            if match:
                results.append(film_roll)
        
        return results
    
    # ==================== 扫描仪查询 ====================
    
    def get_scanner_by_id(self, scanner_id: str) -> Optional[Scanner]:
        """根据ID获取扫描仪"""
        return self.db.get_scanner(scanner_id)
    
    def get_all_scanners(self, status: Optional[str] = None) -> List[Scanner]:
        """获取所有扫描仪，可按状态过滤"""
        scanners = self.db.get_all_scanners()
        if status:
            return [s for s in scanners if s.status == status]
        return scanners
    
    def get_scanners_by_format(self, format: str) -> List[Scanner]:
        """根据支持的格式获取扫描仪"""
        scanners = self.db.get_all_scanners()
        return [s for s in scanners if format in s.supported_formats and s.status == 'active']
    
    # ==================== 维护记录查询 ====================
    
    def get_maintenance_history(self, scanner_id: Optional[str] = None,
                                 start_date: Optional[date] = None,
                                 end_date: Optional[date] = None) -> List[MaintenanceRecord]:
        """
        获取维护历史记录
        
        Args:
            scanner_id: 扫描仪ID（可选）
            start_date: 开始日期
            end_date: 结束日期
        
        Returns:
            维护记录列表
        """
        if scanner_id:
            records = self.db.get_maintenance_records_by_scanner(scanner_id)
        else:
            # 获取所有扫描仪的维护记录
            records = []
            scanners = self.db.get_all_scanners()
            for scanner in scanners:
                records.extend(self.db.get_maintenance_records_by_scanner(scanner.id))
        
        # 按日期过滤
        if start_date:
            records = [r for r in records if r.maintenance_date >= start_date]
        if end_date:
            records = [r for r in records if r.maintenance_date <= end_date]
        
        # 按日期降序排序
        records.sort(key=lambda r: r.maintenance_date, reverse=True)
        
        return records
    
    def get_expired_maintenance(self, check_date: Optional[date] = None) -> List[Dict[str, Any]]:
        """
        获取维护过期的扫描仪
        
        Args:
            check_date: 检查日期，默认为今天
        
        Returns:
            过期维护的扫描仪信息列表
        """
        if check_date is None:
            check_date = date.today()
        
        scanners = self.db.get_all_scanners()
        active_scanners = [s for s in scanners if s.status == 'active']
        
        expired = []
        
        for scanner in active_scanners:
            records = self.db.get_maintenance_records_by_scanner(scanner.id)
            completed_records = [r for r in records if r.status == 'completed']
            
            if not completed_records:
                expired.append({
                    'scanner_id': scanner.id,
                    'scanner_name': scanner.name,
                    'last_maintenance': None,
                    'next_maintenance': None,
                    'days_expired': None,
                    'status': 'no_maintenance'
                })
                continue
            
            latest = completed_records[0]  # 按日期降序
            
            if latest.next_maintenance_date:
                next_date = latest.next_maintenance_date
            else:
                # 默认3个月维护周期
                next_date = latest.maintenance_date + timedelta(days=90)
            
            if next_date < check_date:
                days_expired = (check_date - next_date).days
                expired.append({
                    'scanner_id': scanner.id,
                    'scanner_name': scanner.name,
                    'last_maintenance': latest.maintenance_date.isoformat(),
                    'next_maintenance': next_date.isoformat(),
                    'days_expired': days_expired,
                    'status': 'expired'
                })
        
        return expired
    
    # ==================== 温湿度日志查询 ====================
    
    def get_temp_humidity_logs(self,
                                location: Optional[str] = None,
                                start_time: Optional[datetime] = None,
                                end_time: Optional[datetime] = None,
                                limit: Optional[int] = None) -> List[TemperatureHumidityLog]:
        """
        获取温湿度日志
        
        Args:
            location: 库房位置
            start_time: 开始时间
            end_time: 结束时间
            limit: 返回记录数限制
        
        Returns:
            温湿度日志列表
        """
        logs = self.db.get_temp_humidity_logs(location, start_time, end_time)
        
        if limit:
            logs = logs[:limit]
        
        return logs
    
    def get_temp_humidity_statistics(self,
                                       location: Optional[str] = None,
                                       start_time: Optional[datetime] = None,
                                       end_time: Optional[datetime] = None) -> Dict[str, Any]:
        """
        获取温湿度统计信息
        
        Returns:
            统计信息字典
        """
        logs = self.db.get_temp_humidity_logs(location, start_time, end_time)
        
        if not logs:
            return {
                'count': 0,
                'temperature': {'min': None, 'max': None, 'avg': None},
                'humidity': {'min': None, 'max': None, 'avg': None}
            }
        
        temperatures = [log.temperature for log in logs]
        humidities = [log.humidity for log in logs]
        
        return {
            'count': len(logs),
            'temperature': {
                'min': min(temperatures),
                'max': max(temperatures),
                'avg': sum(temperatures) / len(temperatures)
            },
            'humidity': {
                'min': min(humidities),
                'max': max(humidities),
                'avg': sum(humidities) / len(humidities)
            }
        }
    
    # ==================== 预约单查询 ====================
    
    def get_reservations(self,
                          film_roll_id: Optional[str] = None,
                          reader_name: Optional[str] = None,
                          start_time: Optional[datetime] = None,
                          end_time: Optional[datetime] = None,
                          status: str = 'active') -> List[Reservation]:
        """
        查询预约单
        
        Args:
            film_roll_id: 胶片卷ID
            reader_name: 读者姓名
            start_time: 开始时间
            end_time: 结束时间
            status: 状态
        
        Returns:
            预约单列表
        """
        # 简化实现：先获取所有相关预约，再过滤
        reservations = []
        
        if film_roll_id:
            reservations = self.db.get_reservations_by_film_roll(film_roll_id)
        else:
            # 没有指定胶片卷，需要查询所有预约（这里简化处理）
            film_rolls = self.db.get_all_film_rolls()
            for fr in film_rolls:
                reservations.extend(self.db.get_reservations_by_film_roll(fr.id))
        
        # 过滤
        filtered = []
        for r in reservations:
            match = True
            
            if reader_name and r.reader_name != reader_name:
                match = False
            
            if start_time and r.end_time < start_time:
                match = False
            
            if end_time and r.start_time > end_time:
                match = False
            
            if status and r.status != status:
                match = False
            
            if match:
                filtered.append(r)
        
        return filtered
    
    def get_reservation_conflicts(self, film_roll_id: str,
                                   start_time: datetime,
                                   end_time: datetime) -> List[Reservation]:
        """
        检查指定时间范围内的预约冲突
        
        Args:
            film_roll_id: 胶片卷ID
            start_time: 开始时间
            end_time: 结束时间
        
        Returns:
            冲突的预约单列表
        """
        reservations = self.db.get_reservations_by_film_roll(film_roll_id)
        conflicts = []
        
        for r in reservations:
            if r.status != 'active':
                continue
            
            # 检查时间重叠
            if r.start_time < end_time and r.end_time > start_time:
                conflicts.append(r)
        
        return conflicts
    
    # ==================== 检查结果查询 ====================
    
    def get_latest_check_result(self, film_roll_id: str) -> Optional[CheckResult]:
        """获取胶片卷的最新检查结果"""
        return self.db.get_latest_check_result(film_roll_id)
    
    def get_check_results_by_status(self, status: CheckStatus,
                                     limit: Optional[int] = 100) -> List[CheckResult]:
        """
        按状态获取检查结果
        
        Args:
            status: 检查状态
            limit: 返回数量限制
        
        Returns:
            检查结果列表
        """
        # 这里需要扩展数据库查询，简化实现：获取所有胶片卷的最新结果并过滤
        film_rolls = self.db.get_all_film_rolls()
        results = []
        
        for fr in film_rolls:
            result = self.db.get_latest_check_result(fr.id)
            if result and result.status == status:
                results.append(result)
                if limit and len(results) >= limit:
                    break
        
        return results
    
    # ==================== 备注查询 ====================
    
    def get_notes(self, related_type: Optional[str] = None,
                  related_id: Optional[str] = None,
                  limit: Optional[int] = 100) -> List[Note]:
        """
        查询备注
        
        Args:
            related_type: 关联类型
            related_id: 关联ID
            limit: 返回数量限制
        
        Returns:
            备注列表
        """
        if related_type and related_id:
            return self.db.get_notes_by_related(related_type, related_id)
        
        # 简化实现：如果只指定了类型，需要遍历
        # 实际项目中应该在数据库层添加更灵活的查询
        return []
    
    # ==================== 综合查询 ====================
    
    def get_availability_summary(self) -> Dict[str, Any]:
        """
        获取可用性概览
        
        Returns:
            可用性统计信息
        """
        film_rolls = self.db.get_all_film_rolls()
        scanners = self.db.get_all_scanners()
        active_scanners = [s for s in scanners if s.status == 'active']
        
        available_count = 0
        blocked_count = 0
        blocked_details = {
            'mold_risk': 0,
            'scanner_incompatible': 0,
            'maintenance_expired': 0,
            'reservation_conflict': 0
        }
        
        for fr in film_rolls:
            result = self.db.get_latest_check_result(fr.id)
            if result:
                if result.status == CheckStatus.AVAILABLE:
                    available_count += 1
                else:
                    blocked_count += 1
                    for reason in result.block_reasons:
                        if reason == BlockReason.MOLD_RISK:
                            blocked_details['mold_risk'] += 1
                        elif reason == BlockReason.SCANNER_INCOMPATIBLE:
                            blocked_details['scanner_incompatible'] += 1
                        elif reason == BlockReason.MAINTENANCE_EXPIRED:
                            blocked_details['maintenance_expired'] += 1
                        elif reason == BlockReason.RESERVATION_CONFLICT:
                            blocked_details['reservation_conflict'] += 1
        
        # 获取过期维护的扫描仪数量
        expired_maintenance = self.get_expired_maintenance()
        
        return {
            'film_rolls': {
                'total': len(film_rolls),
                'available': available_count,
                'blocked': blocked_count,
                'blocked_reasons': blocked_details
            },
            'scanners': {
                'total': len(scanners),
                'active': len(active_scanners),
                'maintenance_expired': len(expired_maintenance)
            }
        }
