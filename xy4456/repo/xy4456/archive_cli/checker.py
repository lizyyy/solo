import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from .models import (
    FilmRoll, Scanner, MaintenanceRecord, TemperatureHumidityLog,
    Reservation, CheckResult, CheckStatus, BlockReason
)
from .database import Database
from .exceptions import CheckError


class BusinessChecker:
    """业务规则检查器"""
    
    # 霉斑风险阈值配置
    MOLD_RISK_TEMPERATURE_THRESHOLD = 25.0  # 摄氏度
    MOLD_RISK_HUMIDITY_THRESHOLD = 70.0      # 百分比
    MOLD_RISK_DURATION_HOURS = 48            # 持续高风险小时数
    
    # 维护周期配置（月）
    MAINTENANCE_INTERVAL_MONTHS = 3
    
    def __init__(self, db: Database):
        self.db = db
    
    def check_film_roll(self, film_roll_id: str, 
                         check_time: Optional[datetime] = None,
                         reader_name: Optional[str] = None) -> CheckResult:
        """
        检查胶片卷是否可以借阅
        
        Args:
            film_roll_id: 胶片卷ID
            check_time: 检查时间，默认为当前时间
            reader_name: 读者姓名（用于预约冲突检查）
        
        Returns:
            CheckResult: 检查结果
        """
        if check_time is None:
            check_time = datetime.now()
        
        film_roll = self.db.get_film_roll(film_roll_id)
        if not film_roll:
            raise CheckError(f"Film roll not found: {film_roll_id}")
        
        block_reasons: List[BlockReason] = []
        details: Dict[str, Any] = {}
        
        # 1. 检查霉斑风险
        mold_check = self._check_mold_risk(film_roll, check_time)
        if mold_check['has_risk']:
            block_reasons.append(BlockReason.MOLD_RISK)
            details['mold_risk'] = mold_check
        
        # 2. 检查扫描仪兼容性
        scanner_check = self._check_scanner_compatibility(film_roll)
        if not scanner_check['compatible']:
            block_reasons.append(BlockReason.SCANNER_INCOMPATIBLE)
            details['scanner_compatibility'] = scanner_check
        
        # 3. 检查维护过期
        maintenance_check = self._check_maintenance_expired(check_time)
        if maintenance_check['has_expired']:
            block_reasons.append(BlockReason.MAINTENANCE_EXPIRED)
            details['maintenance'] = maintenance_check
        
        # 4. 检查预约冲突
        reservation_check = self._check_reservation_conflict(
            film_roll_id, check_time, reader_name
        )
        if reservation_check['has_conflict']:
            block_reasons.append(BlockReason.RESERVATION_CONFLICT)
            details['reservation'] = reservation_check
        
        # 确定检查状态
        if len(block_reasons) > 0:
            status = CheckStatus.BLOCKED
        else:
            status = CheckStatus.AVAILABLE
        
        # 创建检查结果
        result = CheckResult(
            id=str(uuid.uuid4()),
            film_roll_id=film_roll_id,
            check_time=check_time,
            status=status,
            block_reasons=block_reasons,
            details=details,
            created_at=datetime.now()
        )
        
        # 保存检查结果到数据库
        self.db.insert_check_result(result)
        
        return result
    
    def _check_mold_risk(self, film_roll: FilmRoll, check_time: datetime) -> Dict[str, Any]:
        """
        检查霉斑风险
        
        规则：如果库房温湿度在连续48小时内超过阈值（温度>25°C，湿度>70%），则存在霉斑风险
        """
        result = {
            'has_risk': False,
            'threshold': {
                'temperature': self.MOLD_RISK_TEMPERATURE_THRESHOLD,
                'humidity': self.MOLD_RISK_HUMIDITY_THRESHOLD,
                'duration_hours': self.MOLD_RISK_DURATION_HOURS
            },
            'logs': []
        }
        
        # 获取检查时间前48小时的温湿度日志
        start_time = check_time - timedelta(hours=self.MOLD_RISK_DURATION_HOURS)
        
        # 使用胶片卷的位置，如果没有则查询所有位置
        location = film_roll.location
        
        logs = self.db.get_temp_humidity_logs(
            location=location,
            start_time=start_time,
            end_time=check_time
        )
        
        if not logs:
            # 如果没有温湿度数据，假设没有风险
            result['message'] = "No temperature/humidity data available, assuming no mold risk"
            return result
        
        # 检查是否存在连续高风险时段
        high_risk_periods = []
        current_period_start = None
        
        for log in sorted(logs, key=lambda x: x.timestamp):
            is_high_risk = (
                log.temperature > self.MOLD_RISK_TEMPERATURE_THRESHOLD and
                log.humidity > self.MOLD_RISK_HUMIDITY_THRESHOLD
            )
            
            result['logs'].append({
                'timestamp': log.timestamp.isoformat(),
                'temperature': log.temperature,
                'humidity': log.humidity,
                'is_high_risk': is_high_risk
            })
            
            if is_high_risk:
                if current_period_start is None:
                    current_period_start = log.timestamp
            else:
                if current_period_start is not None:
                    duration = log.timestamp - current_period_start
                    high_risk_periods.append({
                        'start': current_period_start.isoformat(),
                        'end': log.timestamp.isoformat(),
                        'duration_hours': duration.total_seconds() / 3600
                    })
                    current_period_start = None
        
        # 检查最后一个时段
        if current_period_start is not None:
            duration = check_time - current_period_start
            high_risk_periods.append({
                'start': current_period_start.isoformat(),
                'end': check_time.isoformat(),
                'duration_hours': duration.total_seconds() / 3600
            })
        
        # 检查是否有超过阈值的高风险时段
        for period in high_risk_periods:
            if period['duration_hours'] >= self.MOLD_RISK_DURATION_HOURS:
                result['has_risk'] = True
                result['high_risk_periods'] = high_risk_periods
                result['message'] = f"Mold risk detected: high temperature/humidity for {period['duration_hours']:.1f} hours"
                break
        
        return result
    
    def _check_scanner_compatibility(self, film_roll: FilmRoll) -> Dict[str, Any]:
        """
        检查扫描仪兼容性
        
        规则：检查胶片卷所需的格式和扫描仪要求是否与可用扫描仪匹配
        """
        result = {
            'compatible': False,
            'film_roll_requirements': {},
            'available_scanners': [],
            'incompatible_reasons': []
        }
        
        # 获取所有可用的扫描仪
        scanners = self.db.get_all_scanners()
        active_scanners = [s for s in scanners if s.status == 'active']
        
        result['film_roll_requirements'] = {
            'format': film_roll.format,
            'scanner_requirements': film_roll.scanner_requirements
        }
        
        if not active_scanners:
            result['incompatible_reasons'].append("No active scanners available")
            return result
        
        # 检查每个扫描仪的兼容性
        for scanner in active_scanners:
            scanner_info = {
                'id': scanner.id,
                'name': scanner.name,
                'model': scanner.model,
                'supported_formats': scanner.supported_formats,
                'compatible': True,
                'reasons': []
            }
            
            # 检查格式兼容性
            if film_roll.format and film_roll.format not in scanner.supported_formats:
                scanner_info['compatible'] = False
                scanner_info['reasons'].append(
                    f"Format '{film_roll.format}' not supported (supported: {scanner.supported_formats})"
                )
            
            # 检查扫描仪型号要求
            if film_roll.scanner_requirements:
                required_models = [m.strip() for m in film_roll.scanner_requirements.split(',')]
                if scanner.model not in required_models:
                    scanner_info['compatible'] = False
                    scanner_info['reasons'].append(
                        f"Scanner model '{scanner.model}' not in required list: {required_models}"
                    )
            
            result['available_scanners'].append(scanner_info)
            
            if scanner_info['compatible']:
                result['compatible'] = True
        
        if not result['compatible']:
            result['incompatible_reasons'] = [
                f"Scanner {s['name']} ({s['model']}): {', '.join(s['reasons'])}"
                for s in result['available_scanners']
                if not s['compatible']
            ]
        
        return result
    
    def _check_maintenance_expired(self, check_time: datetime) -> Dict[str, Any]:
        """
        检查扫描仪维护是否过期
        
        规则：检查所有活跃扫描仪的维护记录是否在有效期内
        """
        result = {
            'has_expired': False,
            'maintenance_interval_months': self.MAINTENANCE_INTERVAL_MONTHS,
            'scanners': []
        }
        
        scanners = self.db.get_all_scanners()
        active_scanners = [s for s in scanners if s.status == 'active']
        
        for scanner in active_scanners:
            scanner_info = {
                'id': scanner.id,
                'name': scanner.name,
                'model': scanner.model,
                'last_maintenance': None,
                'next_maintenance': None,
                'maintenance_expired': False,
                'days_since_last_maintenance': None,
                'days_until_next_maintenance': None
            }
            
            # 获取最新的维护记录
            records = self.db.get_maintenance_records_by_scanner(scanner.id)
            completed_records = [r for r in records if r.status == 'completed']
            
            if completed_records:
                latest_record = completed_records[0]  # 按日期降序排列
                scanner_info['last_maintenance'] = latest_record.maintenance_date.isoformat()
                
                # 计算距离上次维护的天数
                days_since = (check_time.date() - latest_record.maintenance_date).days
                scanner_info['days_since_last_maintenance'] = days_since
                
                # 计算预计下次维护日期（如果没有记录则按默认周期）
                if latest_record.next_maintenance_date:
                    next_date = latest_record.next_maintenance_date
                    scanner_info['next_maintenance'] = next_date.isoformat()
                    days_until = (next_date - check_time.date()).days
                    scanner_info['days_until_next_maintenance'] = days_until
                    
                    if days_until < 0:
                        scanner_info['maintenance_expired'] = True
                else:
                    # 按默认维护周期计算
                    expected_next = latest_record.maintenance_date + timedelta(
                        days=self.MAINTENANCE_INTERVAL_MONTHS * 30
                    )
                    scanner_info['next_maintenance'] = expected_next.isoformat()
                    days_until = (expected_next - check_time.date()).days
                    scanner_info['days_until_next_maintenance'] = days_until
                    
                    if days_until < 0:
                        scanner_info['maintenance_expired'] = True
            else:
                # 没有维护记录，标记为需要维护
                scanner_info['maintenance_expired'] = True
                scanner_info['message'] = "No maintenance records found"
            
            result['scanners'].append(scanner_info)
            
            if scanner_info['maintenance_expired']:
                result['has_expired'] = True
        
        return result
    
    def _check_reservation_conflict(self, film_roll_id: str, 
                                     check_time: datetime,
                                     reader_name: Optional[str] = None) -> Dict[str, Any]:
        """
        检查预约冲突
        
        规则：检查胶片卷在指定时间是否已有其他预约
        """
        result = {
            'has_conflict': False,
            'check_time': check_time.isoformat(),
            'conflicting_reservations': []
        }
        
        # 获取该胶片卷的所有活跃预约
        reservations = self.db.get_reservations_by_film_roll(film_roll_id)
        
        for reservation in reservations:
            # 排除当前读者的预约（如果提供了读者姓名）
            if reader_name and reservation.reader_name == reader_name:
                continue
            
            # 检查时间冲突
            is_conflict = (
                reservation.start_time <= check_time <= reservation.end_time
            )
            
            if is_conflict:
                result['has_conflict'] = True
                result['conflicting_reservations'].append({
                    'id': reservation.id,
                    'reader_name': reservation.reader_name,
                    'start_time': reservation.start_time.isoformat(),
                    'end_time': reservation.end_time.isoformat(),
                    'purpose': reservation.purpose
                })
        
        return result
    
    def check_multiple_film_rolls(self, film_roll_ids: List[str],
                                   check_time: Optional[datetime] = None,
                                   reader_name: Optional[str] = None) -> List[CheckResult]:
        """
        批量检查多个胶片卷
        
        Args:
            film_roll_ids: 胶片卷ID列表
            check_time: 检查时间
            reader_name: 读者姓名
        
        Returns:
            检查结果列表
        """
        results = []
        for film_roll_id in film_roll_ids:
            try:
                result = self.check_film_roll(film_roll_id, check_time, reader_name)
                results.append(result)
            except CheckError as e:
                # 创建一个错误的检查结果
                result = CheckResult(
                    id=str(uuid.uuid4()),
                    film_roll_id=film_roll_id,
                    check_time=check_time or datetime.now(),
                    status=CheckStatus.WARNING,
                    block_reasons=[],
                    details={'error': str(e)},
                    created_at=datetime.now()
                )
                results.append(result)
        
        return results
    
    def get_block_reason_description(self, reason: BlockReason) -> str:
        """获取拦截原因的描述"""
        descriptions = {
            BlockReason.MOLD_RISK: "存在霉斑风险 - 库房温湿度长时间超过安全阈值",
            BlockReason.SCANNER_INCOMPATIBLE: "扫描仪不兼容 - 没有可用的扫描仪支持该胶片格式或型号",
            BlockReason.MAINTENANCE_EXPIRED: "扫描仪维护过期 - 有扫描仪未按时进行维护",
            BlockReason.RESERVATION_CONFLICT: "预约冲突 - 该胶片卷在指定时间已有其他预约"
        }
        return descriptions.get(reason, str(reason))
