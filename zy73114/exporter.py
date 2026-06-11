from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

from models import (
    ChangeOrder,
    ExportRecord,
    ProcessingType,
    CoordinateOffset,
    VisaNote,
    JudgementImpact,
    ChangeOrderStatus,
    Judgement,
)
from core_logic import (
    ConsistencyValidator,
    ConsistencyCheckResult,
    ImpactTracker,
    VersionClassifier,
)


@dataclass
class UnifiedAnnotation:
    scene_annotation: str
    sidebar_note: str
    page_summary: str
    core_judgement: str


@dataclass
class ExportResult:
    export_record: ExportRecord
    consistency_check: ConsistencyCheckResult
    processing_type_label: str
    component_markers: Dict[str, List[str]]


class ChangeOrderExporter:
    PROCESSING_TYPE_LABELS = {
        ProcessingType.ORIGINAL: "【旧处理】",
        ProcessingType.SUPPLEMENTARY: "【后补备注】",
        ProcessingType.LATEST: "【最新导出】",
    }

    def __init__(self, change_order: ChangeOrder):
        self.change_order = change_order

    def export(
        self,
        exported_by: str,
        rerun_material: bool = False,
        custom_annotation: Optional[UnifiedAnnotation] = None,
    ) -> ExportResult:
        processing_type = VersionClassifier.determine_processing_type(
            self.change_order, rerun_material
        )

        if custom_annotation:
            annotation = custom_annotation
        else:
            annotation = self._generate_unified_annotation(processing_type)

        consistency_check = ConsistencyValidator.check_annotation_consistency(
            annotation.scene_annotation,
            annotation.sidebar_note,
            annotation.page_summary,
        )

        if not consistency_check.is_consistent:
            annotation = self._auto_correct_annotation(
                annotation, consistency_check
            )
            consistency_check = ConsistencyValidator.check_annotation_consistency(
                annotation.scene_annotation,
                annotation.sidebar_note,
                annotation.page_summary,
            )

        warnings = self._collect_warnings()

        component_markers = self._generate_component_markers(processing_type)

        material_hint, smoothness_score = self._check_delivery_smoothness()

        export_record = ExportRecord(
            exported_at=datetime.now(),
            exported_by=exported_by,
            processing_type=processing_type,
            scene_annotation=annotation.scene_annotation,
            sidebar_note=annotation.sidebar_note,
            page_summary=annotation.page_summary,
            judgements=[Judgement(**j.__dict__) for j in self.change_order.judgements],
            visa_notes=[VisaNote(**v.__dict__) for v in self.change_order.visa_notes],
            coordinate_offset=(
                CoordinateOffset(**self.change_order.coordinate_offsets[-1].__dict__)
                if self.change_order.coordinate_offsets else None
            ),
            warnings=warnings,
            material_location_hint=material_hint,
            delivery_smoothness_score=smoothness_score,
        )

        self.change_order.export_records.append(export_record)
        self.change_order.status = ChangeOrderStatus.EXPORTED

        return ExportResult(
            export_record=export_record,
            consistency_check=consistency_check,
            processing_type_label=self.PROCESSING_TYPE_LABELS[processing_type],
            component_markers=component_markers,
        )

    def _generate_unified_annotation(
        self,
        processing_type: ProcessingType
    ) -> UnifiedAnnotation:
        latest_drawing = self.change_order.get_latest_drawing()
        drawing_info = (
            f"{latest_drawing.version}（{latest_drawing.issued_at.strftime('%Y-%m-%d')}）"
            if latest_drawing else "待确认"
        )

        core_judgement = self._generate_core_judgement()
        type_label = self.PROCESSING_TYPE_LABELS[processing_type]

        visa_summaries = [
            f"现场签证（{v.created_at.strftime('%H:%M')}）：{v.content[:20]}..."
            for v in self.change_order.visa_notes
        ]
        visa_section = "\n".join(visa_summaries) if visa_summaries else "无现场签证"

        overridden_items = [
            f"{j.item_code} {j.item_name}：{j.modification_reason}"
            for j in self.change_order.judgements if j.is_overridden
        ]
        override_section = "\n".join(overridden_items) if overridden_items else "无人工干预"

        base_content = f"""项目名称：{self.change_order.project_name}
变更编号：{self.change_order.change_order_no}
图纸版本：{drawing_info}
核心判断：{core_judgement}
{type_label}

签证影响：
{visa_section}

人工调整记录：
{override_section}
"""

        scene_annotation = f"【场景标注】\n{base_content}\n适用场景：本交底清单适用于施工前评审会现场核对，所有判断结论以最新图纸版本为准。"
        sidebar_note = f"【侧边说明】\n{base_content}\n备注：图纸版本多于一版时，以标记「最新版」的图纸为准，如有疑问请联系结构工程师老叶确认。"
        page_summary = f"【页面摘要】\n{base_content}\n摘要：本清单综合了图纸变更、现场签证及坐标偏移等因素，所有判断保持一致口径，避免三套话。"

        return UnifiedAnnotation(
            scene_annotation=scene_annotation,
            sidebar_note=sidebar_note,
            page_summary=page_summary,
            core_judgement=core_judgement,
        )

    def _generate_core_judgement(self) -> str:
        if not self.change_order.judgements:
            return "暂无判断结论"

        overridden = [j for j in self.change_order.judgements if j.is_overridden]
        total = len(self.change_order.judgements)
        changed_by_visa = sum(
            1 for j in self.change_order.judgements
            if any("依据现场签证" in j.final_judgement for v in self.change_order.visa_notes)
        )

        latest_drawing = self.change_order.get_latest_drawing()
        drawing_version = latest_drawing.version if latest_drawing else "未知"

        return (
            f"本次交底共 {total} 项分项判断，"
            f"其中 {len(overridden)} 项经结构工程师人工调整，"
            f"{changed_by_visa} 项受现场签证影响，"
            f"所有判断依据图纸版本 {drawing_version}。"
        )

    def _auto_correct_annotation(
        self,
        annotation: UnifiedAnnotation,
        check_result: ConsistencyCheckResult
    ) -> UnifiedAnnotation:
        core = annotation.core_judgement
        change_no = self.change_order.change_order_no
        project_name = self.change_order.project_name
        drawing_info = ""
        latest_drawing = self.change_order.get_latest_drawing()
        if latest_drawing:
            drawing_info = f"图纸版本：{latest_drawing.version}"

        field_correct_values = {
            "项目名称": f"项目名称：{project_name}",
            "变更编号": f"变更编号：{change_no}",
            "图纸版本": drawing_info,
            "核心判断": f"核心判断：{core}",
            "核心判断表述": f"核心判断：{core}",
        }

        for field in check_result.inconsistent_fields:
            correct_line = field_correct_values.get(field)
            if not correct_line:
                continue

            for attr in ["scene_annotation", "sidebar_note", "page_summary"]:
                text = getattr(annotation, attr)
                field_prefix = field.replace("表述", "")
                if field_prefix + "：" in text:
                    lines = text.split("\n")
                    new_lines = []
                    for line in lines:
                        if line.startswith(field_prefix + "：") or line.startswith(field_prefix + ":"):
                            new_lines.append(correct_line)
                        else:
                            new_lines.append(line)
                    setattr(annotation, attr, "\n".join(new_lines))
                elif field_prefix not in text:
                    insert_pos = text.find("\n", text.find("项目名称"))
                    if insert_pos != -1:
                        new_text = text[:insert_pos] + "\n" + correct_line + text[insert_pos:]
                        setattr(annotation, attr, new_text)

        return annotation

    def _collect_warnings(self) -> List[str]:
        warnings = []

        for offset in self.change_order.coordinate_offsets:
            warnings.extend(ImpactTracker.analyze_coordinate_offset_impact(
                self.change_order, offset
            ))

        latest_drawing = self.change_order.get_latest_drawing()
        if not latest_drawing:
            warnings.append(
                "⚠️ 未设置最新图纸版本标识！所有判断依据无法确认，请立即联系结构工程师老叶确认图纸版本。"
            )
        elif len(self.change_order.drawing_versions) > 1:
            older_versions = [
                dv.version for dv in self.change_order.drawing_versions
                if not dv.is_latest
            ]
            warnings.append(
                f"📋 图纸版本较多（共{len(self.change_order.drawing_versions)}版），"
                f"当前最新版为「{latest_drawing.version}」，"
                f"已废弃版本：{', '.join(older_versions)}。以最新版判断为准。"
            )

        if self.change_order.visa_notes:
            for visa in self.change_order.visa_notes:
                impact = ImpactTracker.analyze_visa_impact(
                    self.change_order, visa
                )
                warnings.append(f"📝 {impact.summary}")

        return warnings

    def _generate_component_markers(
        self,
        processing_type: ProcessingType
    ) -> Dict[str, List[str]]:
        components = VersionClassifier.classify_export_components(
            self.change_order
        )

        markers = {}
        for ptype, judgements in components.items():
            label = self.PROCESSING_TYPE_LABELS[ptype]
            markers[label] = [
                f"{j.item_code} {j.item_name}" for j in judgements
            ]

        return markers

    def _check_delivery_smoothness(self) -> Tuple[Optional[str], int]:
        score = 100
        issues = []

        if not self.change_order.judgements:
            score -= 30
            issues.append("缺少分项判断列表")

        if not self.change_order.get_latest_drawing():
            score -= 25
            issues.append("未确认最新图纸版本")

        if not self.change_order.drawing_versions:
            score -= 15
            issues.append("未关联任何图纸")

        material_hint_parts = [
            "材料存放位置指引：",
            "1. 纸质版交底清单：会议资料夹 → 施工变更分类 → 对应日期文件夹",
            "2. 电子版导出记录：协同平台 → 变更管理 → 交底清单导出历史",
            "3. 图纸版本对比：BIM模型平台 → 版本对比视图",
            "4. 现场签证单原件：资料室 → 签证档案盒 → 按编号索引",
        ]

        if issues:
            material_hint_parts.append("\n⚠️ 交付顺畅性提醒：")
            material_hint_parts.extend([f"- {issue}" for issue in issues])
            material_hint_parts.append(
                "- 如仍需询问材料存放位置，说明以上交付环节不够顺畅，请优化。"
            )

        material_hint = "\n".join(material_hint_parts)

        if score < 70:
            material_hint += (
                "\n\n❌ 交付顺畅性评分过低（{score}/100），"
                "项目经理跑一遍如果还要问材料放哪，说明交付不够顺。"
            )

        return material_hint, score
