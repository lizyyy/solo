"""报告生成模块 - Markdown/CSV/JSON导出"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from nickel_plating_calculator.models.data_models import (
    BatchContext,
    CalculatedConcentrations,
    DosageResult,
    SimulatedResult,
    RiskAssessment,
    InventoryCheck,
    SolutionPlan,
    ApprovalRecord,
    RiskLevel,
    ApprovalStatus,
)
from nickel_plating_calculator.storage.store import EnhancedJSONEncoder


class MarkdownReporter:
    """Markdown作业单生成器"""
    
    def __init__(self):
        self._precision = 3
    
    def generate_work_order(
        self,
        context: BatchContext,
        selected_plan: Optional[SolutionPlan] = None,
        approval: Optional[ApprovalRecord] = None,
    ) -> str:
        """生成Markdown作业单"""
        lines = []
        
        lines.append("# 镀镍槽补加作业单")
        lines.append("")
        
        lines.append("## 基本信息")
        lines.append("")
        lines.append(f"- **批次号**: {context.batch_id}")
        lines.append(f"- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        if context.titration:
            lines.append(f"- **滴定时间**: {context.titration.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"- **化验员**: {context.titration.operator}")
        lines.append("")
        
        if context.tank_record:
            lines.append("## 槽液状态")
            lines.append("")
            lines.append(f"- **槽号**: {context.tank_record.tank_id}")
            lines.append(f"- **槽液体积**: {context.tank_record.volume_liters:.0f} L")
            lines.append(f"- **槽液温度**: {context.tank_record.temperature_celsius:.1f} °C")
            lines.append("")
        
        if context.concentrations:
            lines.append("## 当前浓度分析")
            lines.append("")
            lines.append("| 成分 | 当前浓度 | 目标浓度 | 范围 | 状态 |")
            lines.append("|------|----------|----------|------|------|")
            
            ns_status = self._get_status_text(context.concentrations.nickel_sulfate_status)
            nc_status = self._get_status_text(context.concentrations.nickel_chloride_status)
            ba_status = self._get_status_text(context.concentrations.boric_acid_status)
            ph_status = self._get_status_text(context.concentrations.ph_status)
            
            params = context.process_params
            if params:
                lines.append(
                    f"| 硫酸镍 | {context.concentrations.nickel_sulfate_g_l:.2f} g/L | "
                    f"{params.nickel_sulfate_target_g_l:.0f} g/L | "
                    f"{params.nickel_sulfate_min_g_l:.0f}-{params.nickel_sulfate_max_g_l:.0f} g/L | "
                    f"{ns_status} |"
                )
                lines.append(
                    f"| 氯化镍 | {context.concentrations.nickel_chloride_g_l:.2f} g/L | "
                    f"{params.nickel_chloride_target_g_l:.0f} g/L | "
                    f"{params.nickel_chloride_min_g_l:.0f}-{params.nickel_chloride_max_g_l:.0f} g/L | "
                    f"{nc_status} |"
                )
                lines.append(
                    f"| 硼酸 | {context.concentrations.boric_acid_g_l:.2f} g/L | "
                    f"{params.boric_acid_target_g_l:.0f} g/L | "
                    f"{params.boric_acid_min_g_l:.0f}-{params.boric_acid_max_g_l:.0f} g/L | "
                    f"{ba_status} |"
                )
                lines.append(
                    f"| pH | {context.concentrations.ph_value:.2f} | "
                    f"{params.ph_target:.1f} | "
                    f"{params.ph_min:.1f}-{params.ph_max:.1f} | "
                    f"{ph_status} |"
                )
            lines.append("")
        
        if selected_plan:
            lines.append("## 推荐补加方案")
            lines.append("")
            lines.append(f"**方案名称**: {selected_plan.plan_name}")
            lines.append(f"**方案ID**: {selected_plan.plan_id}")
            lines.append("")
            
            lines.append("### 补加量")
            lines.append("")
            lines.append("| 药剂 | 补加量 | 单位 |")
            lines.append("|------|--------|------|")
            
            if selected_plan.dosage.nickel_sulfate_to_add_kg > 0:
                lines.append(f"| 硫酸镍 | {selected_plan.dosage.nickel_sulfate_to_add_kg:.3f} | kg |")
            if selected_plan.dosage.nickel_chloride_to_add_kg > 0:
                lines.append(f"| 氯化镍 | {selected_plan.dosage.nickel_chloride_to_add_kg:.3f} | kg |")
            if selected_plan.dosage.boric_acid_to_add_kg > 0:
                lines.append(f"| 硼酸 | {selected_plan.dosage.boric_acid_to_add_kg:.3f} | kg |")
            if selected_plan.dosage.sulfuric_acid_to_add_ml:
                lines.append(f"| 硫酸 | {selected_plan.dosage.sulfuric_acid_to_add_ml:.2f} | mL |")
            if selected_plan.dosage.sodium_hydroxide_to_add_ml:
                lines.append(f"| 氢氧化钠 | {selected_plan.dosage.sodium_hydroxide_to_add_ml:.2f} | mL |")
            lines.append("")
            
            lines.append("### 补加后预测")
            lines.append("")
            lines.append("| 成分 | 预测浓度 | 是否在范围 |")
            lines.append("|------|----------|------------|")
            
            sim = selected_plan.simulation
            ns_in_range = "✓" if sim.nickel_sulfate_in_range else "✗"
            nc_in_range = "✓" if sim.nickel_chloride_in_range else "✗"
            ba_in_range = "✓" if sim.boric_acid_in_range else "✗"
            ph_in_range = "✓" if sim.ph_in_range else "✗"
            
            lines.append(f"| 硫酸镍 | {sim.simulated_nickel_sulfate_g_l:.2f} g/L | {ns_in_range} |")
            lines.append(f"| 氯化镍 | {sim.simulated_nickel_chloride_g_l:.2f} g/L | {nc_in_range} |")
            lines.append(f"| 硼酸 | {sim.simulated_boric_acid_g_l:.2f} g/L | {ba_in_range} |")
            lines.append(f"| pH | {sim.simulated_ph:.2f} | {ph_in_range} |")
            lines.append("")
            
            lines.append("### 风险评估")
            lines.append("")
            lines.append(f"**整体风险等级**: {selected_plan.risks.overall_risk.value}")
            lines.append(f"**是否可执行**: {'✓ 是' if selected_plan.risks.can_proceed else '✗ 否'}")
            lines.append("")
            
            if selected_plan.risks.risks:
                lines.append("#### 风险详情")
                lines.append("")
                for i, risk in enumerate(selected_plan.risks.risks, 1):
                    lines.append(f"**{i}. [{risk.level.value}] {risk.category}**")
                    lines.append(f"   - 描述: {risk.description}")
                    lines.append(f"   - 建议: {risk.suggestion}")
                    lines.append("")
            
            lines.append("### 库存检查")
            lines.append("")
            lines.append("| 药剂 | 是否充足 | 缺货量 |")
            lines.append("|------|----------|--------|")
            
            inv = selected_plan.inventory
            ns_available = "✓" if inv.nickel_sulfate_available else "✗"
            nc_available = "✓" if inv.nickel_chloride_available else "✗"
            ba_available = "✓" if inv.boric_acid_available else "✗"
            
            ns_shortage = f"{inv.nickel_sulfate_shortage_kg:.3f} kg" if inv.nickel_sulfate_shortage_kg > 0 else "-"
            nc_shortage = f"{inv.nickel_chloride_shortage_kg:.3f} kg" if inv.nickel_chloride_shortage_kg > 0 else "-"
            ba_shortage = f"{inv.boric_acid_shortage_kg:.3f} kg" if inv.boric_acid_shortage_kg > 0 else "-"
            
            lines.append(f"| 硫酸镍 | {ns_available} | {ns_shortage} |")
            lines.append(f"| 氯化镍 | {nc_available} | {nc_shortage} |")
            lines.append(f"| 硼酸 | {ba_available} | {ba_shortage} |")
            lines.append("")
        
        if len(context.plans) > 1 and not selected_plan:
            lines.append("## 方案对比")
            lines.append("")
            lines.append("| 方案 | 风险等级 | 可执行 | 库存充足 |")
            lines.append("|------|----------|--------|----------|")
            for plan_id, plan in context.plans.items():
                risk_str = plan.risks.overall_risk.value
                can_proceed = "✓" if plan.risks.can_proceed else "✗"
                inventory_ok = "✓" if plan.inventory.all_available else "✗"
                lines.append(f"| {plan.plan_name} | {risk_str} | {can_proceed} | {inventory_ok} |")
            lines.append("")
        
        if approval:
            lines.append("## 放行记录")
            lines.append("")
            lines.append(f"- **放行时间**: {approval.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"- **操作员**: {approval.operator}")
            lines.append(f"- **审核人**: {approval.reviewer}")
            lines.append(f"- **状态**: {approval.status.value}")
            lines.append("")
            
            if approval.notes:
                lines.append(f"**备注**: {approval.notes}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此作业单由镀镍槽补加推演器自动生成*")
        
        return "\n".join(lines)
    
    def _get_status_text(self, status: str) -> str:
        """获取状态文本"""
        status_map = {
            "normal": "正常",
            "low": "偏低",
            "high": "偏高",
        }
        return status_map.get(status, status)
    
    def save_work_order(
        self,
        output_path: Union[str, Path],
        context: BatchContext,
        selected_plan: Optional[SolutionPlan] = None,
        approval: Optional[ApprovalRecord] = None,
    ) -> Path:
        """保存Markdown作业单到文件"""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        content = self.generate_work_order(context, selected_plan, approval)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return output_path


class CSVReporter:
    """CSV批次表生成器"""
    
    def generate_batch_table(self, context: BatchContext) -> List[Dict[str, Any]]:
        """生成批次表数据"""
        rows = []
        
        row: Dict[str, Any] = {
            "batch_id": context.batch_id,
            "generated_at": datetime.now().isoformat(),
        }
        
        if context.titration:
            row["titration_time"] = context.titration.timestamp.isoformat()
            row["operator"] = context.titration.operator
            row["ns_edta_ml"] = context.titration.nickel_sulfate_edta_volume
            row["nc_edta_ml"] = context.titration.nickel_chloride_edta_volume
            row["boric_titrant_ml"] = context.titration.boric_titrant_volume
            row["ph_measured"] = context.titration.ph_value
        
        if context.tank_record:
            row["tank_id"] = context.tank_record.tank_id
            row["volume_liters"] = context.tank_record.volume_liters
            row["temperature_c"] = context.tank_record.temperature_celsius
        
        if context.concentrations:
            row["ns_current_g_l"] = context.concentrations.nickel_sulfate_g_l
            row["nc_current_g_l"] = context.concentrations.nickel_chloride_g_l
            row["ba_current_g_l"] = context.concentrations.boric_acid_g_l
            row["ph_current"] = context.concentrations.ph_value
        
        for plan_id, plan in context.plans.items():
            prefix = f"{plan.plan_name}_"
            row[f"{prefix}ns_add_kg"] = plan.dosage.nickel_sulfate_to_add_kg
            row[f"{prefix}nc_add_kg"] = plan.dosage.nickel_chloride_to_add_kg
            row[f"{prefix}ba_add_kg"] = plan.dosage.boric_acid_to_add_kg
            row[f"{prefix}h2so4_add_ml"] = plan.dosage.sulfuric_acid_to_add_ml or 0
            row[f"{prefix}naoh_add_ml"] = plan.dosage.sodium_hydroxide_to_add_ml or 0
            row[f"{prefix}risk_level"] = plan.risks.overall_risk.value
            row[f"{prefix}can_proceed"] = plan.risks.can_proceed
            row[f"{prefix}inventory_ok"] = plan.inventory.all_available
        
        if context.approval:
            row["approval_status"] = context.approval.status.value
            row["approval_time"] = context.approval.timestamp.isoformat()
            row["reviewer"] = context.approval.reviewer
            row["selected_plan"] = context.approval.selected_plan_id
        
        rows.append(row)
        return rows
    
    def save_batch_table(
        self,
        output_path: Union[str, Path],
        context: BatchContext,
        append: bool = False,
    ) -> Path:
        """保存CSV批次表到文件"""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        rows = self.generate_batch_table(context)
        
        if not rows:
            return output_path
        
        fieldnames = list(rows[0].keys())
        
        mode = "a" if append and output_path.exists() else "w"
        write_header = mode == "w" or not output_path.exists()
        
        with open(output_path, mode, encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if write_header:
                writer.writeheader()
            writer.writerows(rows)
        
        return output_path


class JSONAuditor:
    """JSON审计包生成器"""
    
    def generate_audit_package(
        self,
        context: BatchContext,
        include_audit_log: bool = True,
    ) -> Dict[str, Any]:
        """生成完整的审计包"""
        package = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "batch_id": context.batch_id,
            "created_at": context.created_at.isoformat() if context.created_at else None,
        }
        
        if context.titration:
            package["titration"] = {
                "batch_id": context.titration.batch_id,
                "timestamp": context.titration.timestamp.isoformat(),
                "operator": context.titration.operator,
                "nickel_sulfate_edta_volume": context.titration.nickel_sulfate_edta_volume,
                "nickel_chloride_edta_volume": context.titration.nickel_chloride_edta_volume,
                "boric_titrant_volume": context.titration.boric_titrant_volume,
                "ph_value": context.titration.ph_value,
                "sample_volume": context.titration.sample_volume,
                "edta_concentration": context.titration.edta_concentration,
                "naoh_concentration": context.titration.naoh_concentration,
            }
        
        if context.tank_record:
            package["tank_record"] = {
                "tank_id": context.tank_record.tank_id,
                "batch_id": context.tank_record.batch_id,
                "timestamp": context.tank_record.timestamp.isoformat(),
                "operator": context.tank_record.operator,
                "volume_liters": context.tank_record.volume_liters,
                "temperature_celsius": context.tank_record.temperature_celsius,
                "current_ph": context.tank_record.current_ph,
                "notes": context.tank_record.notes,
            }
        
        if context.concentrations:
            package["concentrations"] = {
                "batch_id": context.concentrations.batch_id,
                "timestamp": context.concentrations.timestamp.isoformat(),
                "nickel_sulfate_g_l": context.concentrations.nickel_sulfate_g_l,
                "nickel_chloride_g_l": context.concentrations.nickel_chloride_g_l,
                "boric_acid_g_l": context.concentrations.boric_acid_g_l,
                "ph_value": context.concentrations.ph_value,
                "nickel_sulfate_status": context.concentrations.nickel_sulfate_status,
                "nickel_chloride_status": context.concentrations.nickel_chloride_status,
                "boric_acid_status": context.concentrations.boric_acid_status,
                "ph_status": context.concentrations.ph_status,
            }
        
        if context.process_params:
            package["process_parameters"] = {
                "nickel_sulfate_target_g_l": context.process_params.nickel_sulfate_target_g_l,
                "nickel_sulfate_min_g_l": context.process_params.nickel_sulfate_min_g_l,
                "nickel_sulfate_max_g_l": context.process_params.nickel_sulfate_max_g_l,
                "nickel_chloride_target_g_l": context.process_params.nickel_chloride_target_g_l,
                "nickel_chloride_min_g_l": context.process_params.nickel_chloride_min_g_l,
                "nickel_chloride_max_g_l": context.process_params.nickel_chloride_max_g_l,
                "boric_acid_target_g_l": context.process_params.boric_acid_target_g_l,
                "boric_acid_min_g_l": context.process_params.boric_acid_min_g_l,
                "boric_acid_max_g_l": context.process_params.boric_acid_max_g_l,
                "ph_target": context.process_params.ph_target,
                "ph_min": context.process_params.ph_min,
                "ph_max": context.process_params.ph_max,
            }
        
        if context.inventory:
            package["inventory"] = {}
            for name, inv in context.inventory.items():
                package["inventory"][name] = {
                    "chemical_name": inv.chemical_name,
                    "batch_id": inv.batch_id,
                    "timestamp": inv.timestamp.isoformat(),
                    "operator": inv.operator,
                    "current_quantity_kg": inv.current_quantity_kg,
                    "minimum_stock_kg": inv.minimum_stock_kg,
                    "unit_price_per_kg": inv.unit_price_per_kg,
                    "supplier": inv.supplier,
                    "lot_number": inv.lot_number,
                }
        
        if context.plans:
            package["plans"] = {}
            for plan_id, plan in context.plans.items():
                package["plans"][plan_id] = {
                    "plan_id": plan.plan_id,
                    "plan_name": plan.plan_name,
                    "created_at": plan.created_at.isoformat(),
                    "operator": plan.operator,
                    "is_preferred": plan.is_preferred,
                    "dosage": {
                        "nickel_sulfate_to_add_kg": plan.dosage.nickel_sulfate_to_add_kg,
                        "nickel_chloride_to_add_kg": plan.dosage.nickel_chloride_to_add_kg,
                        "boric_acid_to_add_kg": plan.dosage.boric_acid_to_add_kg,
                        "sulfuric_acid_to_add_ml": plan.dosage.sulfuric_acid_to_add_ml,
                        "sodium_hydroxide_to_add_ml": plan.dosage.sodium_hydroxide_to_add_ml,
                    },
                    "simulation": {
                        "simulated_nickel_sulfate_g_l": plan.simulation.simulated_nickel_sulfate_g_l,
                        "simulated_nickel_chloride_g_l": plan.simulation.simulated_nickel_chloride_g_l,
                        "simulated_boric_acid_g_l": plan.simulation.simulated_boric_acid_g_l,
                        "simulated_ph": plan.simulation.simulated_ph,
                        "nickel_sulfate_in_range": plan.simulation.nickel_sulfate_in_range,
                        "nickel_chloride_in_range": plan.simulation.nickel_chloride_in_range,
                        "boric_acid_in_range": plan.simulation.boric_acid_in_range,
                        "ph_in_range": plan.simulation.ph_in_range,
                        "all_in_range": plan.simulation.all_in_range,
                    },
                    "risks": {
                        "overall_risk": plan.risks.overall_risk.value,
                        "can_proceed": plan.risks.can_proceed,
                        "risks": [
                            {
                                "category": r.category,
                                "description": r.description,
                                "level": r.level.value,
                                "suggestion": r.suggestion,
                                "details": r.details,
                            }
                            for r in plan.risks.risks
                        ],
                    },
                    "inventory": {
                        "nickel_sulfate_available": plan.inventory.nickel_sulfate_available,
                        "nickel_chloride_available": plan.inventory.nickel_chloride_available,
                        "boric_acid_available": plan.inventory.boric_acid_available,
                        "nickel_sulfate_shortage_kg": plan.inventory.nickel_sulfate_shortage_kg,
                        "nickel_chloride_shortage_kg": plan.inventory.nickel_chloride_shortage_kg,
                        "boric_acid_shortage_kg": plan.inventory.boric_acid_shortage_kg,
                        "all_available": plan.inventory.all_available,
                    },
                }
        
        if context.approval:
            package["approval"] = {
                "approval_id": context.approval.approval_id,
                "batch_id": context.approval.batch_id,
                "timestamp": context.approval.timestamp.isoformat(),
                "operator": context.approval.operator,
                "reviewer": context.approval.reviewer,
                "selected_plan_id": context.approval.selected_plan_id,
                "status": context.approval.status.value,
                "actual_nickel_sulfate_added_kg": context.approval.actual_nickel_sulfate_added_kg,
                "actual_nickel_chloride_added_kg": context.approval.actual_nickel_chloride_added_kg,
                "actual_boric_acid_added_kg": context.approval.actual_boric_acid_added_kg,
                "actual_sulfuric_acid_added_ml": context.approval.actual_sulfuric_acid_added_ml,
                "actual_sodium_hydroxide_added_ml": context.approval.actual_sodium_hydroxide_added_ml,
                "notes": context.approval.notes,
            }
        
        if include_audit_log and context.audit_log:
            package["audit_log"] = [
                {
                    "entry_id": entry.entry_id,
                    "timestamp": entry.timestamp.isoformat(),
                    "operator": entry.operator,
                    "action": entry.action,
                    "details": entry.details,
                    "batch_id": entry.batch_id,
                    "plan_id": entry.plan_id,
                    "approval_id": entry.approval_id,
                }
                for entry in context.audit_log
            ]
        
        return package
    
    def save_audit_package(
        self,
        output_path: Union[str, Path],
        context: BatchContext,
        include_audit_log: bool = True,
    ) -> Path:
        """保存JSON审计包到文件"""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        package = self.generate_audit_package(context, include_audit_log)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(package, f, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=2)
        
        return output_path
