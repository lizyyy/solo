import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from modules.time_window_merger import BatchTimeWindow

@dataclass
class RiskCheckResult:
    batch_number: str
    rule_name: str
    rule_id: str
    risk_level: str
    description: str
    evidence: str
    timestamp: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class RiskRule:
    def __init__(self, rule_id: str, rule_name: str, risk_level: str, 
                 check_function: Callable[[BatchTimeWindow], Optional[RiskCheckResult]]):
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.risk_level = risk_level
        self.check_function = check_function
    
    def check(self, batch: BatchTimeWindow) -> Optional[RiskCheckResult]:
        return self.check_function(batch)

def check_production_to_outbound_delay(batch: BatchTimeWindow) -> Optional[RiskCheckResult]:
    max_delay_minutes = 60
    
    if not batch.production_time or not batch.outbound_time:
        return None
    
    delay = batch.outbound_time - batch.production_time
    delay_minutes = delay.total_seconds() / 60
    
    if delay_minutes > max_delay_minutes:
        return RiskCheckResult(
            batch_number=batch.batch_number,
            rule_name="生产后未及时入冷/出库",
            rule_id="PROD_DELAY",
            risk_level="high",
            description=f"生产后 {delay_minutes:.1f} 分钟才出库，超过阈值 {max_delay_minutes} 分钟",
            evidence=f"生产时间: {batch.production_time}, 出库时间: {batch.outbound_time}, 延迟: {delay_minutes:.1f}分钟",
            timestamp=batch.production_time
        )
    
    return None

def check_continuous_over_temperature(batch: BatchTimeWindow) -> Optional[RiskCheckResult]:
    threshold_temp = 4.0
    max_continuous_minutes = 20
    
    if not batch.temperature_records:
        return None
    
    sorted_records = sorted(batch.temperature_records, key=lambda x: x['温度读数时间'] or datetime.min)
    
    continuous_over_start = None
    max_continuous_duration = timedelta(0)
    max_over_period = None
    
    for i, record in enumerate(sorted_records):
        temp = record.get('温度值')
        temp_time = record.get('温度读数时间')
        
        if temp is None or temp_time is None:
            continue
        
        if temp > threshold_temp:
            if continuous_over_start is None:
                continuous_over_start = temp_time
            else:
                duration = temp_time - continuous_over_start
                if duration > max_continuous_duration:
                    max_continuous_duration = duration
                    max_over_period = (continuous_over_start, temp_time)
        else:
            continuous_over_start = None
    
    max_continuous_minutes = max_continuous_duration.total_seconds() / 60
    
    if max_continuous_minutes > max_continuous_minutes:
        return RiskCheckResult(
            batch_number=batch.batch_number,
            rule_name="运输途中连续超温",
            rule_id="TEMP_OVER",
            risk_level="high",
            description=f"连续超温 {max_continuous_minutes:.1f} 分钟，超过阈值 {max_continuous_minutes} 分钟",
            evidence=f"超温时段: {max_over_period[0]} 至 {max_over_period[1]}, 最高连续时长: {max_continuous_minutes:.1f}分钟",
            timestamp=max_over_period[0] if max_over_period else None
        )
    
    return None

def check_temperature_gaps(batch: BatchTimeWindow) -> Optional[RiskCheckResult]:
    max_gap_minutes = 30
    
    if not batch.temperature_records or len(batch.temperature_records) < 2:
        return None
    
    sorted_records = sorted(batch.temperature_records, key=lambda x: x['温度读数时间'] or datetime.min)
    
    valid_times = [r['温度读数时间'] for r in sorted_records if r.get('温度读数时间')]
    if len(valid_times) < 2:
        return None
    
    gaps = []
    for i in range(1, len(valid_times)):
        gap = valid_times[i] - valid_times[i-1]
        gap_minutes = gap.total_seconds() / 60
        
        if gap_minutes > max_gap_minutes:
            gaps.append({
                'start': valid_times[i-1],
                'end': valid_times[i],
                'gap_minutes': gap_minutes
            })
    
    if gaps:
        largest_gap = max(gaps, key=lambda x: x['gap_minutes'])
        return RiskCheckResult(
            batch_number=batch.batch_number,
            rule_name="温度记录断档",
            rule_id="TEMP_GAP",
            risk_level="medium",
            description=f"温度记录存在断档，最大断档 {largest_gap['gap_minutes']:.1f} 分钟",
            evidence=f"断档时段: {largest_gap['start']} 至 {largest_gap['end']}, 断档时长: {largest_gap['gap_minutes']:.1f}分钟, 共发现 {len(gaps)} 处断档",
            timestamp=largest_gap['start']
        )
    
    return None

