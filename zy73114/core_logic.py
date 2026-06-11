from datetime import datetime
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from models import (
    ChangeOrder,
    Judgement,
    VisaNote,
    CoordinateOffset,
    ProcessingType,
    JudgementImpact,
    VersionHistory,
    ChangeOrderStatus,
)


@dataclass
class ConsistencyCheckResult:
    is_consistent: bool
    inconsistent_fields: List[str]
    details: Dict[str, str]


@dataclass
class ImpactAnalysis:
    affected_judgement_ids: List[str]
    changed_judgements: List[Tuple[str, str, str]]
    summary: str


class ConsistencyValidator:
    @staticmethod
    def check_annotation_consistency(
        scene_annotation: str,
        sidebar_note: str,
        page_summary: str
    ) -> ConsistencyCheckResult:
        inconsistent_fields = []
        details = {}

        key_elements = ["项目名称", "变更编号", "图纸版本", "核心判断"]

        scene_values = ConsistencyValidator._extract_field_values(scene_annotation, key_elements)
        sidebar_values = ConsistencyValidator._extract_field_values(sidebar_note, key_elements)
        summary_values = ConsistencyValidator._extract_field_values(page_summary, key_elements)

        for elem in key_elements:
            s_val = scene_values.get(elem)
            sb_val = sidebar_values.get(elem)
            sm_val = summary_values.get(elem)

            if s_val is None or sb_val is None or sm_val is None:
                inconsistent_fields.append(elem)
                missing = []
                if s_val is None:
                    missing.append("场景标注")
                if sb_val is None:
                    missing.append("侧边说明")
                if sm_val is None:
                    missing.append("页面摘要")
                details[elem] = f"缺失位置: {', '.join(missing)}"
            elif not (s_val == sb_val == sm_val):
                inconsistent_fields.append(elem)
                details[elem] = (
                    f"场景标注: '{s_val}' | "
                    f"侧边说明: '{sb_val}' | "
                    f"页面摘要: '{sm_val}'"
                )

        return ConsistencyCheckResult(
            is_consistent=len(inconsistent_fields) == 0,
            inconsistent_fields=inconsistent_fields,
            details=details
        )

    @staticmethod
    def _extract_field_values(text: str, fields: List[str]) -> Dict[str, str]:
        values = {}
        lines = text.replace("\r", "").split("\n")
        for line in lines:
            stripped = line.lstrip()
            for field in fields:
                if field in values:
                    continue
                for sep in ["：", ":"]:
                    marker = field + sep
                    if stripped.startswith(marker):
                        values[field] = stripped[len(marker):].strip().rstrip("。")
                        break
        return values

    @staticmethod
    def _normalize(text: str) -> str:
        return text.replace(" ", "").replace("\n", "").replace("\t", "")

    @staticmethod
    def _extract_core_judgement(text: str) -> str:
        markers = ["【核心判断】", "核心判断:", "核心判断：", "判断结论:"]
        for marker in markers:
            if marker in text:
                start = text.index(marker) + len(marker)
                end = text.find("。", start)
                if end == -1:
                    end = text.find("\n", start)
                if end != -1:
                    return text[start:end].strip()
        return text[:50].strip()


