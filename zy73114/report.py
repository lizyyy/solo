from datetime import datetime
from typing import Optional
from models import ChangeOrder, ExportRecord, ProcessingType
from exporter import ExportResult, ChangeOrderExporter
from audit import HistoryAuditor
from core_logic import VersionClassifier

PROCESSING_LABEL_CN = {
    ProcessingType.ORIGINAL: "旧处理",
    ProcessingType.SUPPLEMENTARY: "后补备注",
    ProcessingType.LATEST: "最新导出",
}


class ReportGenerator:
    def __init__(self, change_order: ChangeOrder, export_result: ExportResult):
        self.change_order = change_order
        self.export_result = export_result
        self.record = export_result.export_record

    def render_markdown(self) -> str:
        lines = []
        lines.append(self._h1("施工变更交底清单"))
        lines.append("")
        lines.append(f"> 导出时间：{self.record.exported_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 导出人：{self.record.exported_by}")
        lines.append(f"> 处理类型：**{PROCESSING_LABEL_CN[self.record.processing_type]}**")
        lines.append(f"> 交付顺畅性评分：{self.record.delivery_smoothness_score}/100")
        lines.append("")

        lines.append(self._h2("一、页面摘要"))
        lines.append("")
        lines.append("```")
        lines.append(self.record.page_summary)
        lines.append("```")
        lines.append("")

        lines.append(self._h2("二、场景标注"))
        lines.append("")
        lines.append("```")
        lines.append(self.record.scene_annotation)
        lines.append("```")
        lines.append("")

        lines.append(self._h2("三、侧边说明"))
        lines.append("")
        lines.append("```")
        lines.append(self.record.sidebar_note)
        lines.append("```")
        lines.append("")

        lines.append(self._h2("四、分项判断清单"))
        lines.append("")
        lines.append("| 编号 | 分项名称 | 处理类型 | 原始判断 | 最终判断 | 依据 | 人工调整原因 |")
        lines.append("|------|---------|---------|---------|---------|------|------------|")

        classified = VersionClassifier.classify_export_components(self.change_order)
        type_map = {}
        for ptype, js in classified.items():
            for j in js:
                type_map[j.item_code] = PROCESSING_LABEL_CN[ptype]

        for j in self.record.judgements:
            ptype_label = type_map.get(j.item_code, PROCESSING_LABEL_CN[self.record.processing_type])
            reason = j.modification_reason if j.is_overridden else "-"
            basis_str = "、".join(j.basis)
            lines.append(
                f"| {j.item_code} | {j.item_name} | {ptype_label} | "
                f"{j.original_judgement} | {j.final_judgement} | {basis_str} | {reason} |"
            )
        lines.append("")

        lines.append(self._h2("五、现场签证单记录"))
        lines.append("")
        if not self.record.visa_notes:
            lines.append("_无现场签证单_")
        else:
            lines.append("| 签证内容 | 录入人 | 来源 | 影响类型 | 受影响分项 |")
            lines.append("|---------|-------|------|---------|----------|")
            for v in self.record.visa_notes:
                impact_str = "、".join([i.value for i in v.impacts])
                affected_codes = []
                for j in self.record.judgements:
                    if j.id in v.affected_judgements:
                        affected_codes.append(j.item_code)
                codes_str = "、".join(affected_codes) if affected_codes else "-"
                lines.append(
                    f"| {v.content} | {v.created_by} | {v.source_doc} | {impact_str} | {codes_str} |"
                )
        lines.append("")

        lines.append(self._h2("六、风险与提醒"))
        lines.append("")
        if not self.record.warnings:
            lines.append("_无特殊提醒_")
        else:
            for idx, w in enumerate(self.record.warnings, 1):
                lines.append(f"{idx}. {w}")
        lines.append("")

        if self.record.coordinate_offset:
            lines.append(self._h2("七、模型坐标偏移（需立即确认）"))
            lines.append("")
            co = self.record.coordinate_offset
            lines.append(f"- **偏移量**：X={co.offset_x:.3f}m，Y={co.offset_y:.3f}m，Z={co.offset_z:.3f}m")
            lines.append(f"- **确认人**：{co.confirmer_role} {co.confirmer_name}")
            lines.append(f"- **来源追溯**：优先查看「{co.source_record_title}」（ID: {co.source_record_id}）")
            lines.append(f"- **检测时间**：{co.detected_at.strftime('%Y-%m-%d %H:%M')}")
            if co.affected_regions:
                lines.append(f"- **受影响区域**：{'、'.join(co.affected_regions)}")
            lines.append("")

        lines.append(self._h2("八、历史调整原因（结构工程师老叶等）"))
        lines.append("")
        auditor = HistoryAuditor(self.change_order)
        overridden = [j for j in self.record.judgements if j.is_overridden]
        if not overridden:
            lines.append("_无人工调整记录_")
        else:
            for j in overridden:
                lines.append(self._h3(f"{j.item_code} {j.item_name}"))
                lines.append(f"- 调整人：**{j.modified_by}**")
                if j.modified_at:
                    lines.append(f"- 调整时间：{j.modified_at.strftime('%Y-%m-%d %H:%M')}")
                lines.append(f"- 调整原因：{j.modification_reason}")
                lines.append(f"- 原始判断：{j.original_judgement}")
                lines.append(f"- 最终判断：{j.final_judgement}")
                hist = auditor.get_judgement_history(j.item_code)
                if len(hist) > 1:
                    lines.append("- 变更轨迹：")
                    for ver, ts, val, op, reason in hist:
                        op_str = f"（{op}）" if op else ""
                        reason_str = f" — {reason}" if reason else ""
                        lines.append(f"  - V{ver} [{ts.strftime('%m-%d %H:%M')}]{op_str}：{val}{reason_str}")
                lines.append("")

        lines.append(self._h2("九、材料存放位置指引"))
        lines.append("")
        if self.record.material_location_hint:
            lines.append(self.record.material_location_hint)
        lines.append("")

        lines.append("---")
        lines.append(f"_本清单由施工变更交底工具自动生成，场景标注、侧边说明、页面摘要基于同一套最终判断结果。_")

        return "\n".join(lines)

    def render_text(self) -> str:
        md = self.render_markdown()
        return (
            md.replace("**", "")
            .replace("`", "")
            .replace("#", "")
            .replace("|", " ")
            .replace("_", "")
        )

    def save_markdown(self, filepath: Optional[str] = None) -> str:
        if filepath is None:
            ts = self.record.exported_at.strftime("%Y%m%d_%H%M%S")
            filepath = f"交底清单_{self.change_order.change_order_no}_{ts}.md"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(self.render_markdown())
        return filepath

    def save_text(self, filepath: Optional[str] = None) -> str:
        if filepath is None:
            ts = self.record.exported_at.strftime("%Y%m%d_%H%M%S")
            filepath = f"交底清单_{self.change_order.change_order_no}_{ts}.txt"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(self.render_text())
        return filepath

    @staticmethod
    def _h1(text: str) -> str:
        return f"# {text}"

    @staticmethod
    def _h2(text: str) -> str:
        return f"## {text}"

    @staticmethod
    def _h3(text: str) -> str:
        return f"### {text}"
