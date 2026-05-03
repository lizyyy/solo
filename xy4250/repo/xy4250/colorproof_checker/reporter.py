import csv
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, Any
from decimal import Decimal

from colorproof_checker.models import (
    ProofTask, ProofStatus, RiskLevel,
    ColorMeasurement, InkFormula, PaperBatch, DryingRecord
)
from colorproof_checker.store import DataStore


class ReportExporter:
    def __init__(self, store: DataStore):
        self.store = store
    
    def _format_decimal(self, value: Any) -> str:
        if value is None:
            return "-"
        if isinstance(value, Decimal):
            return f"{value:.4f}"
        return str(value)
    
    def _format_datetime(self, value: Any) -> str:
        if value is None:
            return "-"
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(value, date):
            return value.strftime("%Y-%m-%d")
        return str(value)
    
    def _format_risk_level(self, level: RiskLevel) -> str:
        if level == RiskLevel.SAFE:
            return "安全"
        elif level == RiskLevel.WARNING:
            return "警告"
        elif level == RiskLevel.CRITICAL:
            return "严重"
        return "-"
    
    def _format_status(self, status: ProofStatus) -> str:
        status_map = {
            ProofStatus.PENDING: "待处理",
            ProofStatus.CHECKING: "检查中",
            ProofStatus.APPROVED: "已审核",
            ProofStatus.RELEASED: "已放行",
            ProofStatus.REJECTED: "已驳回",
            ProofStatus.ROLLED_BACK: "已回滚"
        }
        return status_map.get(status, str(status.value))
    
    def export_proof_markdown(self, proof: ProofTask, 
                              measurement: Optional[ColorMeasurement] = None,
                              formula: Optional[InkFormula] = None,
                              paper_batch: Optional[PaperBatch] = None,
                              drying_record: Optional[DryingRecord] = None) -> str:
        lines = []
        lines.append(f"# 专色打样放行复核单")
        lines.append("")
        lines.append(f"**生成时间:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 打样任务信息")
        lines.append("")
        lines.append(f"| 字段 | 值 |")
        lines.append(f"|------|-----|")
        lines.append(f"| 任务编号 | {proof.task_number} |")
        lines.append(f"| 任务ID | {proof.id} |")
        lines.append(f"| 客户ID | {proof.customer_id} |")
        lines.append(f"| 客户名称 | {proof.customer_name} |")
        lines.append(f"| 色号 | {proof.color_code} |")
        lines.append(f"| 颜色名称 | {proof.color_name} |")
        lines.append(f"| 纸张批次 | {proof.paper_batch_number} |")
        lines.append(f"| 油墨配方ID | {proof.ink_formula_id} |")
        lines.append(f"| 当前状态 | {self._format_status(proof.status)} |")
        lines.append(f"| 风险等级 | {self._format_risk_level(proof.risk_level)} |")
        lines.append(f"| 创建时间 | {self._format_datetime(proof.create_time)} |")
        if proof.release_time:
            lines.append(f"| 放行时间 | {self._format_datetime(proof.release_time)} |")
        if proof.released_by:
            lines.append(f"| 放行人员 | {proof.released_by} |")
        lines.append("")
        
        if proof.risks:
            lines.append("## 风险警告")
            lines.append("")
            for i, risk in enumerate(proof.risks, 1):
                risk_type = risk.get('check_type', 'unknown')
                risk_level = risk.get('risk_level', 'unknown')
                message = risk.get('message', '')
                lines.append(f"### 风险 {i}: {risk_type.upper()}")
                lines.append(f"- **等级**: {self._format_risk_level(RiskLevel(risk_level)) if risk_level != 'unknown' else risk_level}")
                lines.append(f"- **说明**: {message}")
                lines.append("")
        
        if measurement:
            lines.append("## 色差测量数据")
            lines.append("")
            lines.append(f"| 指标 | 测量值 |")
            lines.append(f"|------|--------|")
            lines.append(f"| 样品名称 | {measurement.sample_name} |")
            lines.append(f"| 批次号 | {measurement.batch_number} |")
            lines.append(f"| 色号 | {measurement.color_code} |")
            lines.append(f"| DeltaE | {self._format_decimal(measurement.delta_e)} |")
            if measurement.delta_l is not None:
                lines.append(f"| DeltaL | {self._format_decimal(measurement.delta_l)} |")
            if measurement.delta_a is not None:
                lines.append(f"| DeltaA | {self._format_decimal(measurement.delta_a)} |")
            if measurement.delta_b is not None:
                lines.append(f"| DeltaB | {self._format_decimal(measurement.delta_b)} |")
            if measurement.lab_l is not None:
                lines.append(f"| L* | {self._format_decimal(measurement.lab_l)} |")
            if measurement.lab_a is not None:
                lines.append(f"| a* | {self._format_decimal(measurement.lab_a)} |")
            if measurement.lab_b is not None:
                lines.append(f"| b* | {self._format_decimal(measurement.lab_b)} |")
            if measurement.measurement_date:
                lines.append(f"| 测量时间 | {self._format_datetime(measurement.measurement_date)} |")
            lines.append("")
        
        if formula:
            lines.append("## 油墨配方信息")
            lines.append("")
            lines.append(f"| 字段 | 值 |")
            lines.append(f"|------|-----|")
            lines.append(f"| 配方ID | {formula.id} |")
            lines.append(f"| 色号 | {formula.color_code} |")
            lines.append(f"| 颜色名称 | {formula.color_name} |")
            if formula.pantone_code:
                lines.append(f"| Pantone色号 | {formula.pantone_code} |")
            lines.append(f"| 总重量 | {self._format_decimal(formula.total_weight)} g |")
            if formula.viscosity:
                lines.append(f"| 粘度 | {self._format_decimal(formula.viscosity)} |")
            if formula.ph_value:
                lines.append(f"| pH值 | {self._format_decimal(formula.ph_value)} |")
            if formula.create_date:
                lines.append(f"| 创建日期 | {self._format_datetime(formula.create_date)} |")
            lines.append("")
            
            if formula.base_inks:
                lines.append("### 基础油墨配比")
                lines.append("")
                lines.append(f"| 油墨编号 | 重量 (g) | 占比 (%) |")
                lines.append(f"|----------|----------|----------|")
                total = formula.total_weight
                for ink_name, weight in formula.base_inks.items():
                    percentage = (weight / total) * Decimal("100") if total > 0 else Decimal("0")
                    lines.append(f"| {ink_name} | {self._format_decimal(weight)} | {percentage:.2f} |")
                lines.append("")
        
        if paper_batch:
            lines.append("## 纸张批次信息")
            lines.append("")
            lines.append(f"| 字段 | 值 |")
            lines.append(f"|------|-----|")
            lines.append(f"| 批次ID | {paper_batch.id} |")
            lines.append(f"| 批次号 | {paper_batch.batch_number} |")
            lines.append(f"| 纸张类型 | {paper_batch.paper_type} |")
            lines.append(f"| 纸张名称 | {paper_batch.paper_name} |")
            lines.append(f"| 克重 | {paper_batch.grammage} g/m² |")
            if paper_batch.width:
                lines.append(f"| 宽度 | {paper_batch.width} mm |")
            if paper_batch.length:
                lines.append(f"| 长度 | {paper_batch.length} mm |")
            if paper_batch.supplier:
                lines.append(f"| 供应商 | {paper_batch.supplier} |")
            if paper_batch.manufacture_date:
                lines.append(f"| 生产日期 | {self._format_datetime(paper_batch.manufacture_date)} |")
            if paper_batch.expiry_date:
                lines.append(f"| 有效期至 | {self._format_datetime(paper_batch.expiry_date)} |")
            if paper_batch.received_date:
                lines.append(f"| 入库日期 | {self._format_datetime(paper_batch.received_date)} |")
            if paper_batch.total_quantity:
                lines.append(f"| 总数量 | {self._format_decimal(paper_batch.total_quantity)} |")
            if paper_batch.warehouse_location:
                lines.append(f"| 库位 | {paper_batch.warehouse_location} |")
            lines.append("")
        
        if drying_record:
            lines.append("## 干燥/上光记录")
            lines.append("")
            lines.append(f"| 字段 | 值 |")
            lines.append(f"|------|-----|")
            lines.append(f"| 记录ID | {drying_record.id} |")
            lines.append(f"| 印刷时间 | {self._format_datetime(drying_record.print_time)} |")
            lines.append(f"| 干燥开始时间 | {self._format_datetime(drying_record.drying_start_time)} |")
            if drying_record.drying_end_time:
                lines.append(f"| 干燥结束时间 | {self._format_datetime(drying_record.drying_end_time)} |")
            lines.append(f"| 干燥方式 | {drying_record.drying_method} |")
            if drying_record.drying_temperature:
                lines.append(f"| 干燥温度 | {self._format_decimal(drying_record.drying_temperature)} °C |")
            if drying_record.drying_humidity:
                lines.append(f"| 干燥湿度 | {self._format_decimal(drying_record.drying_humidity)} % |")
            if drying_record.coating_type:
                lines.append(f"| 上光类型 | {drying_record.coating_type} |")
            if drying_record.coating_amount:
                lines.append(f"| 上光量 | {self._format_decimal(drying_record.coating_amount)} |")
            if drying_record.operator_name:
                lines.append(f"| 机长 | {drying_record.operator_name} |")
            if drying_record.visual_check_result is not None:
                lines.append(f"| 目视检查 | {'通过' if drying_record.visual_check_result else '未通过'} |")
            if drying_record.touch_check_result is not None:
                lines.append(f"| 触感检查 | {'通过' if drying_record.touch_check_result else '未通过'} |")
            lines.append("")
        
        if proof.notes:
            lines.append("## 备注")
            lines.append("")
            lines.append(proof.notes)
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此复核单由「专色打样放行员」系统自动生成*")
        
        return "\n".join(lines)
    
    def export_proof_csv(self, proof: ProofTask,
                         measurement: Optional[ColorMeasurement] = None,
                         formula: Optional[InkFormula] = None,
                         paper_batch: Optional[PaperBatch] = None,
                         drying_record: Optional[DryingRecord] = None) -> str:
        rows = []
        headers = ["类别", "字段", "值"]
        rows.append(headers)
        
        rows.append(["打样任务", "任务编号", proof.task_number])
        rows.append(["打样任务", "任务ID", proof.id])
        rows.append(["打样任务", "客户ID", proof.customer_id])
        rows.append(["打样任务", "客户名称", proof.customer_name])
        rows.append(["打样任务", "色号", proof.color_code])
        rows.append(["打样任务", "颜色名称", proof.color_name])
        rows.append(["打样任务", "纸张批次", proof.paper_batch_number])
        rows.append(["打样任务", "油墨配方ID", proof.ink_formula_id])
        rows.append(["打样任务", "当前状态", self._format_status(proof.status)])
        rows.append(["打样任务", "风险等级", self._format_risk_level(proof.risk_level)])
        rows.append(["打样任务", "创建时间", self._format_datetime(proof.create_time)])
        if proof.release_time:
            rows.append(["打样任务", "放行时间", self._format_datetime(proof.release_time)])
        if proof.released_by:
            rows.append(["打样任务", "放行人员", proof.released_by])
        
        if proof.risks:
            for i, risk in enumerate(proof.risks, 1):
                risk_type = risk.get('check_type', 'unknown')
                risk_level = risk.get('risk_level', 'unknown')
                message = risk.get('message', '')
                rows.append([f"风险{i}", "类型", risk_type])
                rows.append([f"风险{i}", "等级", self._format_risk_level(RiskLevel(risk_level)) if risk_level != 'unknown' else risk_level])
                rows.append([f"风险{i}", "说明", message])
        
        if measurement:
            rows.append(["色差测量", "样品名称", measurement.sample_name])
            rows.append(["色差测量", "批次号", measurement.batch_number])
            rows.append(["色差测量", "色号", measurement.color_code])
            rows.append(["色差测量", "DeltaE", self._format_decimal(measurement.delta_e)])
            if measurement.delta_l is not None:
                rows.append(["色差测量", "DeltaL", self._format_decimal(measurement.delta_l)])
            if measurement.delta_a is not None:
                rows.append(["色差测量", "DeltaA", self._format_decimal(measurement.delta_a)])
            if measurement.delta_b is not None:
                rows.append(["色差测量", "DeltaB", self._format_decimal(measurement.delta_b)])
            if measurement.measurement_date:
                rows.append(["色差测量", "测量时间", self._format_datetime(measurement.measurement_date)])
        
        if formula:
            rows.append(["油墨配方", "配方ID", formula.id])
            rows.append(["油墨配方", "色号", formula.color_code])
            rows.append(["油墨配方", "颜色名称", formula.color_name])
            if formula.pantone_code:
                rows.append(["油墨配方", "Pantone色号", formula.pantone_code])
            rows.append(["油墨配方", "总重量", f"{self._format_decimal(formula.total_weight)} g"])
            
            if formula.base_inks:
                total = formula.total_weight
                for ink_name, weight in formula.base_inks.items():
                    percentage = (weight / total) * Decimal("100") if total > 0 else Decimal("0")
                    rows.append(["油墨配比", ink_name, f"{self._format_decimal(weight)}g ({percentage:.2f}%)"])
        
        if paper_batch:
            rows.append(["纸张批次", "批次ID", paper_batch.id])
            rows.append(["纸张批次", "批次号", paper_batch.batch_number])
            rows.append(["纸张批次", "纸张类型", paper_batch.paper_type])
            rows.append(["纸张批次", "纸张名称", paper_batch.paper_name])
            rows.append(["纸张批次", "克重", f"{paper_batch.grammage} g/m²"])
            if paper_batch.expiry_date:
                rows.append(["纸张批次", "有效期至", self._format_datetime(paper_batch.expiry_date)])
        
        if drying_record:
            rows.append(["干燥记录", "记录ID", drying_record.id])
            rows.append(["干燥记录", "印刷时间", self._format_datetime(drying_record.print_time)])
            rows.append(["干燥记录", "干燥开始时间", self._format_datetime(drying_record.drying_start_time)])
            if drying_record.drying_end_time:
                rows.append(["干燥记录", "干燥结束时间", self._format_datetime(drying_record.drying_end_time)])
            rows.append(["干燥记录", "干燥方式", drying_record.drying_method])
            if drying_record.operator_name:
                rows.append(["干燥记录", "机长", drying_record.operator_name])
            if drying_record.touch_check_result is not None:
                rows.append(["干燥记录", "触感检查", '通过' if drying_record.touch_check_result else '未通过'])
        
        if proof.notes:
            rows.append(["备注", "", proof.notes])
        
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerows(rows)
        return output.getvalue()
    
    def export_summary_csv(self, proofs: List[ProofTask]) -> str:
        rows = []
        headers = [
            "任务编号", "任务ID", "客户名称", "色号", "颜色名称",
            "纸张批次", "状态", "风险等级", "创建时间", "放行时间", "放行人员"
        ]
        rows.append(headers)
        
        for proof in proofs:
            rows.append([
                proof.task_number,
                proof.id,
                proof.customer_name,
                proof.color_code,
                proof.color_name,
                proof.paper_batch_number,
                self._format_status(proof.status),
                self._format_risk_level(proof.risk_level),
                self._format_datetime(proof.create_time),
                self._format_datetime(proof.release_time),
                proof.released_by or ""
            ])
        
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerows(rows)
        return output.getvalue()
    
    def export_summary_markdown(self, proofs: List[ProofTask], title: str = "打样任务汇总") -> str:
        lines = []
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**生成时间:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        status_counts = {}
        risk_counts = {}
        for proof in proofs:
            status = self._format_status(proof.status)
            status_counts[status] = status_counts.get(status, 0) + 1
            risk = self._format_risk_level(proof.risk_level)
            risk_counts[risk] = risk_counts.get(risk, 0) + 1
        
        lines.append("## 统计概览")
        lines.append("")
        lines.append(f"**总任务数:** {len(proofs)}")
        lines.append("")
        lines.append("### 按状态统计")
        lines.append("")
        for status, count in status_counts.items():
            lines.append(f"- {status}: {count} 个")
        lines.append("")
        lines.append("### 按风险等级统计")
        lines.append("")
        for risk, count in risk_counts.items():
            lines.append(f"- {risk}: {count} 个")
        lines.append("")
        
        lines.append("## 任务列表")
        lines.append("")
        lines.append(f"| 任务编号 | 客户 | 色号 | 纸张批次 | 状态 | 风险等级 | 创建时间 |")
        lines.append(f"|----------|------|------|----------|------|----------|----------|")
        
        for proof in sorted(proofs, key=lambda p: p.create_time, reverse=True):
            lines.append(f"| {proof.task_number} | {proof.customer_name} | {proof.color_code} | {proof.paper_batch_number} | {self._format_status(proof.status)} | {self._format_risk_level(proof.risk_level)} | {self._format_datetime(proof.create_time)} |")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*此汇总表由「专色打样放行员」系统自动生成*")
        
        return "\n".join(lines)
    
    def save_markdown_report(self, content: str, filepath: str) -> str:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(path.absolute())
    
    def save_csv_report(self, content: str, filepath: str) -> str:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            f.write(content)
        
        return str(path.absolute())
