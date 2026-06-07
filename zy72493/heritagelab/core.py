"""
文化遗产视廊控制系统 - 核心业务逻辑
"""
import json
import csv
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .models import (
    HeritageCorridorControl,
    InspectionRecord,
    ConstructionNotice,
    ResidentOpinion,
    ConflictItem,
    OpinionStatus,
    ConflictLevel,
    NextAction
)


class HeritageCorridorService:
    """文化遗产视廊控制服务"""

    def __init__(self):
        self.data = HeritageCorridorControl()

    def import_inspection_csv(self, filepath: str) -> InspectionRecord:
        """
        导入网格员巡查表（CSV格式）
        标记缺少原文的居民意见
        """
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        if not rows:
            raise ValueError("巡查表为空")

        first_row = rows[0]
        inspection_id = f"INS-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        opinions = []
        for i, row in enumerate(rows):
            opinion = ResidentOpinion(
                id=f"OP-{inspection_id}-{i+1:03d}",
                location=row.get('location', row.get('位置', '')),
                summary=row.get('summary', row.get('意见汇总', '')),
                original_text=row.get('original_text', row.get('原文', None)) or None,
                reporter=row.get('reporter', row.get('反映人', '')),
                report_time=datetime.now(),
                status=OpinionStatus.WITH_SOURCE if (row.get('original_text') or row.get('原文')) else OpinionStatus.SUMMARY_ONLY,
                source_type="巡查表",
                source_id=inspection_id
            )
            opinions.append(opinion)

        inspection = InspectionRecord(
            id=inspection_id,
            inspector=first_row.get('inspector', first_row.get('网格员', '未知')),
            inspection_date=datetime.now(),
            location=first_row.get('location', first_row.get('巡查区域', '')),
            heritage_site=first_row.get('heritage_site', first_row.get('遗产点', '')),
            opinions=opinions
        )

        self.data.inspections[inspection_id] = inspection
        self._detect_conflicts(inspection)
        return inspection

    def import_construction_notice(self, filepath: str) -> ConstructionNotice:
        """
        导入施工告示
        关联相关居民意见，更新冲突复核表
        """
        with open(filepath, 'r', encoding='utf-8') as f:
            notice_data = json.load(f)

        notice_id = f"NOT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        notice = ConstructionNotice(
            id=notice_id,
            project_name=notice_data['project_name'],
            location=notice_data['location'],
            start_date=datetime.fromisoformat(notice_data['start_date']),
            end_date=datetime.fromisoformat(notice_data['end_date']),
            construction_type=notice_data['construction_type'],
            impact_on_heritage=notice_data['impact_on_heritage'],
            publisher=notice_data.get('publisher', '未知'),
            related_opinion_ids=notice_data.get('related_opinion_ids', [])
        )

        self.data.notices[notice_id] = notice
        self._update_conflicts_with_notice(notice)
        return notice

    def _detect_conflicts(self, inspection: InspectionRecord):
        """检测居民意见中的冲突，生成冲突复核表"""
        for opinion in inspection.opinions:
            if opinion.status == OpinionStatus.SUMMARY_ONLY:
                conflict_id = f"CF-{opinion.id}"
                conflict = ConflictItem(
                    id=conflict_id,
                    opinion_id=opinion.id,
                    opinion_summary=opinion.summary,
                    location=opinion.location,
                    conflict_reason=f"居民意见仅汇总无原文，需社区书记复核确认",
                    missing_materials=["居民意见原文", "现场照片（如有）", "相关佐证材料"],
                    next_action=NextAction.COMMUNITY_SECRETARY,
                    conflict_level=ConflictLevel.MEDIUM
                )
                self.data.conflicts[conflict_id] = conflict

    def _update_conflicts_with_notice(self, notice: ConstructionNotice):
        """根据施工告示更新冲突复核表"""
        for opinion_id in notice.related_opinion_ids:
            for conflict in self.data.conflicts.values():
                if conflict.opinion_id == opinion_id:
                    conflict.missing_materials = [
                        m for m in conflict.missing_materials
                        if "施工告示" not in m and "施工" not in m
                    ]
                    if notice.impact_on_heritage and "无影响" not in notice.impact_on_heritage:
                        conflict.conflict_level = ConflictLevel.HIGH
                        conflict.conflict_reason += f"；施工告示显示：{notice.impact_on_heritage}"
                    else:
                        conflict.conflict_reason += "；已补充施工告示"

                    if not conflict.missing_materials:
                        conflict.next_action = NextAction.COMMUNITY_SECRETARY
                        conflict.missing_materials = ["最终复核确认"]
                    else:
                        conflict.next_action = NextAction.TRAFFIC_MA

                    conflict.updated_at = datetime.now()

    def review_conflict(self, conflict_id: str, reviewer: str, decision: str, note: str = "") -> ConflictItem:
        """
        社区书记复核冲突项
        decision: "confirm" 确认 / "request_more" 需要补充 / "resolve" 结案
        """
        conflict = self.data.conflicts.get(conflict_id)
        if not conflict:
            raise ValueError(f"冲突项不存在: {conflict_id}")

        if decision == "confirm":
            opinion = self._find_opinion(conflict.opinion_id)
            if opinion:
                opinion.status = OpinionStatus.VERIFIED
            conflict.next_action = NextAction.COMPLETED
            conflict.is_resolved = True
            conflict.resolution_note = f"{reviewer}确认: {note}"
        elif decision == "request_more":
            conflict.next_action = NextAction.TRAFFIC_MA
            conflict.missing_materials.append(note)
        elif decision == "resolve":
            conflict.is_resolved = True
            conflict.resolution_note = f"{reviewer}结案: {note}"

        conflict.updated_at = datetime.now()
        return conflict

    def _find_opinion(self, opinion_id: str) -> Optional[ResidentOpinion]:
        for inspection in self.data.inspections.values():
            for opinion in inspection.opinions:
                if opinion.id == opinion_id:
                    return opinion
        return None

    def get_opinion_source(self, opinion_id: str) -> Optional[Dict]:
        """获取居民意见的来源（巡查表或施工告示）"""
        for inspection in self.data.inspections.values():
            for opinion in inspection.opinions:
                if opinion.id == opinion_id:
                    return {
                        "type": "网格员巡查表",
                        "source_id": inspection.id,
                        "inspector": inspection.inspector,
                        "date": inspection.inspection_date,
                        "opinion": opinion
                    }
        for notice in self.data.notices.values():
            if opinion_id in notice.related_opinion_ids:
                return {
                    "type": "施工告示",
                    "source_id": notice.id,
                    "project": notice.project_name,
                    "date": notice.start_date
                }
        return None

    def get_pending_conflicts(self, action: Optional[NextAction] = None) -> List[ConflictItem]:
        """获取待处理冲突"""
        result = [c for c in self.data.conflicts.values() if not c.is_resolved]
        if action:
            result = [c for c in result if c.next_action == action]
        return sorted(result, key=lambda x: x.created_at)

    def export_state(self, filepath: str):
        """导出当前状态"""
        state = {
            "inspections": {k: self._inspection_to_dict(v) for k, v in self.data.inspections.items()},
            "notices": {k: self._notice_to_dict(v) for k, v in self.data.notices.items()},
            "conflicts": {k: self._conflict_to_dict(v) for k, v in self.data.conflicts.items()}
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2, default=str)

    def load_state(self, filepath: str):
        """加载状态"""
        with open(filepath, 'r', encoding='utf-8') as f:
            state = json.load(f)
        for k, v in state.get('inspections', {}).items():
            self.data.inspections[k] = self._dict_to_inspection(v)
        for k, v in state.get('notices', {}).items():
            self.data.notices[k] = self._dict_to_notice(v)
        for k, v in state.get('conflicts', {}).items():
            self.data.conflicts[k] = self._dict_to_conflict(v)

    def _inspection_to_dict(self, obj):
        return {
            "id": obj.id,
            "inspector": obj.inspector,
            "inspection_date": obj.inspection_date.isoformat(),
            "location": obj.location,
            "heritage_site": obj.heritage_site,
            "opinions": [self._opinion_to_dict(o) for o in obj.opinions],
            "notes": obj.notes
        }

    def _opinion_to_dict(self, obj):
        return {
            "id": obj.id,
            "location": obj.location,
            "summary": obj.summary,
            "original_text": obj.original_text,
            "reporter": obj.reporter,
            "report_time": obj.report_time.isoformat() if obj.report_time else None,
            "status": obj.status.value,
            "source_type": obj.source_type,
            "source_id": obj.source_id
        }

    def _notice_to_dict(self, obj):
        return {
            "id": obj.id,
            "project_name": obj.project_name,
            "location": obj.location,
            "start_date": obj.start_date.isoformat(),
            "end_date": obj.end_date.isoformat(),
            "construction_type": obj.construction_type,
            "impact_on_heritage": obj.impact_on_heritage,
            "publisher": obj.publisher,
            "related_opinion_ids": obj.related_opinion_ids
        }

    def _conflict_to_dict(self, obj):
        return {
            "id": obj.id,
            "opinion_id": obj.opinion_id,
            "opinion_summary": obj.opinion_summary,
            "location": obj.location,
            "conflict_reason": obj.conflict_reason,
            "missing_materials": obj.missing_materials,
            "next_action": obj.next_action.value,
            "conflict_level": obj.conflict_level.value,
            "is_resolved": obj.is_resolved,
            "resolution_note": obj.resolution_note,
            "created_at": obj.created_at.isoformat(),
            "updated_at": obj.updated_at.isoformat()
        }

    def _dict_to_inspection(self, d):
        return InspectionRecord(
            id=d["id"],
            inspector=d["inspector"],
            inspection_date=datetime.fromisoformat(d["inspection_date"]),
            location=d["location"],
            heritage_site=d["heritage_site"],
            opinions=[self._dict_to_opinion(o) for o in d["opinions"]],
            notes=d.get("notes", "")
        )

    def _dict_to_opinion(self, d):
        return ResidentOpinion(
            id=d["id"],
            location=d["location"],
            summary=d["summary"],
            original_text=d.get("original_text"),
            reporter=d.get("reporter", ""),
            report_time=datetime.fromisoformat(d["report_time"]) if d.get("report_time") else None,
            status=OpinionStatus(d["status"]),
            source_type=d.get("source_type"),
            source_id=d.get("source_id")
        )

    def _dict_to_notice(self, d):
        return ConstructionNotice(
            id=d["id"],
            project_name=d["project_name"],
            location=d["location"],
            start_date=datetime.fromisoformat(d["start_date"]),
            end_date=datetime.fromisoformat(d["end_date"]),
            construction_type=d["construction_type"],
            impact_on_heritage=d["impact_on_heritage"],
            publisher=d.get("publisher", ""),
            related_opinion_ids=d.get("related_opinion_ids", [])
        )

    def _dict_to_conflict(self, d):
        return ConflictItem(
            id=d["id"],
            opinion_id=d["opinion_id"],
            opinion_summary=d["opinion_summary"],
            location=d["location"],
            conflict_reason=d["conflict_reason"],
            missing_materials=d["missing_materials"],
            next_action=NextAction(d["next_action"]),
            conflict_level=ConflictLevel(d["conflict_level"]),
            is_resolved=d["is_resolved"],
            resolution_note=d.get("resolution_note", ""),
            created_at=datetime.fromisoformat(d["created_at"]),
            updated_at=datetime.fromisoformat(d["updated_at"])
        )
