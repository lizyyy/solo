from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Tuple, Optional
import json
from collections import defaultdict

from flask import current_app

from app.models.models import (
    BroadcastEvent,
    Program,
    Contract,
    BlackoutPeriod,
    IndustryConflict,
    ValidationResult
)
from app.services.storage_service import StorageService


class RuleResult:
    def __init__(self, passed: bool, rule_code: str, title: str, 
                 description: str, severity: str = 'warning',
                 affected_date: Optional[date] = None,
                 affected_time: Optional[time] = None,
                 related_brand: Optional[str] = None,
                 related_event_ids: Optional[List[int]] = None):
        self.passed = passed
        self.rule_code = rule_code
        self.title = title
        self.description = description
        self.severity = severity
        self.affected_date = affected_date
        self.affected_time = affected_time
        self.related_brand = related_brand
        self.related_event_ids = related_event_ids or []


class RulesEngine:
    
    MAX_CONSECUTIVE_SAME_BRAND = 2
    MIN_INTERVAL_SAME_BRAND_SECONDS = 1800
    MAX_DAILY_FREQUENCY_PER_BRAND = 12
    CHILDREN_PROGRAM_RESTRICTED_CATEGORIES = ['医药', '烟酒', '游戏', '成人用品']
    
    @staticmethod
    def validate_all(broadcast_date: date) -> Dict[str, Any]:
        all_results = []
        
        events = StorageService.get_events_for_day_ordered(broadcast_date)
        if not events:
            return {
                'success': True,
                'message': '当日无播出事件',
                'validation_count': 0,
                'error_count': 0,
                'warning_count': 0,
                'results': []
            }
        
        rules = [
            ('consecutive_brand', RulesEngine.check_consecutive_same_brand),
            ('brand_frequency', RulesEngine.check_brand_frequency),
            ('interval_between_brand', RulesEngine.check_brand_interval),
            ('industry_conflict', RulesEngine.check_industry_conflict),
            ('blackout_period', RulesEngine.check_blackout_period),
            ('children_program_restriction', RulesEngine.check_children_program_restriction),
            ('contract_balance', RulesEngine.check_contract_balance),
            ('rerun_duplicate', RulesEngine.check_rerun_duplicate),
            ('duration_consistency', RulesEngine.check_duration_consistency),
        ]
        
        for rule_code, rule_func in rules:
            try:
                results = rule_func(events, broadcast_date)
                all_results.extend(results)
            except Exception as e:
                all_results.append(RuleResult(
                    passed=False,
                    rule_code=f'{rule_code}_error',
                    title=f'规则执行错误: {rule_code}',
                    description=str(e),
                    severity='error',
                    affected_date=broadcast_date
                ))
        
        error_count = sum(1 for r in all_results if not r.passed and r.severity == 'error')
        warning_count = sum(1 for r in all_results if not r.passed and r.severity == 'warning')
        
        return {
            'success': True,
            'validation_count': len(rules),
            'error_count': error_count,
            'warning_count': warning_count,
            'results': [RulesEngine._result_to_dict(r) for r in all_results]
        }
    
    @staticmethod
    def check_consecutive_same_brand(events: List[BroadcastEvent], 
                                       broadcast_date: date) -> List[RuleResult]:
        results = []
        if len(events) < 2:
            return results
        
        consecutive_count = 1
        current_brand = events[0].brand_name
        consecutive_events = [events[0]]
        
        for i in range(1, len(events)):
            event = events[i]
            
            if event.brand_name == current_brand and current_brand:
                consecutive_count += 1
                consecutive_events.append(event)
                
                if consecutive_count > RulesEngine.MAX_CONSECUTIVE_SAME_BRAND:
                    results.append(RuleResult(
                        passed=False,
                        rule_code='CONSECUTIVE_BRAND',
                        title='同一品牌连播超限',
                        description=f'品牌"{current_brand}"在{broadcast_date}连续播出{consecutive_count}次，超过限制{RulesEngine.MAX_CONSECUTIVE_SAME_BRAND}次',
                        severity='error',
                        affected_date=broadcast_date,
                        affected_time=event.broadcast_time,
                        related_brand=current_brand,
                        related_event_ids=[e.id for e in consecutive_events]
                    ))
                    break
            else:
                consecutive_count = 1
                current_brand = event.brand_name
                consecutive_events = [event]
        
        if not any(not r.passed for r in results):
            results.append(RuleResult(
                passed=True,
                rule_code='CONSECUTIVE_BRAND',
                title='连播品牌检查通过',
                description=f'当日无同一品牌连播超过{RulesEngine.MAX_CONSECUTIVE_SAME_BRAND}次的情况',
                severity='info',
                affected_date=broadcast_date
            ))
        
        return results
    
    @staticmethod
    def check_brand_frequency(events: List[BroadcastEvent],
                               broadcast_date: date) -> List[RuleResult]:
        results = []
        brand_counts = defaultdict(int)
        brand_events = defaultdict(list)
        
        for event in events:
            if event.brand_name:
                brand_counts[event.brand_name] += 1
                brand_events[event.brand_name].append(event)
        
        for brand, count in brand_counts.items():
            if count > RulesEngine.MAX_DAILY_FREQUENCY_PER_BRAND:
                results.append(RuleResult(
                    passed=False,
                    rule_code='BRAND_FREQUENCY',
                    title='品牌日播出频次超限',
                    description=f'品牌"{brand}"在{broadcast_date}播出{count}次，超过日限制{RulesEngine.MAX_DAILY_FREQUENCY_PER_BRAND}次',
                    severity='error',
                    affected_date=broadcast_date,
                    related_brand=brand,
                    related_event_ids=[e.id for e in brand_events[brand]]
                ))
        
        if not results:
            results.append(RuleResult(
                passed=True,
                rule_code='BRAND_FREQUENCY',
                title='品牌频次检查通过',
                description=f'当日所有品牌播出频次均未超过日限制{RulesEngine.MAX_DAILY_FREQUENCY_PER_BRAND}次',
                severity='info',
                affected_date=broadcast_date
            ))
        
        return results
    
    @staticmethod
    def check_brand_interval(events: List[BroadcastEvent],
                              broadcast_date: date) -> List[RuleResult]:
        results = []
        brand_last_time = {}
        
        for event in events:
            if not event.brand_name:
                continue
            
            brand = event.brand_name
            current_dt = datetime.combine(broadcast_date, event.broadcast_time)
            
            if brand in brand_last_time:
                last_dt = brand_last_time[brand]
                interval_seconds = (current_dt - last_dt).total_seconds()
                
                if interval_seconds < RulesEngine.MIN_INTERVAL_SAME_BRAND_SECONDS:
                    results.append(RuleResult(
                        passed=False,
                        rule_code='BRAND_INTERVAL',
                        title='同品牌间隔时间不足',
                        description=f'品牌"{brand}"两次播出间隔{interval_seconds:.0f}秒，低于最小间隔{RulesEngine.MIN_INTERVAL_SAME_BRAND_SECONDS}秒（{RulesEngine.MIN_INTERVAL_SAME_BRAND_SECONDS//60}分钟）',
                        severity='warning',
                        affected_date=broadcast_date,
                        affected_time=event.broadcast_time,
                        related_brand=brand
                    ))
            
            brand_last_time[brand] = current_dt
        
        if not results:
            results.append(RuleResult(
                passed=True,
                rule_code='BRAND_INTERVAL',
                title='品牌间隔检查通过',
                description=f'当日同品牌播出间隔均满足{RulesEngine.MIN_INTERVAL_SAME_BRAND_SECONDS//60}分钟以上',
                severity='info',
                affected_date=broadcast_date
            ))
        
        return results
    
    @staticmethod
    def check_industry_conflict(events: List[BroadcastEvent],
                                 broadcast_date: date) -> List[RuleResult]:
        results = []
        conflicts = StorageService.list_active_conflicts()
        
        if not conflicts:
            return [RuleResult(
                passed=True,
                rule_code='INDUSTRY_CONFLICT',
                title='行业冲突规则检查通过',
                description='未配置行业冲突规则',
                severity='info',
                affected_date=broadcast_date
            )]
        
        conflict_map = {}
        for c in conflicts:
            key = tuple(sorted([c.category_a, c.category_b]))
            conflict_map[key] = c.min_interval_seconds
        
        for i, event in enumerate(events):
            if not event.industry_category:
                continue
            
            cat1 = event.industry_category
            for j in range(i + 1, len(events)):
                event2 = events[j]
                if not event2.industry_category:
                    continue
                
                cat2 = event2.industry_category
                key = tuple(sorted([cat1, cat2]))
                
                if key in conflict_map:
                    min_interval = conflict_map[key]
                    dt1 = datetime.combine(broadcast_date, event.broadcast_time)
                    dt2 = datetime.combine(broadcast_date, event2.broadcast_time)
                    interval = abs((dt2 - dt1).total_seconds())
                    
                    if interval < min_interval:
                        results.append(RuleResult(
                            passed=False,
                            rule_code='INDUSTRY_CONFLICT',
                            title='行业竞品间隔不足',
                            description=f'{cat1}与{cat2}属于竞品行业，间隔{interval:.0f}秒，低于要求的{min_interval}秒',
                            severity='warning',
                            affected_date=broadcast_date,
                            affected_time=event.broadcast_time,
                            related_event_ids=[event.id, event2.id]
                        ))
        
        if not results:
            results.append(RuleResult(
                passed=True,
                rule_code='INDUSTRY_CONFLICT',
                title='行业冲突检查通过',
                description='当日所有竞品行业广告播出间隔均满足要求',
                severity='info',
                affected_date=broadcast_date
            ))
        
        return results
    
    @staticmethod
    def check_blackout_period(events: List[BroadcastEvent],
                               broadcast_date: date) -> List[RuleResult]:
        results = []
        blackouts = StorageService.list_active_blackout_periods()
        
        if not blackouts:
            return [RuleResult(
                passed=True,
                rule_code='BLACKOUT_PERIOD',
                title='禁播时段检查通过',
                description='未配置禁播时段规则',
                severity='info',
                affected_date=broadcast_date
            )]
        
        for event in events:
            if not event.brand_name:
                continue
            
            event_time = event.broadcast_time
            event_dt = datetime.combine(broadcast_date, event_time)
            
            for blackout in blackouts:
                if blackout.start_date and broadcast_date < blackout.start_date:
                    continue
                if blackout.end_date and broadcast_date > blackout.end_date:
                    continue
                
                if blackout.day_of_week is not None:
                    if broadcast_date.weekday() + 1 != blackout.day_of_week:
                        continue
                
                in_time_window = True
                if blackout.start_time and blackout.end_time:
                    event_seconds = event_time.hour * 3600 + event_time.minute * 60 + event_time.second
                    start_seconds = blackout.start_time.hour * 3600 + blackout.start_time.minute * 60 + blackout.start_time.second
                    end_seconds = blackout.end_time.hour * 3600 + blackout.end_time.minute * 60 + blackout.end_time.second
                    in_time_window = start_seconds <= event_seconds <= end_seconds
                
                if in_time_window:
                    category_restricted = False
                    if blackout.restricted_categories:
                        try:
                            restricted = json.loads(blackout.restricted_categories)
                            if event.industry_category in restricted:
                                category_restricted = True
                        except:
                            category_restricted = True
                    else:
                        category_restricted = True
                    
                    if category_restricted:
                        results.append(RuleResult(
                            passed=False,
                            rule_code='BLACKOUT_PERIOD',
                            title='禁播时段违规',
                            description=f'广告"{event.brand_name}"在禁播时段"{blackout.name}"播出',
                            severity='error',
                            affected_date=broadcast_date,
                            affected_time=event_time,
                            related_brand=event.brand_name,
                            related_event_ids=[event.id]
                        ))
        
        if not results:
            results.append(RuleResult(
                passed=True,
                rule_code='BLACKOUT_PERIOD',
                title='禁播时段检查通过',
                description='当日无广告在禁播时段播出',
                severity='info',
                affected_date=broadcast_date
            ))
        
        return results
    
    @staticmethod
    def check_children_program_restriction(events: List[BroadcastEvent],
                                             broadcast_date: date) -> List[RuleResult]:
        results = []
        
        children_programs = StorageService.get_children_programs(broadcast_date)
        
        if not children_programs:
            return [RuleResult(
                passed=True,
                rule_code='CHILDREN_PROGRAM',
                title='少儿节目广告限制检查通过',
                description='当日无少儿节目',
                severity='info',
                affected_date=broadcast_date
            )]
        
        for program in children_programs:
            prog_start = datetime.combine(broadcast_date, program.start_time)
            if program.end_time:
                prog_end = datetime.combine(broadcast_date, program.end_time)
            else:
                prog_end = prog_start + timedelta(hours=2)
            
            for event in events:
                event_dt = datetime.combine(broadcast_date, event.broadcast_time)
                
                if prog_start <= event_dt <= prog_end:
                    if event.industry_category in RulesEngine.CHILDREN_PROGRAM_RESTRICTED_CATEGORIES:
                        results.append(RuleResult(
                            passed=False,
                            rule_code='CHILDREN_PROGRAM',
                            title='少儿节目插播受限品类',
                            description=f'广告"{event.brand_name}"({event.industry_category})在少儿节目"{program.program_name}"时段播出，该品类在少儿时段受限',
                            severity='error',
                            affected_date=broadcast_date,
                            affected_time=event.broadcast_time,
                            related_brand=event.brand_name,
                            related_event_ids=[event.id]
                        ))
        
        if not results:
            results.append(RuleResult(
                passed=True,
                rule_code='CHILDREN_PROGRAM',
                title='少儿节目广告限制检查通过',
                description='当日少儿节目时段未发现受限品类广告',
                severity='info',
                affected_date=broadcast_date
            ))
        
        return results
    
    @staticmethod
    def check_contract_balance(events: List[BroadcastEvent],
                                broadcast_date: date) -> List[RuleResult]:
        results = []
        
        contracts = StorageService.list_contracts(status='active')
        if not contracts:
            return [RuleResult(
                passed=True,
                rule_code='CONTRACT_BALANCE',
                title='合同余量检查通过',
                description='无有效合同',
                severity='info',
                affected_date=broadcast_date
            )]
        
        contract_map = {c.brand_name: c for c in contracts}
        
        for event in events:
            if not event.brand_name:
                continue
            
            if event.brand_name in contract_map:
                contract = contract_map[event.brand_name]
                if contract.remaining_duration_seconds <= 0:
                    results.append(RuleResult(
                        passed=False,
                        rule_code='CONTRACT_BALANCE',
                        title='合同余量不足',
                        description=f'品牌"{event.brand_name}"合同{contract.contract_code}已无剩余时长',
                        severity='error',
                        affected_date=broadcast_date,
                        affected_time=event.broadcast_time,
                        related_brand=event.brand_name,
                        related_event_ids=[event.id]
                    ))
                elif event.duration_seconds and event.duration_seconds > contract.remaining_duration_seconds:
                    results.append(RuleResult(
                        passed=False,
                        rule_code='CONTRACT_BALANCE',
                        title='单次播出超过合同余量',
                        description=f'广告时长{event.duration_seconds}秒超过合同{contract.contract_code}剩余{contract.remaining_duration_seconds}秒',
                        severity='warning',
                        affected_date=broadcast_date,
                        affected_time=event.broadcast_time,
                        related_brand=event.brand_name
                    ))
        
        if not results:
            results.append(RuleResult(
                passed=True,
                rule_code='CONTRACT_BALANCE',
                title='合同余量检查通过',
                description='当日所有播出广告的合同余量充足',
                severity='info',
                affected_date=broadcast_date
            ))
        
        return results
    
    @staticmethod
    def check_rerun_duplicate(events: List[BroadcastEvent],
                               broadcast_date: date) -> List[RuleResult]:
        results = []
        
        rerun_events = [e for e in events if e.is_rerun]
        normal_events = [e for e in events if not e.is_rerun]
        
        event_signatures = {}
        for event in normal_events:
            sig = (event.brand_name, event.broadcast_time)
            event_signatures[sig] = event
        
        duplicate_count = 0
        for rerun in rerun_events:
            sig = (rerun.brand_name, rerun.broadcast_time)
            if sig in event_signatures:
                duplicate_count += 1
                results.append(RuleResult(
                    passed=False,
                    rule_code='RERUN_DUPLICATE',
                    title='补播重复计费风险',
                    description=f'补播广告"{rerun.brand_name}"与正常播出在同一时间，可能存在重复计费',
                    severity='warning',
                    affected_date=broadcast_date,
                    affected_time=rerun.broadcast_time,
                    related_brand=rerun.brand_name,
                    related_event_ids=[rerun.id, event_signatures[sig].id]
                ))
        
        if not results:
            results.append(RuleResult(
                passed=True,
                rule_code='RERUN_DUPLICATE',
                title='补播去重检查通过',
                description=f'当日{len(rerun_events)}个补播广告无重复计费风险',
                severity='info',
                affected_date=broadcast_date
            ))
        
        return results
    
    @staticmethod
    def check_duration_consistency(events: List[BroadcastEvent],
                                    broadcast_date: date) -> List[RuleResult]:
        results = []
        
        for event in events:
            if event.duration_seconds is None or event.duration_seconds <= 0:
                results.append(RuleResult(
                    passed=False,
                    rule_code='DURATION_CONSISTENCY',
                    title='广告时长异常',
                    description=f'广告"{event.brand_name}"时长异常: {event.duration_seconds}秒',
                    severity='warning',
                    affected_date=broadcast_date,
                    affected_time=event.broadcast_time,
                    related_brand=event.brand_name,
                    related_event_ids=[event.id]
                ))
            elif event.duration_seconds not in [5, 10, 15, 20, 30, 45, 60, 90, 120]:
                results.append(RuleResult(
                    passed=False,
                    rule_code='DURATION_CONSISTENCY',
                    title='广告时长非标准',
                    description=f'广告"{event.brand_name}"时长{event.duration_seconds}秒，非标准广告时长',
                    severity='warning',
                    affected_date=broadcast_date,
                    affected_time=event.broadcast_time,
                    related_brand=event.brand_name
                ))
        
        if not results:
            results.append(RuleResult(
                passed=True,
                rule_code='DURATION_CONSISTENCY',
                title='时长一致性检查通过',
                description='当日所有广告时长均为标准值',
                severity='info',
                affected_date=broadcast_date
            ))
        
        return results
    
    @staticmethod
    def compare_schedule_vs_log(broadcast_date: date) -> Dict[str, Any]:
        schedule_events = StorageService.list_events(
            broadcast_date=broadcast_date,
            source_type='schedule'
        )
        log_events = StorageService.list_events(
            broadcast_date=broadcast_date,
            source_type='log'
        )
        
        def event_key(e):
            return (e.brand_name, e.broadcast_time)
        
        schedule_keys = {event_key(e): e for e in schedule_events}
        log_keys = {event_key(e): e for e in log_events}
        
        missing_in_log = []
        missing_in_schedule = []
        matched = []
        
        for key, s_event in schedule_keys.items():
            if key in log_keys:
                matched.append({
                    'brand': key[0],
                    'time': str(key[1]),
                    'schedule_duration': s_event.duration_seconds,
                    'log_duration': log_keys[key].duration_seconds
                })
            else:
                missing_in_log.append({
                    'brand': s_event.brand_name,
                    'time': str(s_event.broadcast_time),
                    'duration': s_event.duration_seconds
                })
        
        for key, l_event in log_keys.items():
            if key not in schedule_keys:
                missing_in_schedule.append({
                    'brand': l_event.brand_name,
                    'time': str(l_event.broadcast_time),
                    'duration': l_event.duration_seconds
                })
        
        return {
            'schedule_count': len(schedule_events),
            'log_count': len(log_events),
            'matched_count': len(matched),
            'missing_in_log': missing_in_log,
            'missing_in_schedule': missing_in_schedule,
            'matched': matched,
            'consistent': len(missing_in_log) == 0 and len(missing_in_schedule) == 0
        }
    
    @staticmethod
    def _result_to_dict(result: RuleResult) -> Dict[str, Any]:
        return {
            'passed': result.passed,
            'rule_code': result.rule_code,
            'title': result.title,
            'description': result.description,
            'severity': result.severity,
            'affected_date': str(result.affected_date) if result.affected_date else None,
            'affected_time': str(result.affected_time) if result.affected_time else None,
            'related_brand': result.related_brand,
            'related_event_ids': result.related_event_ids
        }
