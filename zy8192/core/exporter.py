import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from core.models import CaseData, RiskType, RiskSeverity


class Exporter:
    
    @staticmethod
    def export_issues_csv(case_data: CaseData, output_path: str) -> bool:
        try:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                
                writer.writerow([
                    '病例ID', '动物姓名', '物种', '风险类型', '严重程度',
                    '开始时间', '结束时间', '描述', '是否已确认', '确认人', '确认时间'
                ])
                
                case = case_data.case
                
                for risk in case_data.risks:
                    writer.writerow([
                        case.case_id,
                        case.patient_name,
                        case.species.value,
                        risk.risk_type.value,
                        risk.severity.value,
                        risk.start_time.strftime('%Y-%m-%d %H:%M:%S'),
                        risk.end_time.strftime('%Y-%m-%d %H:%M:%S') if risk.end_time else '',
                        risk.description,
                        '是' if risk.confirmed else '否',
                        risk.confirmed_by,
                        risk.confirmed_time.strftime('%Y-%m-%d %H:%M:%S') if risk.confirmed_time else ''
                    ])
            
            return True
        except Exception as e:
            print(f"导出问题CSV失败: {e}")
            return False
    
    @staticmethod
    def export_anesthesia_report(case_data: CaseData, output_path: str) -> bool:
        try:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            
            report = Exporter._generate_report(case_data)
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(report)
            
            return True
        except Exception as e:
            print(f"导出麻醉报告失败: {e}")
            return False
    
    @staticmethod
    def _generate_report(case_data: CaseData) -> str:
        case = case_data.case
        
        high_risks = [r for r in case_data.risks if r.severity == RiskSeverity.HIGH]
        medium_risks = [r for r in case_data.risks if r.severity == RiskSeverity.MEDIUM]
        low_risks = [r for r in case_data.risks if r.severity == RiskSeverity.LOW]
        confirmed_risks = [r for r in case_data.risks if r.confirmed]
        unconfirmed_risks = [r for r in case_data.risks if not r.confirmed]
        
        report_lines = []
        
        report_lines.append(f"# 麻醉病例复盘报告")
        report_lines.append(f"")
        report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"")
        
        report_lines.append(f"## 基本信息")
        report_lines.append(f"")
        report_lines.append(f"| 项目 | 内容 |")
        report_lines.append(f"|------|------|")
        report_lines.append(f"| 病例ID | {case.case_id} |")
        report_lines.append(f"| 动物姓名 | {case.patient_name} |")
        report_lines.append(f"| 物种 | {'犬' if case.species.value == 'dog' else '猫'} |")
        report_lines.append(f"| 体重 | {case.weight} {case.weight_unit.value} ({case.weight_kg:.2f} kg) |")
        report_lines.append(f"| 手术类型 | {case.surgery_type} |")
        report_lines.append(f"| 麻醉师 | {case.anesthesiologist or '-'} |")
        report_lines.append(f"| 手术开始 | {case.start_time.strftime('%Y-%m-%d %H:%M:%S')} |")
        report_lines.append(f"| 手术结束 | {case.end_time.strftime('%Y-%m-%d %H:%M:%S') if case.end_time else '-'} |")
        report_lines.append(f"")
        
        report_lines.append(f"## 风险摘要")
        report_lines.append(f"")
        report_lines.append(f"| 风险等级 | 数量 | 已确认 |")
        report_lines.append(f"|----------|------|--------|")
        report_lines.append(f"| 高危 | {len(high_risks)} | {len([r for r in high_risks if r.confirmed])} |")
        report_lines.append(f"| 中危 | {len(medium_risks)} | {len([r for r in medium_risks if r.confirmed])} |")
        report_lines.append(f"| 低危 | {len(low_risks)} | {len([r for r in low_risks if r.confirmed])} |")
        report_lines.append(f"| **合计** | {len(case_data.risks)} | {len(confirmed_risks)} |")
        report_lines.append(f"")
        
        if high_risks:
            report_lines.append(f"### 高危事件")
            report_lines.append(f"")
            for risk in high_risks:
                status = "✅ 已确认" if risk.confirmed else "⚠️ 待确认"
                report_lines.append(f"#### {Exporter._risk_type_name(risk.risk_type)} ({status})")
                report_lines.append(f"")
                report_lines.append(f"- **时间**: {risk.start_time.strftime('%H:%M:%S')} - {risk.end_time.strftime('%H:%M:%S') if risk.end_time else '持续中'}")
                report_lines.append(f"- **描述**: {risk.description}")
                if risk.confirmed_by:
                    report_lines.append(f"- **确认人**: {risk.confirmed_by}")
                if risk.confirmed_time:
                    report_lines.append(f"- **确认时间**: {risk.confirmed_time.strftime('%Y-%m-%d %H:%M:%S')}")
                report_lines.append(f"")
        
        if medium_risks:
            report_lines.append(f"### 中危事件")
            report_lines.append(f"")
            for risk in medium_risks:
                status = "✅ 已确认" if risk.confirmed else "⚠️ 待确认"
                report_lines.append(f"#### {Exporter._risk_type_name(risk.risk_type)} ({status})")
                report_lines.append(f"")
                report_lines.append(f"- **时间**: {risk.start_time.strftime('%H:%M:%S')} - {risk.end_time.strftime('%H:%M:%S') if risk.end_time else '持续中'}")
                report_lines.append(f"- **描述**: {risk.description}")
                if risk.confirmed_by:
                    report_lines.append(f"- **确认人**: {risk.confirmed_by}")
                report_lines.append(f"")
        
        if low_risks:
            report_lines.append(f"### 低危事件")
            report_lines.append(f"")
            for risk in low_risks:
                status = "✅ 已确认" if risk.confirmed else "⚠️ 待确认"
                report_lines.append(f"#### {Exporter._risk_type_name(risk.risk_type)} ({status})")
                report_lines.append(f"")
                report_lines.append(f"- **时间**: {risk.start_time.strftime('%H:%M:%S')} - {risk.end_time.strftime('%H:%M:%S') if risk.end_time else '持续中'}")
                report_lines.append(f"- **描述**: {risk.description}")
                report_lines.append(f"")
        
        if case_data.drug_administrations:
            report_lines.append(f"## 用药记录")
            report_lines.append(f"")
            report_lines.append(f"| 时间 | 药物 | 剂量 | 单位 | 途径 |")
            report_lines.append(f"|------|------|------|------|------|")
            for drug in case_data.drug_administrations:
                report_lines.append(f"| {drug.timestamp.strftime('%H:%M:%S')} | {drug.drug_name} | {drug.dose} | {drug.dose_unit} | {drug.route or '-'} |")
            report_lines.append(f"")
        
        if case_data.vital_signs:
            report_lines.append(f"## 生命体征摘要")
            report_lines.append(f"")
            
            vitals = case_data.vital_signs
            hr_values = [v.heart_rate for v in vitals if v.heart_rate]
            sbp_values = [v.systolic_bp for v in vitals if v.systolic_bp]
            temp_values = [v.temperature for v in vitals if v.temperature]
            spo2_values = [v.spo2 for v in vitals if v.spo2]
            
            report_lines.append(f"| 指标 | 最小值 | 最大值 | 平均值 |")
            report_lines.append(f"|------|--------|--------|--------|")
            
            if hr_values:
                report_lines.append(f"| 心率 (bpm) | {min(hr_values):.0f} | {max(hr_values):.0f} | {sum(hr_values)/len(hr_values):.1f} |")
            if sbp_values:
                report_lines.append(f"| 收缩压 (mmHg) | {min(sbp_values):.0f} | {max(sbp_values):.0f} | {sum(sbp_values)/len(sbp_values):.1f} |")
            if temp_values:
                report_lines.append(f"| 体温 (°C) | {min(temp_values):.1f} | {max(temp_values):.1f} | {sum(temp_values)/len(temp_values):.1f} |")
            if spo2_values:
                report_lines.append(f"| 血氧饱和度 (%) | {min(spo2_values):.0f} | {max(spo2_values):.0f} | {sum(spo2_values)/len(spo2_values):.1f} |")
            report_lines.append(f"")
        
        if case_data.post_op_notes:
            report_lines.append(f"## 术后备注")
            report_lines.append(f"")
            report_lines.append(case_data.post_op_notes)
            report_lines.append(f"")
        
        if case.notes:
            report_lines.append(f"## 备注")
            report_lines.append(f"")
            report_lines.append(case.notes)
            report_lines.append(f"")
        
        report_lines.append(f"---")
        report_lines.append(f"*本报告由麻醉复盘工具自动生成*")
        
        return "\n".join(report_lines)
    
    @staticmethod
    def _risk_type_name(risk_type: RiskType) -> str:
        names = {
            RiskType.HYPOTENSION: "低血压",
            RiskType.HYPOTHERMIA: "低体温",
            RiskType.DOSAGE_VIOLATION: "剂量越界",
            RiskType.MONITORING_GAP: "监护断采",
            RiskType.OTHER: "其他风险"
        }
        return names.get(risk_type, risk_type.value)