class ImpactTracker:
    @staticmethod
    def analyze_visa_impact(
        change_order: ChangeOrder,
        visa_note: VisaNote
    ) -> ImpactAnalysis:
        changed_judgements = []

        for j in change_order.judgements:
            if j.id in visa_note.affected_judgements:
                original_basis = set(j.basis)
                new_basis = original_basis | {visa_note.source_doc}
                if original_basis != new_basis:
                    j.basis = list(new_basis)

                before = j.final_judgement
                after = ImpactTracker._adjust_judgement_by_impacts(
                    j.final_judgement, visa_note.impacts, visa_note.content
                )
                if before != after:
                    j.final_judgement = after
                    changed_judgements.append((j.item_code, before, after))

        summary = ImpactTracker._generate_impact_summary(
            visa_note, changed_judgements
        )

        return ImpactAnalysis(
            affected_judgement_ids=visa_note.affected_judgements,
            changed_judgements=changed_judgements,
            summary=summary
        )

    @staticmethod
    def _adjust_judgement_by_impacts(
        original: str,
        impacts: List[JudgementImpact],
        visa_content: str
    ) -> str:
        impact_map = {
            JudgementImpact.STRUCTURAL_SAFETY: "需复核结构安全",
            JudgementImpact.MATERIAL_QUANTITY: "需调整材料用量",
            JudgementImpact.CONSTRUCTION_SEQUENCE: "需调整施工顺序",
            JudgementImpact.COST: "需复核成本影响",
            JudgementImpact.DRAWING_VERSION: "需确认最新图纸版本",
        }

        adjustments = []
        for impact in impacts:
            if impact_map[impact] not in original:
                adjustments.append(impact_map[impact])

        if adjustments:
            return f"{original}（{','.join(adjustments)}，依据现场签证：{visa_content[:30]}...）"
        return original

    @staticmethod
    def _generate_impact_summary(
        visa_note: VisaNote,
        changed_judgements: List[Tuple[str, str, str]]
    ) -> str:
        if not changed_judgements:
            return f"现场签证单已记录，未改变已有判断结论。来源：{visa_note.source_doc}"

        items = "; ".join([
            f"{code}: '{before}' → '{after}'"
            for code, before, after in changed_judgements
        ])
        return (
            f"现场签证单改变了 {len(changed_judgements)} 项判断：{items}。"
            f"影响类型：{', '.join([i.value for i in visa_note.impacts])}。"
            f"来源：{visa_note.source_doc}"
        )

    @staticmethod
    def analyze_coordinate_offset_impact(
        change_order: ChangeOrder,
        offset: CoordinateOffset
    ) -> List[str]:
        warnings = []
        warnings.append(
            f"模型坐标偏移检测：X={offset.offset_x}, Y={offset.offset_y}, Z={offset.offset_z}。"
            f"请立即联系 {offset.confirmer_role} {offset.confirmer_name} 确认。"
        )
        warnings.append(
            f"坐标偏移来源追溯：优先查看「{offset.source_record_title}」"
            f"（记录ID：{offset.source_record_id}），检测时间：{offset.detected_at.strftime('%Y-%m-%d %H:%M')}"
        )

        affected_regions_str = "、".join(offset.affected_regions) if offset.affected_regions else "待确认"
        warnings.append(f"受影响区域：{affected_regions_str}")

        for j in change_order.judgements:
            if any(region in j.item_name for region in offset.affected_regions):
                warnings.append(
                    f"注意：分项「{j.item_name}」（{j.item_code}）"
                    f"的判断可能受坐标偏移影响，请 {offset.confirmer_name} 复核。"
                )

        return warnings


class VersionClassifier:
    @staticmethod
    def determine_processing_type(
        change_order: ChangeOrder,
        rerun_material: bool = False
    ) -> ProcessingType:
        if not rerun_material:
            return ProcessingType.LATEST

        export_count = len(change_order.export_records)
        visa_count = len(change_order.visa_notes)

        if export_count == 0:
            return ProcessingType.ORIGINAL

        original_judgement_ids = set()
        for export in change_order.export_records:
            if export.processing_type == ProcessingType.ORIGINAL:
                original_judgement_ids.update(j.id for j in export.judgements)
                break

        supplementary_judgement_ids = set()
        for export in change_order.export_records:
            if export.processing_type == ProcessingType.SUPPLEMENTARY:
                supplementary_judgement_ids.update(j.id for j in export.judgements)
                break

        current_judgement_ids = {j.id for j in change_order.judgements}
        new_judgements = current_judgement_ids - original_judgement_ids - supplementary_judgement_ids

        if new_judgements and visa_count == 0:
            return ProcessingType.LATEST
        elif visa_count > 0:
            has_new_judgements = len(new_judgements) > 0
            has_new_visa = any(
                v.created_at > change_order.export_records[-1].exported_at
                for v in change_order.visa_notes
            )
            if has_new_judgements and not has_new_visa:
                return ProcessingType.LATEST
            return ProcessingType.SUPPLEMENTARY
        else:
            return ProcessingType.LATEST

    @staticmethod
    def classify_export_components(
        change_order: ChangeOrder
    ) -> Dict[ProcessingType, List[Judgement]]:
        result = {
            ProcessingType.ORIGINAL: [],
            ProcessingType.SUPPLEMENTARY: [],
            ProcessingType.LATEST: [],
        }

        if not change_order.export_records:
            result[ProcessingType.ORIGINAL] = list(change_order.judgements)
            return result

        original_judgement_ids = set()
        for export in change_order.export_records:
            if export.processing_type == ProcessingType.ORIGINAL:
                original_judgement_ids.update(j.id for j in export.judgements)
                result[ProcessingType.ORIGINAL] = export.judgements
                break

        supplementary_ids = set()
        for export in change_order.export_records:
            if export.processing_type == ProcessingType.SUPPLEMENTARY:
                supplementary_ids.update(j.id for j in export.judgements)
                for j in export.judgements:
                    if j.id not in original_judgement_ids:
                        result[ProcessingType.SUPPLEMENTARY].append(j)
                break

        for j in change_order.judgements:
            if j.id not in original_judgement_ids and j.id not in supplementary_ids:
                result[ProcessingType.LATEST].append(j)

        return result
