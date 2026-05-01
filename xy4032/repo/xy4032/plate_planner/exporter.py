"""
导出报告模块 - 导出96孔板CSV和Markdown操作单
"""

from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, TextIO

from .models import PlatePlan, WellAssignment, DilutionStep
from .config import PlateConfig


class PlateExporter:
    def __init__(self, plate_config: Optional[PlateConfig] = None):
        self.config = plate_config or PlateConfig()

    def export_csv(self, plan: PlatePlan, output_path: Path):
        well_map = {
            (wa.row, wa.col): wa
            for wa in plan.well_assignments
        }

        reserved_map: Dict[tuple, str] = {}
        for rw in plan.reserved_wells:
            row_char = rw["well"][0]
            col = int(rw["well"][1:]) - 1
            row = self.config.row_labels.index(row_char)
            reserved_map[(row, col)] = rw["purpose"]

        rows = []
        header = [""] + [str(c + 1) for c in range(self.config.cols)]
        rows.append(header)

        for r_idx, row_label in enumerate(self.config.row_labels):
            row_data = [row_label]
            for c_idx in range(self.config.cols):
                key = (r_idx, c_idx)
                if key in reserved_map:
                    row_data.append(f"[{reserved_map[key]}]")
                elif key in well_map:
                    wa = well_map[key]
                    row_data.append(wa.sample_id)
                else:
                    row_data.append("")
            rows.append(row_data)

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            import csv
            writer = csv.writer(f)
            writer.writerows(rows)

    def export_markdown(
        self,
        plan: PlatePlan,
        samples_info: Dict[str, Dict],
        output_path: Path,
    ):
        md_lines = []
        md_lines.append(f"# 96孔板操作单 - 板号 #{plan.plate_number}")
        md_lines.append("")
        md_lines.append(f"**生成时间**: {plan.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append(f"**方案ID**: {plan.plan_id}")
        md_lines.append(f"**已使用孔数**: {plan.total_wells_used} / {plan.total_wells_available}")
        md_lines.append("")

        md_lines.append("## 1. 板布局")
        md_lines.append("")
        md_lines.append("|   | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |")
        md_lines.append("|---|---|---|---|---|---|---|---|---|---|----|----|----|")

        well_map = {
            (wa.row, wa.col): wa
            for wa in plan.well_assignments
        }

        reserved_map: Dict[tuple, str] = {}
        for rw in plan.reserved_wells:
            row_char = rw["well"][0]
            col = int(rw["well"][1:]) - 1
            row = self.config.row_labels.index(row_char)
            reserved_map[(row, col)] = rw["purpose"]

        for r_idx, row_label in enumerate(self.config.row_labels):
            cells = [row_label]
            for c_idx in range(self.config.cols):
                key = (r_idx, c_idx)
                if key in reserved_map:
                    cells.append(f"*[{reserved_map[key]}]*")
                elif key in well_map:
                    wa = well_map[key]
                    if wa.replicate_index:
                        cells.append(f"{wa.sample_id}({wa.replicate_index})")
                    else:
                        cells.append(wa.sample_id)
                else:
                    cells.append("")
            md_lines.append("| " + " | ".join(cells) + " |")

        md_lines.append("")
        md_lines.append("## 2. 保留孔说明")
        md_lines.append("")
        md_lines.append("| 孔位 | 用途 |")
        md_lines.append("|------|------|")
        for rw in plan.reserved_wells:
            md_lines.append(f"| {rw['well']} | {rw['purpose']} |")

        md_lines.append("")
        md_lines.append("## 3. 样品稀释步骤")
        md_lines.append("")

        for sample_id in plan.samples:
            info = samples_info.get(sample_id, {})
            md_lines.append(f"### 样品 {sample_id}")
            md_lines.append("")
            if info:
                md_lines.append(f"- **初始浓度**: {info.get('initial_concentration', 'N/A')} {info.get('concentration_unit', '')}")
                md_lines.append(f"- **目标浓度**: {info.get('target_concentration', 'N/A')} {info.get('target_concentration_unit', info.get('concentration_unit', ''))}")
                md_lines.append(f"- **重复孔数**: {info.get('replicate_count', 1)}")
                if info.get('remark'):
                    md_lines.append(f"- **备注**: {info['remark']}")
                md_lines.append("")

            steps = plan.dilution_steps.get(sample_id, [])
            if steps:
                md_lines.append("| 步骤 | 来源浓度 | 目标浓度 | 稀释倍数 | 样品体积(ul) | 稀释液体积(ul) | 最终体积(ul) |")
                md_lines.append("|------|----------|----------|----------|--------------|----------------|--------------|")
                for step in steps:
                    md_lines.append(
                        f"| {step.step_number} | {step.source_concentration:.4f} {step.unit} | "
                        f"{step.target_concentration:.4f} {step.unit} | {step.dilution_factor:.2f}x | "
                        f"{step.sample_volume_ul:.2f} | {step.diluent_volume_ul:.2f} | {step.total_volume_ul:.2f} |"
                    )
            else:
                md_lines.append("*无需稀释*")
            md_lines.append("")

        md_lines.append("")
        md_lines.append("## 4. 孔位详情")
        md_lines.append("")
        md_lines.append("| 孔位 | 样品编号 | 浓度 | 体积(ul) | 重复孔 |")
        md_lines.append("|------|----------|------|----------|--------|")

        sorted_wells = sorted(
            plan.well_assignments,
            key=lambda wa: (wa.col, wa.row)
        )

        for wa in sorted_wells:
            replicate = wa.replicate_index if wa.replicate_index else "-"
            md_lines.append(
                f"| {wa.well} | {wa.sample_id} | {wa.concentration:.4f} {wa.concentration_unit} | "
                f"{wa.volume_ul:.2f} | {replicate} |"
            )

        md_lines.append("")
        md_lines.append("---")
        md_lines.append(f"*由 plate-planner 于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 生成*")

        output_path.write_text("\n".join(md_lines), encoding="utf-8")
