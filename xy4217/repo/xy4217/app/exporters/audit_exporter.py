from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict
from app.rules.rule_engine import RISK_TYPES, RISK_LEVELS


class AuditExporter:
    def __init__(self):
        self.export_time = datetime.now()
    
    def generate_markdown_report(
        self,
        risks: List[Dict[str, Any]],
        stats: Optional[Dict[str, Any]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> str:
        report_lines = []
        
        report_lines.append("# 化疗药批次追踪哨 - 审计报告")
        report_lines.append(f"\n**生成时间**: {self.export_time.strftime('%Y-%m-%d %H:%M:%S')}")
        if start_time and end_time:
            report_lines.append(f"\n**审计时段**: {start_time.strftime('%Y-%m-%d %H:%M:%S')} 至 {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("\n---")
        
        if stats:
            report_lines.append("\n## 一、统计概览")
            report_lines.append(f"\n- **总风险数**: {stats.get('total_risks', 0)}")
            report_lines.append(f"- **高风险**: {stats.get('high_risk', 0)}")
            report_lines.append(f"- **中风险**: {stats.get('medium_risk', 0)}")
            report_lines.append(f"- **低风险**: {stats.get('low_risk', 0)}")
            
            risk_type_stats = stats.get('risk_type_stats', {})
            if risk_type_stats:
                report_lines.append("\n### 按风险类型统计")
                report_lines.append("\n| 风险类型 | 数量 |")
                report_lines.append("|----------|------|")
                for risk_type, count in risk_type_stats.items():
                    type_name = RISK_TYPES.get(risk_type, risk_type)
                    report_lines.append(f"| {type_name} | {count} |")
        
        report_lines.append("\n## 二、风险详情")
        
        if not risks:
            report_lines.append("\n> 暂无风险记录。")
        else:
            risks_by_level = defaultdict(list)
            for risk in risks:
                level = risk.get('risk_level', 'medium')
                risks_by_level[level].append(risk)
            
            for level in ['high', 'medium', 'low']:
                level_risks = risks_by_level.get(level, [])
                if level_risks:
                    level_name = RISK_LEVELS.get(level, level)
                    report_lines.append(f"\n### {level_name} ({len(level_risks)}条)")
                    
                    for idx, risk in enumerate(level_risks, 1):
                        risk_type = risk.get('risk_type', 'UNKNOWN')
                        type_name = RISK_TYPES.get(risk_type, risk_type)
                        
                        report_lines.append(f"\n#### 风险{idx}: {type_name}")
                        report_lines.append(f"\n- **描述**: {risk.get('description', '无描述')}")
                        report_lines.append(f"- **风险类型**: {risk_type}")
                        report_lines.append(f"- **风险等级**: {level_name}")
                        
                        if risk.get('related_prescription_id'):
                            report_lines.append(f"- **关联处方**: {risk['related_prescription_id']}")
                        if risk.get('related_batch_number'):
                            report_lines.append(f"- **关联批号**: {risk['related_batch_number']}")
                        if risk.get('related_fridge_id'):
                            report_lines.append(f"- **关联冰箱**: {risk['related_fridge_id']}")
                        if risk.get('related_waste_id'):
                            report_lines.append(f"- **关联废弃**: {risk['related_waste_id']}")
                        
                        details = risk.get('details', {})
                        if details:
                            report_lines.append("\n<details>")
                            report_lines.append("<summary>查看详情</summary>")
                            report_lines.append("\n```json")
                            import json
                            report_lines.append(json.dumps(details, ensure_ascii=False, indent=2))
                            report_lines.append("```")
                            report_lines.append("</details>")
        
        report_lines.append("\n---")
        report_lines.append("\n## 三、风险类型说明")
        report_lines.append("\n| 风险类型代码 | 中文名称 | 说明 |")
        report_lines.append("|--------------|----------|------|")
        report_lines.append("| BATCH_CONFLICT | 批号冲突 | 同一批号存在多条记录，信息可能不一致 |")
        report_lines.append("| TEMP_GAP | 温度断档 | 冰箱温度记录存在长时间间隔，可能存在监控漏洞 |")
        report_lines.append("| DOSE_OVER_LIMIT | 剂量超限 | 处方剂量超过药品批号可用量 |")
        report_lines.append("| WASTE_NOT_CLOSED | 未闭环废弃 | 废弃记录超过24小时未闭环处理 |")
        report_lines.append("| PREPARE_TIMEOUT | 超时调配 | 实际调配时间超过预计调配时间30分钟以上 |")
        report_lines.append("| COLD_CHAIN_ABNORMAL | 冷链异常 | 冰箱温度超出2-8°C正常范围 |")
        report_lines.append("| BATCH_CROSS_PATIENT | 同批号跨患者串用 | 同一批号被多个患者使用，存在用药风险 |")
        report_lines.append("| REMAINING_MISMATCH | 剩余量对不上 | 批号剩余量与实际使用+废弃量计算不符 |")
        
        report_lines.append("\n---")
        report_lines.append(f"\n*报告由化疗药批次追踪哨系统自动生成于 {self.export_time.strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return '\n'.join(report_lines)
    
    def generate_risk_json(
        self,
        risks: List[Dict[str, Any]],
        stats: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        risk_list = []
        
        for risk in risks:
            risk_item = {
                'risk_type': risk.get('risk_type'),
                'risk_type_name': RISK_TYPES.get(risk.get('risk_type', ''), risk.get('risk_type')),
                'risk_level': risk.get('risk_level'),
                'risk_level_name': RISK_LEVELS.get(risk.get('risk_level', ''), risk.get('risk_level')),
                'description': risk.get('description'),
                'related_prescription_id': risk.get('related_prescription_id'),
                'related_batch_number': risk.get('related_batch_number'),
                'related_fridge_id': risk.get('related_fridge_id'),
                'related_waste_id': risk.get('related_waste_id'),
                'details': risk.get('details', {})
            }
            risk_list.append(risk_item)
        
        result = {
            'export_time': self.export_time.isoformat(),
            'total_risks': len(risk_list),
            'risks': risk_list
        }
        
        if stats:
            result['statistics'] = stats
        
        return result
    
    def generate_batch_tracking_report(
        self,
        batch_number: str,
        batch_info: Dict[str, Any],
        prescriptions: List[Dict[str, Any]],
        wastes: List[Dict[str, Any]],
        temperature_logs: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        report_lines = []
        
        report_lines.append(f"# 批号追踪报告 - {batch_number}")
        report_lines.append(f"\n**生成时间**: {self.export_time.strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("\n---")
        
        report_lines.append("\n## 一、批号基本信息")
        if batch_info:
            report_lines.append(f"\n- **药品名称**: {batch_info.get('drug_name', '-')}")
            report_lines.append(f"- **药品ID**: {batch_info.get('drug_id', '-')}")
            report_lines.append(f"- **规格**: {batch_info.get('spec', '-')}")
            report_lines.append(f"- **总数量**: {batch_info.get('total_amount', 0)} {batch_info.get('unit', 'mg')}")
            report_lines.append(f"- **已使用**: {batch_info.get('used_amount', 0)} {batch_info.get('unit', 'mg')}")
            report_lines.append(f"- **剩余量**: {batch_info.get('remaining_amount', 0)} {batch_info.get('unit', 'mg')}")
            report_lines.append(f"- **有效期**: {batch_info.get('expire_date', '-')}")
            report_lines.append(f"- **入库时间**: {batch_info.get('receive_time', '-')}")
            report_lines.append(f"- **存储位置**: {batch_info.get('storage_location', '-')}")
            report_lines.append(f"- **供应商**: {batch_info.get('supplier', '-')}")
            report_lines.append(f"- **状态**: {batch_info.get('status', '-')}")
        
        report_lines.append("\n## 二、处方使用记录")
        if prescriptions:
            report_lines.append(f"\n共 {len(prescriptions)} 条处方使用记录")
            report_lines.append("\n| 处方编号 | 患者ID | 患者姓名 | 剂量 | 开具时间 | 状态 |")
            report_lines.append("|----------|--------|----------|------|----------|------|")
            for presc in prescriptions:
                report_lines.append(
                    f"| {presc.get('prescription_id', '-')} | "
                    f"{presc.get('patient_id', '-')} | "
                    f"{presc.get('patient_name', '-')} | "
                    f"{presc.get('dose', 0)} {presc.get('unit', 'mg')} | "
                    f"{presc.get('prescription_time', '-')} | "
                    f"{presc.get('status', '-')} |"
                )
        else:
            report_lines.append("\n> 暂无处方使用记录。")
        
        report_lines.append("\n## 三、废弃记录")
        if wastes:
            report_lines.append(f"\n共 {len(wastes)} 条废弃记录")
            report_lines.append("\n| 废弃ID | 废弃数量 | 废弃原因 | 废弃时间 | 操作人 | 是否闭环 |")
            report_lines.append("|--------|----------|----------|----------|--------|----------|")
            for waste in wastes:
                closed = '是' if waste.get('closed', 0) else '否'
                report_lines.append(
                    f"| {waste.get('waste_id', '-')} | "
                    f"{waste.get('waste_amount', 0)} {waste.get('unit', 'mg')} | "
                    f"{waste.get('waste_reason', '-')} | "
                    f"{waste.get('waste_time', '-')} | "
                    f"{waste.get('operator', '-')} | "
                    f"{closed} |"
                )
        else:
            report_lines.append("\n> 暂无废弃记录。")
        
        if temperature_logs:
            report_lines.append("\n## 四、相关温度日志")
            report_lines.append(f"\n共 {len(temperature_logs)} 条温度记录")
            report_lines.append("\n| 冰箱ID | 温度 | 记录时间 | 状态 |")
            report_lines.append("|--------|------|----------|------|")
            for log in temperature_logs[:50]:
                report_lines.append(
                    f"| {log.get('fridge_id', '-')} | "
                    f"{log.get('temperature', '-')}°C | "
                    f"{log.get('log_time', '-')} | "
                    f"{log.get('status', '-')} |"
                )
            if len(temperature_logs) > 50:
                report_lines.append(f"\n> 仅显示前50条记录，共{len(temperature_logs)}条")
        
        report_lines.append("\n---")
        report_lines.append(f"\n*报告由化疗药批次追踪哨系统自动生成于 {self.export_time.strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return '\n'.join(report_lines)


def calculate_statistics(risks: List[Dict[str, Any]]) -> Dict[str, Any]:
    stats = {
        'total_risks': len(risks),
        'high_risk': 0,
        'medium_risk': 0,
        'low_risk': 0,
        'risk_type_stats': defaultdict(int)
    }
    
    for risk in risks:
        level = risk.get('risk_level', 'medium')
        stats[f'{level}_risk'] = stats.get(f'{level}_risk', 0) + 1
        
        risk_type = risk.get('risk_type', 'UNKNOWN')
        stats['risk_type_stats'][risk_type] += 1
    
    stats['risk_type_stats'] = dict(stats['risk_type_stats'])
    
    return stats
