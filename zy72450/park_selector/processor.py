import json
import copy
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .models import (
    ProjectState, SiteRecord, ResidentOpinion, NightSamplingPoint,
    ConflictReviewItem, AccessibilityRamp, OpinionStatus, RecordStatus, DataSource
)


class ParkSiteSelector:
    def __init__(self, project_name: str = "社区口袋公园选址"):
        self.state = ProjectState(name=project_name)

    def import_sites(self, sites_data: List[Dict]) -> Tuple[int, int]:
        imported = 0
        flagged = 0
        for data in sites_data:
            site = self._dict_to_site(data)
            self._mark_opinion_status(site)
            if site.status == RecordStatus.NEEDS_REVIEW:
                flagged += 1
            self.state.sites.append(site)
            imported += 1
        self.state.run_count += 1
        self.state.last_ran_at = datetime.now()
        return imported, flagged

    def _dict_to_site(self, data: Dict) -> SiteRecord:
        opinions = []
        for op_data in data.get("opinions", []):
            opinions.append(ResidentOpinion(
                id=op_data["id"],
                resident_name=op_data["resident_name"],
                address=op_data["address"],
                summary=op_data["summary"],
                original_text=op_data.get("original_text"),
                status=OpinionStatus(op_data.get("status", "完整"))
            ))

        ramp_data = data.get("accessibility_ramp")
        ramp = None
        if ramp_data:
            ramp = AccessibilityRamp(
                id=ramp_data["id"],
                location=ramp_data["location"],
                has_ramp=ramp_data["has_ramp"],
                notes=ramp_data.get("notes", "")
            )

        return SiteRecord(
            id=data["id"],
            site_name=data["site_name"],
            address=data["address"],
            area_sqm=data["area_sqm"],
            accessibility_ramp=ramp,
            opinions=opinions,
            source=DataSource(data.get("source", "日间走访")),
            status=RecordStatus(data.get("status", "正常")),
            conflict_notes=data.get("conflict_notes", ""),
            review_notes=data.get("review_notes", "")
        )

    def _mark_opinion_status(self, site: SiteRecord) -> None:
        has_summary_only = False
        for opinion in site.opinions:
            if not opinion.original_text or opinion.original_text.strip() == "":
                opinion.status = OpinionStatus.SUMMARY_ONLY
                has_summary_only = True
        if has_summary_only:
            site.status = RecordStatus.NEEDS_REVIEW
            site.review_notes = "存在居民意见只剩汇总无原文，待社区书记复核"

    def import_night_sampling(self, night_points_data: List[Dict]) -> Tuple[int, int]:
        imported = 0
        conflicts_found = 0
        for data in night_points_data:
            point = NightSamplingPoint(
                id=data["id"],
                location=data["location"],
                sampling_time=data["sampling_time"],
                old_criteria_data=data.get("old_criteria_data"),
                notes=data.get("notes", ""),
                linked_site_id=data.get("linked_site_id")
            )
            self.state.night_points.append(point)
            imported += 1

            if point.linked_site_id:
                conflicts = self._check_and_create_conflict(point)
                conflicts_found += len(conflicts)

        self.state.run_count += 1
        self.state.last_ran_at = datetime.now()
        return imported, conflicts_found

    def _check_and_create_conflict(self, night_point: NightSamplingPoint) -> List[ConflictReviewItem]:
        conflicts = []
        site = self._find_site_by_id(night_point.linked_site_id)
        if not site:
            return conflicts

        if night_point.old_criteria_data and site.source == DataSource.DAY_SURVEY:
            old_site = copy.deepcopy(site)
            site.source = DataSource.NIGHT_SAMPLING
            site.status = RecordStatus.CONFLICT
            site.updated_at = datetime.now()
            site.conflict_notes = f"夜间采样点补录旧口径数据：{night_point.old_criteria_data}"

            conflict = ConflictReviewItem(
                id=f"conflict_{len(self.state.conflict_review) + 1:03d}",
                site_id=site.id,
                site_name=site.site_name,
                conflict_type="口径差异",
                description=f"夜间采样点{night_point.location}补录旧口径数据，与原日间走访结果有出入",
                source_before=old_site.source.value,
                source_after=DataSource.NIGHT_SAMPLING.value,
                status="待处理"
            )
            self.state.conflict_review.append(conflict)
            conflicts.append(conflict)

        return conflicts

    def _find_site_by_id(self, site_id: str) -> Optional[SiteRecord]:
        for site in self.state.sites:
            if site.id == site_id:
                return site
        return None

    def manual_correct(self, site_id: str, correction: Dict, handler: str = "老马") -> bool:
        site = self._find_site_by_id(site_id)
        if not site:
            return False

        old_site = copy.deepcopy(site)
        if "site_name" in correction:
            site.site_name = correction["site_name"]
        if "address" in correction:
            site.address = correction["address"]
        if "area_sqm" in correction:
            site.area_sqm = correction["area_sqm"]
        if "review_notes" in correction:
            site.review_notes = correction["review_notes"]
        if "status" in correction:
            site.status = RecordStatus(correction["status"])

        site.source = DataSource.MANUAL_CORRECTION
        site.updated_at = datetime.now()

        conflict = ConflictReviewItem(
            id=f"conflict_{len(self.state.conflict_review) + 1:03d}",
            site_id=site.id,
            site_name=site.site_name,
            conflict_type="人工修正",
            description=f"{handler}进行了人工修正",
            source_before=old_site.source.value,
            source_after=DataSource.MANUAL_CORRECTION.value,
            status="已处理",
            handler=handler,
            resolved_at=datetime.now(),
            resolution_notes=f"{handler}人工修正完成"
        )
        self.state.conflict_review.append(conflict)
        return True

    def rerun(self) -> Dict:
        summary = {
            "total_sites": len(self.state.sites),
            "needs_review": 0,
            "conflicts": 0,
            "normal": 0,
            "night_points": len(self.state.night_points),
            "conflict_review_items": len(self.state.conflict_review)
        }

        for site in self.state.sites:
            self._mark_opinion_status(site)
            if site.status == RecordStatus.NEEDS_REVIEW:
                summary["needs_review"] += 1
            elif site.status == RecordStatus.CONFLICT:
                summary["conflicts"] += 1
            elif site.status == RecordStatus.NORMAL or site.status == RecordStatus.RESOLVED:
                summary["normal"] += 1

        self.state.run_count += 1
        self.state.last_ran_at = datetime.now()
        return summary

    def resolve_conflict(self, conflict_id: str, handler: str, notes: str) -> bool:
        for item in self.state.conflict_review:
            if item.id == conflict_id:
                item.status = "已处理"
                item.handler = handler
                item.resolved_at = datetime.now()
                item.resolution_notes = notes

                site = self._find_site_by_id(item.site_id)
                if site:
                    site.status = RecordStatus.RESOLVED
                    site.updated_at = datetime.now()
                return True
        return False

    def get_summary(self) -> Dict:
        summary = {
            "project_name": self.state.name,
            "run_count": self.state.run_count,
            "last_ran_at": self.state.last_ran_at,
            "total_sites": len(self.state.sites),
            "night_points": len(self.state.night_points),
            "conflict_review_items": len(self.state.conflict_review),
            "by_status": {}
        }
        for status in RecordStatus:
            count = len([s for s in self.state.sites if s.status == status])
            if count > 0:
                summary["by_status"][status.value] = count
        return summary

    def get_sites_need_review(self) -> List[SiteRecord]:
        return [s for s in self.state.sites if s.status == RecordStatus.NEEDS_REVIEW]

    def get_conflict_review(self) -> List[ConflictReviewItem]:
        return self.state.conflict_review

    def save_state(self, filepath: str) -> None:
        data = {
            "project_name": self.state.name,
            "run_count": self.state.run_count,
            "last_ran_at": self.state.last_ran_at.isoformat() if self.state.last_ran_at else None,
            "sites": [self._site_to_dict(s) for s in self.state.sites],
            "night_points": [self._night_point_to_dict(p) for p in self.state.night_points],
            "conflict_review": [self._conflict_to_dict(c) for c in self.state.conflict_review]
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_state(self, filepath: str) -> None:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.state = ProjectState(name=data["project_name"])
        self.state.run_count = data.get("run_count", 0)
        if data.get("last_ran_at"):
            self.state.last_ran_at = datetime.fromisoformat(data["last_ran_at"])
        for s_data in data.get("sites", []):
            self.state.sites.append(self._dict_to_site(s_data))
        for p_data in data.get("night_points", []):
            self.state.night_points.append(NightSamplingPoint(**p_data))
        for c_data in data.get("conflict_review", []):
            if c_data.get("resolved_at"):
                c_data["resolved_at"] = datetime.fromisoformat(c_data["resolved_at"])
            self.state.conflict_review.append(ConflictReviewItem(**c_data))

    def _site_to_dict(self, site: SiteRecord) -> Dict:
        return {
            "id": site.id,
            "site_name": site.site_name,
            "address": site.address,
            "area_sqm": site.area_sqm,
            "accessibility_ramp": {
                "id": site.accessibility_ramp.id,
                "location": site.accessibility_ramp.location,
                "has_ramp": site.accessibility_ramp.has_ramp,
                "notes": site.accessibility_ramp.notes
            } if site.accessibility_ramp else None,
            "opinions": [
                {
                    "id": op.id,
                    "resident_name": op.resident_name,
                    "address": op.address,
                    "summary": op.summary,
                    "original_text": op.original_text,
                    "status": op.status.value
                }
                for op in site.opinions
            ],
            "source": site.source.value,
            "status": site.status.value,
            "conflict_notes": site.conflict_notes,
            "review_notes": site.review_notes
        }

    def _night_point_to_dict(self, point: NightSamplingPoint) -> Dict:
        return {
            "id": point.id,
            "location": point.location,
            "sampling_time": point.sampling_time,
            "old_criteria_data": point.old_criteria_data,
            "notes": point.notes,
            "linked_site_id": point.linked_site_id
        }

    def _conflict_to_dict(self, conflict: ConflictReviewItem) -> Dict:
        return {
            "id": conflict.id,
            "site_id": conflict.site_id,
            "site_name": conflict.site_name,
            "conflict_type": conflict.conflict_type,
            "description": conflict.description,
            "source_before": conflict.source_before,
            "source_after": conflict.source_after,
            "status": conflict.status,
            "handler": conflict.handler,
            "resolved_at": conflict.resolved_at.isoformat() if conflict.resolved_at else None,
            "resolution_notes": conflict.resolution_notes
        }