def check_signoff_before_outbound(batch: BatchTimeWindow) -> Optional[RiskCheckResult]:
    if not batch.outbound_time or not batch.signoff_time:
        return None
    
    if batch.signoff_time < batch.outbound_time:
        time_diff = (batch.outbound_time - batch.signoff_time).total_seconds() / 60
        return RiskCheckResult(
            batch_number=batch.batch_number,
            rule_name="签收时间早于出库时间",
            rule_id="SIGNOFF_BEFORE",
            risk_level="high",
            description=f"签收时间比出库时间早 {time_diff:.1f} 分钟，逻辑异常",
            evidence=f"出库时间: {batch.outbound_time}, 签收时间: {batch.signoff_time}, 时间差: {time_diff:.1f}分钟",
            timestamp=batch.signoff_time
        )
    
    return None

def check_duplicate_sample_id(batch: BatchTimeWindow) -> Optional[RiskCheckResult]:
    if not batch.sample_records:
        return None
    
    sample_ids = [s.get('留样编号') for s in batch.sample_records if s.get('留样编号')]
    seen = set()
    duplicates = []
    
    for sample_id in sample_ids:
        if sample_id in seen:
            duplicates.append(sample_id)
        seen.add(sample_id)
    
    if duplicates:
        return RiskCheckResult(
            batch_number=batch.batch_number,
            rule_name="同一留样编号重复",
            rule_id="DUPLICATE_SAMPLE",
            risk_level="medium",
            description=f"发现重复的留样编号: {', '.join(duplicates)}",
            evidence=f"重复留样编号: {', '.join(duplicates)}, 总留样记录数: {len(batch.sample_records)}",
            timestamp=batch.sample_records[0].get('留样时间') if batch.sample_records else None
        )
    
    return None

def check_missing_sample(batch: BatchTimeWindow) -> Optional[RiskCheckResult]:
    if not batch.sample_records or len(batch.sample_records) == 0:
        return RiskCheckResult(
            batch_number=batch.batch_number,
            rule_name="应留样但缺失",
            rule_id="MISSING_SAMPLE",
            risk_level="high",
            description="该批次没有任何留样记录",
            evidence=f"批次号: {batch.batch_number}, 菜品: {batch.dish}, 无留样记录",
            timestamp=batch.production_time
        )
    
    return None

def check_failed_still_salable(batch: BatchTimeWindow) -> Optional[RiskCheckResult]:
    failed_keywords = ['不合格', 'FAIL', '不通过', 'NG']
    
    if not batch.sample_records:
        return None
    
    failed_samples = []
    for sample in batch.sample_records:
        result = str(sample.get('抽检结论', '')).strip()
        if any(keyword in result for keyword in failed_keywords):
            failed_samples.append(sample)
    
    if failed_samples and batch.status and '已出库' in batch.status:
        return RiskCheckResult(
            batch_number=batch.batch_number,
            rule_name="抽检不合格仍被标为可售/已出库",
            rule_id="FAILED_SALABLE",
            risk_level="high",
            description=f"抽检不合格但批次状态为'{batch.status}'",
            evidence=f"不合格留样数: {len(failed_samples)}, 批次状态: {batch.status}, 不合格留样: {[s.get('留样编号') for s in failed_samples]}",
            timestamp=failed_samples[0].get('抽检时间') if failed_samples else None
        )
    
    return None

