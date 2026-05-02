import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional
from io import StringIO
from modules.time_window_merger import BatchTimeWindow, get_temperature_statistics
from modules.risk_rules import RiskCheckResult, get_risk_summary

def generate_markdown_report(
    merged_batches: Dict[str, BatchTimeWindow],
    risk_results: List[RiskCheckResult],
    raw_data: Dict[str, pd.DataFrame] = None
) -> str:
    report_lines = []
    
    report_lines.append("# 冷链留样复盘报告")
    report_lines.append("")
    report_lines.append("生成时间: {}".format(datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    report_lines.append("")
    
    report_lines.append("---")
    report_lines.append("")
    
    total_batches = len(merged_batches)
    risk_summary = get_risk_summary(risk_results)
    
    report_lines.append("## 一、数据概览")
    report_lines.append("")
    report_lines.append("| 指标 | 数值 |")
    report_lines.append("|------|------|")
    report_lines.append("| 总批次数量 | {} |".format(total_batches))
    report_lines.append("| 异常总数 | {} |".format(risk_summary['total']))
    report_lines.append("| 高风险批次 | {} |".format(risk_summary['by_level']['high']))
    report_lines.append("| 中风险批次 | {} |".format(risk_summary['by_level']['medium']))
    report_lines.append("| 受影响批次 | {} |".format(risk_summary['affected_batches']))
    report_lines.append("")
    
    if risk_summary['by_rule']:
        report_lines.append("## 二、风险规则分布")
        report_lines.append("")
        report_lines.append("| 规则名称 | 触发次数 |")
        report_lines.append("|----------|----------|")
        for rule_name, count in sorted(risk_summary['by_rule'].items(), key=lambda x: x[1], reverse=True):
            report_lines.append(f"| {rule_name} | {count} |")
        report_lines.append("")
    
    high_risk_results = [r for r in risk_results if r.risk_level == 'high']
    medium_risk_results = [r for r in risk_results if r.risk_level == 'medium']
    
    if high_risk_results:
        report_lines.append("## 三、高风险异常详情")
        report_lines.append("")
        
        for i, result in enumerate(high_risk_results, 1):
            report_lines.append(f"### 3.{i} {result.rule_name}")
            report_lines.append("")
            report_lines.append(f"- **批次号**: {result.batch_number}")
            report_lines.append(f"- **风险等级**: 高风险")
            report_lines.append(f"- **描述**: {result.description}")
            report_lines.append(f"- **证据**: {result.evidence}")
            if result.timestamp:
                report_lines.append(f"- **时间**: {result.timestamp}")
            report_lines.append("")
    
    if medium_risk_results:
        report_lines.append("## 四、中风险异常详情")
        report_lines.append("")
        
        for i, result in enumerate(medium_risk_results, 1):
            report_lines.append(f"### 4.{i} {result.rule_name}")
            report_lines.append("")
            report_lines.append(f"- **批次号**: {result.batch_number}")
            report_lines.append(f"- **风险等级**: 中风险")
            report_lines.append(f"- **描述**: {result.description}")
            report_lines.append(f"- **证据**: {result.evidence}")
            if result.timestamp:
                report_lines.append(f"- **时间**: {result.timestamp}")
            report_lines.append("")
    
    if risk_summary['by_batch']:
        report_lines.append("## 五、批次风险统计")
        report_lines.append("")
        report_lines.append("| 批次号 | 风险数量 | 高风险 | 中风险 |")
        report_lines.append("|--------|----------|--------|--------|")
        
        batch_risk_details = {}
        for result in risk_results:
            if result.batch_number not in batch_risk_details:
                batch_risk_details[result.batch_number] = {'total': 0, 'high': 0, 'medium': 0, 'low': 0}
            batch_risk_details[result.batch_number]['total'] += 1
            batch_risk_details[result.batch_number][result.risk_level] += 1
        
        for batch_number, counts in sorted(batch_risk_details.items(), key=lambda x: x[1]['total'], reverse=True):
            report_lines.append(f"| {batch_number} | {counts['total']} | {counts['high']} | {counts['medium']} |")
        report_lines.append("")
    
    report_lines.append("## 六、建议措施")
    report_lines.append("")
    
    if high_risk_results:
        report_lines.append("### 6.1 紧急处理建议")
        report_lines.append("")
        report_lines.append("针对高风险异常，建议立即采取以下措施：")
        report_lines.append("")
        
        high_rules = set(r.rule_name for r in high_risk_results)
        
        if "生产后未及时入冷/出库" in high_rules:
            report_lines.append("- [ ] 核查生产流程，优化成品入冷效率")
            report_lines.append("- [ ] 确认延迟批次的产品质量状态")
        
        if "运输途中连续超温" in high_rules:
            report_lines.append("- [ ] 检查相关配送车辆制冷设备")
            report_lines.append("- [ ] 评估超温产品的安全性")
        
        if "签收时间早于出库时间" in high_rules:
            report_lines.append("- [ ] 核查数据录入流程，修正时间记录")
        
        if "应留样但缺失" in high_rules:
            report_lines.append("- [ ] 补全留样记录")
            report_lines.append("- [ ] 加强留样管理制度执行")
        
        if "抽检不合格仍被标为可售/已出库" in high_rules:
            report_lines.append("- [ ] 立即召回相关产品")
            report_lines.append("- [ ] 调查不合格原因")
        
        report_lines.append("")
    
    report_lines.append("### 6.2 长期改进建议")
    report_lines.append("")
    report_lines.append("1. **温度监控**: 增加温度记录频率，设置实时报警")
    report_lines.append("2. **流程优化**: 简化生产到出库的环节，减少等待时间")
    report_lines.append("3. **数据校验**: 建立数据录入自动校验机制")
    report_lines.append("4. **培训**: 加强对相关人员的操作培训")
    report_lines.append("5. **追溯**: 完善产品追溯体系")
    report_lines.append("")
    
    report_lines.append("---")
    report_lines.append("")
    report_lines.append("*本报告由冷链留样复盘台自动生成*")
    
    return "\n".join(report_lines)

def export_anomalies_csv(risk_results: List[RiskCheckResult]) -> str:
    if not risk_results:
        df = pd.DataFrame(columns=[
            '批次号', '规则名称', '规则ID', '风险等级', '描述', '证据', '时间戳'
        ])
        return df.to_csv(index=False, encoding='utf-8-sig')
    
    data = []
    for result in risk_results:
        row = {
            '批次号': result.batch_number,
            '规则名称': result.rule_name,
            '规则ID': result.rule_id,
            '风险等级': '高风险' if result.risk_level == 'high' else '中风险' if result.risk_level == 'medium' else '低风险',
            '描述': result.description,
            '证据': result.evidence,
            '时间戳': result.timestamp.strftime('%Y-%m-%d %H:%M:%S') if result.timestamp else ''
        }
        data.append(row)
    
    df = pd.DataFrame(data)
    df = df.sort_values(['风险等级', '时间戳'], ascending=[False, True])
    
    output = StringIO()
    df.to_csv(output, index=False, encoding='utf-8-sig')
    return output.getvalue()

def generate_batch_detail_report(
    batch: BatchTimeWindow,
    risk_results: List[RiskCheckResult]
) -> str:
    report_lines = []
    
    report_lines.append("# 批次 {} 详情报告".format(batch.batch_number))
    report_lines.append("")
    report_lines.append("生成时间: {}".format(datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    report_lines.append("")
    
    report_lines.append("## 一、基本信息")
    report_lines.append("")
    report_lines.append("| 字段 | 值 |")
    report_lines.append("|------|-----|")
    report_lines.append("| 批次号 | {} |".format(batch.batch_number))
    report_lines.append("| 菜品 | {} |".format(batch.dish))
    report_lines.append("| 门店 | {} |".format(batch.store))
    report_lines.append("| 配送车 | {} |".format(batch.delivery_car))
    report_lines.append("| 冷柜编号 | {} |".format(', '.join(batch.freezer_ids) if batch.freezer_ids else '无'))
    report_lines.append("| 状态 | {} |".format(batch.status))
    report_lines.append("")
    
    report_lines.append("## 二、时间节点")
    report_lines.append("")
    report_lines.append("| 事件 | 时间 |")
    report_lines.append("|------|------|")
    if batch.production_time:
        report_lines.append(f"| 生产时间 | {batch.production_time} |")
    if batch.outbound_time:
        report_lines.append(f"| 出库时间 | {batch.outbound_time} |")
    if batch.signoff_time:
        report_lines.append(f"| 签收时间 | {batch.signoff_time} |")
    report_lines.append("")
    
    temp_stats = get_temperature_statistics(batch)
    report_lines.append("## 三、温度统计")
    report_lines.append("")
    report_lines.append("| 指标 | 值 |")
    report_lines.append("|------|-----|")
    report_lines.append("| 温度记录数 | {} |".format(temp_stats['count']))
    report_lines.append("| 最高温度 | {}°C |".format(temp_stats['max'] if temp_stats['max'] is not None else '无'))
    report_lines.append("| 最低温度 | {}°C |".format(temp_stats['min'] if temp_stats['min'] is not None else '无'))
    report_lines.append("| 平均温度 | {}°C |".format(temp_stats['avg'] if temp_stats['avg'] is not None else '无'))
    report_lines.append("| 超高温次数 | {} |".format(temp_stats['over_threshold_count']))
    report_lines.append("| 超低温次数 | {} |".format(temp_stats['under_threshold_count']))
    report_lines.append("")
    
    report_lines.append("## 四、留样记录")
    report_lines.append("")
    
    if batch.sample_records:
        report_lines.append("| 留样编号 | 留样时间 | 抽检时间 | 抽检结论 |")
        report_lines.append("|----------|----------|----------|----------|")
        for sample in batch.sample_records:
            report_lines.append("| {} | {} | {} | {} |".format(
                sample.get('留样编号', ''),
                sample.get('留样时间', ''),
                sample.get('抽检时间', ''),
                sample.get('抽检结论', '')
            ))
    else:
        report_lines.append("*无留样记录*")
    report_lines.append("")
    
    batch_risks = [r for r in risk_results if r.batch_number == batch.batch_number]
    
    if batch_risks:
        report_lines.append("## 五、风险检测结果")
        report_lines.append("")
        
        for i, risk in enumerate(batch_risks, 1):
            risk_level_label = '高风险' if risk.risk_level == 'high' else '中风险' if risk.risk_level == 'medium' else '低风险'
            report_lines.append(f"### 5.{i} {risk.rule_name} ({risk_level_label})")
            report_lines.append("")
            report_lines.append(f"- **描述**: {risk.description}")
            report_lines.append(f"- **证据**: {risk.evidence}")
            if risk.timestamp:
                report_lines.append(f"- **时间**: {risk.timestamp}")
            report_lines.append("")
    
    return "\n".join(report_lines)

def generate_statistics_summary(
    merged_batches: Dict[str, BatchTimeWindow],
    risk_results: List[RiskCheckResult]
) -> Dict[str, Any]:
    stats = {
        '总批次数量': len(merged_batches),
        '有温度记录批次': 0,
        '有留样记录批次': 0,
        '无留样缺失批次': 0,
        '平均温度记录数': 0,
        '门店数量': 0,
        '配送车数量': 0,
        '冷柜数量': 0
    }
    
    stores = set()
    cars = set()
    freezers = set()
    temp_counts = []
    
    for batch in merged_batches.values():
        if batch.temperature_records:
            stats['有温度记录批次'] += 1
            temp_counts.append(len(batch.temperature_records))
        
        if batch.sample_records:
            stats['有留样记录批次'] += 1
        else:
            stats['无留样缺失批次'] += 1
        
        if batch.store:
            stores.add(batch.store)
        if batch.delivery_car:
            cars.add(batch.delivery_car)
        for f in batch.freezer_ids:
            freezers.add(f)
    
    stats['门店数量'] = len(stores)
    stats['配送车数量'] = len(cars)
    stats['冷柜数量'] = len(freezers)
    
    if temp_counts:
        stats['平均温度记录数'] = round(sum(temp_counts) / len(temp_counts), 1)
    
    risk_stats = get_risk_summary(risk_results)
    stats['风险统计'] = risk_stats
    
    return stats
