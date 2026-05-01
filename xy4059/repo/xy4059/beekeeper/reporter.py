"""报告导出器模块"""

import csv
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from collections import defaultdict

from .config import Config
from .store import (
    InspectionRecord, TreatmentRecord, HarvestRecord, 
    QuarantineRecord, DataStore
)
from .planner import PlanGenerator, PlanResult


@dataclass
class ReportResult:
    """报告生成结果"""
    markdown_path: Optional[str] = None
    csv_risk_path: Optional[str] = None
    json_audit_path: Optional[str] = None
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())


class Reporter:
    """报告导出器"""
    
    def __init__(self, config: Config, data_store: DataStore, output_dir: Optional[Path] = None):
        self.config = config
        self.data_store = data_store
        self.output_dir = output_dir or Path(config.output_dir)
        self.plan_generator = PlanGenerator(config, data_store)
    
    def generate_all_reports(self) -> ReportResult:
        """生成所有报告"""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        plan = self.plan_generator.generate_plan()
        
        markdown_path = self._generate_markdown_report(plan)
        csv_risk_path = self._generate_risk_csv(plan)
        json_audit_path = self._generate_audit_json()
        
        return ReportResult(
            markdown_path=markdown_path,
            csv_risk_path=csv_risk_path,
            json_audit_path=json_audit_path,
        )
    
    def _generate_markdown_report(self, plan: PlanResult) -> str:
        """生成 Markdown 复盘报告"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{timestamp}.md"
        filepath = self.output_dir / filename
        
        lines = self._build_markdown_content(plan)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return str(filepath)
    
    def _build_markdown_content(self, plan: PlanResult) -> List[str]:
        """构建 Markdown 内容"""
        lines = []
        lines.append("# 蜂箱巡检批次追溯员 - 复盘报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 1. 蜂场概览")
        lines.append("")
        lines.append(f"- **蜂场数量**: {len(self.config.apiaries)}")
        lines.append(f"- **蜂箱总数**: {len(self.config.hives)}")
        lines.append(f"- **巡检记录**: {self.data_store.count_inspections()} 条")
        lines.append(f"- **用药记录**: {self.data_store.count_treatments()} 条")
        lines.append(f"- **摇蜜记录**: {self.data_store.count_harvests()} 条")
        lines.append(f"- **隔离记录**: {self.data_store.count_quarantine()} 条")
        lines.append("")
        
        lines.append("## 2. 蜂场明细")
        lines.append("")
        for apiary in self.config.apiaries:
            hives = self.config.get_hives_by_apiary(apiary.name)
            lines.append(f"### {apiary.name}")
            lines.append("")
            if apiary.location:
                lines.append(f"- **位置**: {apiary.location}")
            lines.append(f"- **蜂箱数量**: {len(hives)}")
            lines.append("")
            lines.append("| 箱号 | 蜂王年份 | 备注 |")
            lines.append("|------|----------|------|")
            for hive in hives:
                notes = hive.notes or "-"
                lines.append(f"| {hive.hive_number} | {hive.queen_year} | {notes} |")
            lines.append("")
        
        lines.append("## 3. 巡检计划")
        lines.append("")
        
        if plan.inspection_reminders:
            priority_labels = {"urgent": "🔴 紧急", "high": "🟡 高优先级", "normal": "🟢 常规"}
            
            for reminder in plan.inspection_reminders:
                priority_display = priority_labels.get(reminder.priority, reminder.priority)
                lines.append(f"### {reminder.hive_number} ({reminder.apiary}) - {priority_display}")
                lines.append("")
                lines.append(f"- **蜂王年份**: {reminder.queen_year}")
                if reminder.last_inspection_date:
                    lines.append(f"- **上次巡检**: {reminder.last_inspection_date}")
                    if reminder.days_since_last_inspection is not None:
                        lines.append(f"- **距上次**: {reminder.days_since_last_inspection} 天")
                lines.append(f"- **建议下次巡检**: {reminder.recommended_next_inspection}")
                if reminder.reasons:
                    lines.append(f"- **关注原因**:")
                    for reason in reminder.reasons:
                        lines.append(f"  - {reason}")
                lines.append("")
        else:
            lines.append("暂无巡检提醒")
            lines.append("")
        
        lines.append("## 4. 禁采蜜提醒")
        lines.append("")
        
        if plan.harvest_restrictions:
            lines.append("| 箱号 | 蜂场 | 药物 | 用药日期 | 禁采至 | 剩余天数 |")
            lines.append("|------|------|------|----------|--------|----------|")
            for r in plan.harvest_restrictions:
                lines.append(f"| {r.hive_number} | {r.apiary} | {r.drug_name or '-'} | {r.treatment_date or '-'} | {r.safety_end_date or '-'} | {r.days_remaining or '-'} |")
        else:
            lines.append("所有蜂箱均可正常采蜜")
        lines.append("")
        
        lines.append("## 5. 风险蜂箱清单")
        lines.append("")
        
        if plan.risk_hives:
            risk_labels = {"critical": "🔴 严重", "high": "🟡 高风险", "medium": "🟠 中等", "low": "🟢 低"}
            
            for risk in plan.risk_hives:
                risk_display = risk_labels.get(risk.risk_level, risk.risk_level)
                lines.append(f"### {risk.hive_number} ({risk.apiary}) - {risk_display}")
                lines.append("")
                lines.append(f"- **风险类别**: {', '.join(risk.risk_categories)}")
                if risk.details:
                    lines.append(f"- **详情**:")
                    for key, value in risk.details.items():
                        lines.append(f"  - **{key}**: {value}")
                lines.append("")
        else:
            lines.append("暂无风险蜂箱")
            lines.append("")
        
        lines.append("## 6. 近期活动记录")
        lines.append("")
        
        lines.append("### 最近巡检记录")
        lines.append("")
        inspections = self.data_store.get_all_inspections()
        if inspections:
            recent_inspections = sorted(
                inspections,
                key=lambda r: r.date,
                reverse=True
            )[:10]
            
            lines.append("| 日期 | 箱号 | 群势 | 蜂王状态 | 病虫害 | 饲喂 |")
            lines.append("|------|------|------|----------|--------|------|")
            for r in recent_inspections:
                cs = r.colony_strength or "-"
                qs = r.queen_status or "-"
                pd = r.pests_diseases or "-"
                fd = r.feeding or "-"
                lines.append(f"| {r.date} | {r.hive_number} | {cs} | {qs} | {pd} | {fd} |")
        else:
            lines.append("暂无巡检记录")
        lines.append("")
        
        lines.append("### 最近用药记录")
        lines.append("")
        treatments = self.data_store.get_all_treatments()
        if treatments:
            recent_treatments = sorted(
                treatments,
                key=lambda r: r.date,
                reverse=True
            )[:10]
            
            lines.append("| 日期 | 箱号 | 类型 | 产品 | 剂量 |")
            lines.append("|------|------|------|------|------|")
            for r in recent_treatments:
                dosage = r.dosage or "-"
                lines.append(f"| {r.date} | {r.hive_number} | {r.treatment_type} | {r.product_name} | {dosage} |")
        else:
            lines.append("暂无用药记录")
        lines.append("")
        
        lines.append("### 最近摇蜜记录")
        lines.append("")
        harvests = self.data_store.get_all_harvests()
        if harvests:
            recent_harvests = sorted(
                harvests,
                key=lambda r: r.date,
                reverse=True
            )[:10]
            
            lines.append("| 日期 | 箱号 | 批次 | 产量(kg) | 含水率(%) |")
            lines.append("|------|------|------|----------|-----------|")
            for r in recent_harvests:
                qty = r.quantity_kg or "-"
                moist = r.moisture_content or "-"
                lines.append(f"| {r.date} | {r.hive_number} | {r.batch_number} | {qty} | {moist} |")
        else:
            lines.append("暂无摇蜜记录")
        lines.append("")
        
        lines.append("## 7. 药物安全间隔配置")
        lines.append("")
        if self.config.drugs:
            lines.append("| 药物名称 | 安全间隔(天) | 备注 |")
            lines.append("|----------|--------------|------|")
            for drug in self.config.drugs:
                desc = drug.description or "-"
                lines.append(f"| {drug.name} | {drug.safety_interval_days} | {desc} |")
        else:
            lines.append("暂无药物配置")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由蜂箱巡检批次追溯员自动生成*")
        
        return lines
    
    def _generate_risk_csv(self, plan: PlanResult) -> str:
        """生成风险箱 CSV 清单"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"risk_hives_{timestamp}.csv"
        filepath = self.output_dir / filename
        
        rows: List[Dict[str, Any]] = []
        
        for risk in plan.risk_hives:
            rows.append({
                "hive_number": risk.hive_number,
                "apiary": risk.apiary,
                "risk_level": risk.risk_level,
                "risk_categories": ", ".join(risk.risk_categories),
                "details": json.dumps(risk.details, ensure_ascii=False),
            })
        
        fieldnames = ["hive_number", "apiary", "risk_level", "risk_categories", "details"]
        
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return str(filepath)
    
    def _generate_audit_json(self) -> str:
        """生成 JSON 审计包"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"audit_{timestamp}.json"
        filepath = self.output_dir / filename
        
        audit_data = {
            "generated_at": datetime.now().isoformat(),
            "config": self.config.to_dict(),
            "statistics": {
                "total_apiaries": len(self.config.apiaries),
                "total_hives": len(self.config.hives),
                "total_drugs": len(self.config.drugs),
                "inspection_count": self.data_store.count_inspections(),
                "treatment_count": self.data_store.count_treatments(),
                "harvest_count": self.data_store.count_harvests(),
                "quarantine_count": self.data_store.count_quarantine(),
            },
            "inspections": [r.to_dict() for r in self.data_store.get_all_inspections()],
            "treatments": [r.to_dict() for r in self.data_store.get_all_treatments()],
            "harvests": [r.to_dict() for r in self.data_store.get_all_harvests()],
            "quarantine": [r.to_dict() for r in self.data_store.get_all_quarantine()],
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)
        
        return str(filepath)
    
    def generate_history_report(
        self,
        apiary: Optional[str] = None,
        hive_number: Optional[str] = None,
        batch_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        """生成历史查询报告"""
        result: Dict[str, Any] = {
            "query": {
                "apiary": apiary,
                "hive_number": hive_number,
                "batch_number": batch_number,
            },
            "timestamp": datetime.now().isoformat(),
            "inspections": [],
            "treatments": [],
            "harvests": [],
        }
        
        inspections = self.data_store.get_all_inspections()
        treatments = self.data_store.get_all_treatments()
        harvests = self.data_store.get_all_harvests()
        
        if hive_number:
            inspections = [r for r in inspections if r.hive_number == hive_number]
            treatments = [r for r in treatments if r.hive_number == hive_number]
            harvests = [r for r in harvests if r.hive_number == hive_number]
        
        if apiary:
            hive_numbers = [h.hive_number for h in self.config.get_hives_by_apiary(apiary)]
            inspections = [r for r in inspections if r.hive_number in hive_numbers]
            treatments = [r for r in treatments if r.hive_number in hive_numbers]
            harvests = [r for r in harvests if r.hive_number in hive_numbers]
        
        if batch_number:
            harvests = [r for r in harvests if r.batch_number == batch_number]
        
        result["inspections"] = [r.to_dict() for r in sorted(inspections, key=lambda r: r.date)]
        result["treatments"] = [r.to_dict() for r in sorted(treatments, key=lambda r: r.date)]
        result["harvests"] = [r.to_dict() for r in sorted(harvests, key=lambda r: r.date)]
        
        result["summary"] = {
            "inspection_count": len(result["inspections"]),
            "treatment_count": len(result["treatments"]),
            "harvest_count": len(result["harvests"]),
        }
        
        return result