def check_temperature_any_over_threshold(batch: BatchTimeWindow) -> Optional[RiskCheckResult]:
    threshold_high = 4.0
    threshold_low = -18.0
    
    if not batch.temperature_records:
        return None
    
    over_count = 0
    under_count = 0
    max_temp = None
    min_temp = None
    
    for record in batch.temperature_records:
        temp = record.get('温度值')
        if temp is None:
            continue
        
        if max_temp is None or temp > max_temp:
            max_temp = temp
        if min_temp is None or temp < min_temp:
            min_temp = temp
        
        if temp > threshold_high:
            over_count += 1
        if temp < threshold_low:
            under_count += 1
    
    if over_count > 0 or under_count > 0:
        messages = []
        if over_count > 0:
            messages.append(f"超高温 {over_count} 次 (最高 {max_temp}°C)")
        if under_count > 0:
            messages.append(f"超低温 {under_count} 次 (最低 {min_temp}°C)")
        
        return RiskCheckResult(
            batch_number=batch.batch_number,
            rule_name="温度超出正常范围",
            rule_id="TEMP_OUT_OF_RANGE",
            risk_level="medium",
            description=", ".join(messages),
            evidence=f"高温阈值: {threshold_high}°C, 低温阈值: {threshold_low}°C, 最高温: {max_temp}°C, 最低温: {min_temp}°C",
            timestamp=batch.temperature_records[0].get('温度读数时间') if batch.temperature_records else None
        )
    
    return None

def get_default_risk_rules() -> List[RiskRule]:
    return [
        RiskRule("PROD_DELAY", "生产后未及时入冷/出库", "high", check_production_to_outbound_delay),
        RiskRule("TEMP_OVER", "运输途中连续超温", "high", check_continuous_over_temperature),
        RiskRule("TEMP_GAP", "温度记录断档", "medium", check_temperature_gaps),
        RiskRule("SIGNOFF_BEFORE", "签收时间早于出库时间", "high", check_signoff_before_outbound),
        RiskRule("DUPLICATE_SAMPLE", "同一留样编号重复", "medium", check_duplicate_sample_id),
        RiskRule("MISSING_SAMPLE", "应留样但缺失", "high", check_missing_sample),
        RiskRule("FAILED_SALABLE", "抽检不合格仍被标为可售/已出库", "high", check_failed_still_salable),
        RiskRule("TEMP_OUT_OF_RANGE", "温度超出正常范围", "medium", check_temperature_any_over_threshold),
    ]

def run_all_risk_checks(
    merged_batches: Dict[str, BatchTimeWindow],
    custom_rules: List[RiskRule] = None
) -> List[RiskCheckResult]:
    rules = custom_rules if custom_rules else get_default_risk_rules()
    
    all_results = []
    
    for batch_number, batch in merged_batches.items():
        for rule in rules:
            result = rule.check(batch)
            if result:
                all_results.append(result)
    
    all_results.sort(key=lambda x: (
        0 if x.risk_level == "high" else 1 if x.risk_level == "medium" else 2,
        x.timestamp or datetime.min
    ))
    
    return all_results

def get_risk_summary(results: List[RiskCheckResult]) -> Dict[str, Any]:
    summary = {
        'total': len(results),
        'by_level': {
            'high': sum(1 for r in results if r.risk_level == 'high'),
            'medium': sum(1 for r in results if r.risk_level == 'medium'),
            'low': sum(1 for r in results if r.risk_level == 'low')
        },
        'by_rule': {},
        'by_batch': {}
    }
    
    for result in results:
        if result.rule_name not in summary['by_rule']:
            summary['by_rule'][result.rule_name] = 0
        summary['by_rule'][result.rule_name] += 1
        
        if result.batch_number not in summary['by_batch']:
            summary['by_batch'][result.batch_number] = 0
        summary['by_batch'][result.batch_number] += 1
    
    summary['affected_batches'] = len(summary['by_batch'])
    
    return summary

def filter_results_by_batch(results: List[RiskCheckResult], batch_number: str) -> List[RiskCheckResult]:
    return [r for r in results if r.batch_number == batch_number]

def filter_results_by_level(results: List[RiskCheckResult], levels: List[str]) -> List[RiskCheckResult]:
    return [r for r in results if r.risk_level in levels]
