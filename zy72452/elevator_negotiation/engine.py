import json
import csv
import os
from typing import List, Dict, Optional, Tuple
from .models import (
    NegotiationPoint, PointStatus, NextAction,
    Street, InspectionRecord, ConstructionNotice
)


def point_in_polygon(lng: float, lat: float, polygon: List[Tuple[float, float]]) -> bool:
    x, y = lng, lat
    inside = False
    n = len(polygon)
    for i in range(n):
        j = (i + 1) % n
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
    return inside


def point_near_boundary(lng: float, lat: float, polygon: List[Tuple[float, float]], threshold: float = 0.0005) -> bool:
    for i in range(len(polygon)):
        j = (i + 1) % len(polygon)
        x1, y1 = polygon[i]
        x2, y2 = polygon[j]
        dist = point_to_segment_distance(lng, lat, x1, y1, x2, y2)
        if dist < threshold:
            return True
    return False


def point_to_segment_distance(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0, min(1, t))
    nearest_x = x1 + t * dx
    nearest_y = y1 + t * dy
    return ((px - nearest_x) ** 2 + (py - nearest_y) ** 2) ** 0.5


class NegotiationEngine:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.streets: List[Street] = []
        self.points: Dict[str, NegotiationPoint] = {}
        self._ensure_data_dir()
        self._load_streets()
        self._load_points()

    def _ensure_data_dir(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "exports"), exist_ok=True)

    def _load_streets(self):
        street_file = os.path.join(self.data_dir, "streets.json")
        if os.path.exists(street_file):
            with open(street_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for s in data:
                self.streets.append(Street(
                    name=s["name"],
                    code=s["code"],
                    boundary_polygon=[(p[0], p[1]) for p in s["boundary"]]
                ))

    def _load_points(self):
        points_file = os.path.join(self.data_dir, "points.json")
        if os.path.exists(points_file):
            with open(points_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for p_data in data:
                point = NegotiationPoint(
                    point_id=p_data["point_id"],
                    name=p_data["name"],
                    address=p_data["address"],
                    lng=p_data["lng"],
                    lat=p_data["lat"],
                    status=PointStatus(p_data["status"]),
                    located_streets=p_data.get("located_streets", []),
                    is_boundary=p_data.get("is_boundary", False),
                    missing_materials=p_data.get("missing_materials", []),
                    next_action=NextAction(p_data.get("next_action", NextAction.WAITING)),
                    review_notes=p_data.get("review_notes", ""),
                    created_at=p_data.get("created_at", ""),
                    updated_at=p_data.get("updated_at", ""),
                    history=p_data.get("history", [])
                )
                if "inspection" in p_data and p_data["inspection"]:
                    insp = p_data["inspection"]
                    point.inspection = InspectionRecord(
                        record_id=insp["record_id"],
                        point_id=insp["point_id"],
                        inspector=insp["inspector"],
                        inspection_date=insp["inspection_date"],
                        community_name=insp["community_name"],
                        building_number=insp["building_number"],
                        unit_count=insp["unit_count"],
                        resident_count=insp["resident_count"],
                        support_rate=insp["support_rate"],
                        issues=insp.get("issues", [])
                    )
                if "notice" in p_data and p_data["notice"]:
                    nt = p_data["notice"]
                    point.notice = ConstructionNotice(
                        notice_id=nt["notice_id"],
                        point_id=nt["point_id"],
                        construction_unit=nt["construction_unit"],
                        notice_date=nt["notice_date"],
                        content=nt["content"],
                        attachment_urls=nt.get("attachment_urls", [])
                    )
                self.points[point.point_id] = point

    def _save_points(self):
        points_file = os.path.join(self.data_dir, "points.json")
        data = []
        for p in self.points.values():
            p_data = {
                "point_id": p.point_id,
                "name": p.name,
                "address": p.address,
                "lng": p.lng,
                "lat": p.lat,
                "status": p.status.value,
                "located_streets": p.located_streets,
                "is_boundary": p.is_boundary,
                "missing_materials": p.missing_materials,
                "next_action": p.next_action.value,
                "review_notes": p.review_notes,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
                "history": p.history,
                "inspection": None,
                "notice": None
            }
            if p.inspection:
                p_data["inspection"] = {
                    "record_id": p.inspection.record_id,
                    "point_id": p.inspection.point_id,
                    "inspector": p.inspection.inspector,
                    "inspection_date": p.inspection.inspection_date,
                    "community_name": p.inspection.community_name,
                    "building_number": p.inspection.building_number,
                    "unit_count": p.inspection.unit_count,
                    "resident_count": p.inspection.resident_count,
                    "support_rate": p.inspection.support_rate,
                    "issues": p.inspection.issues
                }
            if p.notice:
                p_data["notice"] = {
                    "notice_id": p.notice.notice_id,
                    "point_id": p.notice.point_id,
                    "construction_unit": p.notice.construction_unit,
                    "notice_date": p.notice.notice_date,
                    "content": p.notice.content,
                    "attachment_urls": p.notice.attachment_urls
                }
            data.append(p_data)
        with open(points_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def import_inspection_csv(self, csv_path: str, operator: str = "网格员") -> List[NegotiationPoint]:
        imported = []
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                point_id = row["point_id"]
                if point_id in self.points:
                    point = self.points[point_id]
                else:
                    point = NegotiationPoint(
                        point_id=point_id,
                        name=row["name"],
                        address=row["address"],
                        lng=float(row["lng"]),
                        lat=float(row["lat"])
                    )
                    self.points[point_id] = point

                point.inspection = InspectionRecord(
                    record_id=row["record_id"],
                    point_id=point_id,
                    inspector=row["inspector"],
                    inspection_date=row["inspection_date"],
                    community_name=row["community_name"],
                    building_number=row["building_number"],
                    unit_count=int(row["unit_count"]),
                    resident_count=int(row["resident_count"]),
                    support_rate=float(row["support_rate"]),
                    issues=row.get("issues", "").split("|") if row.get("issues") else []
                )
                self._check_street_boundary(point)
                self._update_missing_materials(point)
                point.add_history("导入巡查表", operator)
                imported.append(point)
        self._save_points()
        return imported

    def _check_street_boundary(self, point: NegotiationPoint):
        located = []
        near_boundary = False
        for street in self.streets:
            if point_in_polygon(point.lng, point.lat, street.boundary_polygon):
                located.append(street.name)
            elif point_near_boundary(point.lng, point.lat, street.boundary_polygon):
                if street.name not in located:
                    located.append(street.name)
                near_boundary = True

        point.located_streets = located
        point.is_boundary = len(located) >= 2 or near_boundary

        if point.is_boundary:
            point.status = PointStatus.BOUNDARY_PENDING
            point.next_action = NextAction.FIND_MANAGER
        else:
            point.status = PointStatus.IMPORTED
            point.next_action = NextAction.FIND_PLANNER

    def _update_missing_materials(self, point: NegotiationPoint):
        missing = []
        if not point.notice:
            missing.append("施工告示")
        if not point.inspection or point.inspection.support_rate < 0.7:
            missing.append("居民同意书补充")
        if point.inspection and not point.inspection.issues:
            missing.append("问题排查记录")
        point.missing_materials = missing

    def supplement_notice(self, point_id: str, notice: ConstructionNotice, operator: str = "街道规划员小姜") -> Optional[NegotiationPoint]:
        if point_id not in self.points:
            return None
        point = self.points[point_id]
        point.notice = notice
        point.status = PointStatus.NOTICE_SUPPLEMENTED
        if point.is_boundary:
            point.next_action = NextAction.FIND_MANAGER
        else:
            point.next_action = NextAction.FIND_COMMUNITY
        self._update_missing_materials(point)
        point.add_history("补录施工告示", operator, f"告示编号: {notice.notice_id}")
        self._save_points()
        return point

    def manager_review(self, point_id: str, notes: str, confirm_boundary: bool = True, operator: str = "项目经理") -> Optional[NegotiationPoint]:
        if point_id not in self.points:
            return None
        point = self.points[point_id]
        point.review_notes = notes
        if confirm_boundary:
            point.is_boundary = True
            point.status = PointStatus.MANAGER_REVIEWED
            point.next_action = NextAction.FIND_COMMUNITY
        else:
            point.is_boundary = False
            point.status = PointStatus.NORMAL
            point.next_action = NextAction.FIND_PLANNER
        point.add_history("项目经理复核", operator, notes)
        self._save_points()
        return point

    def get_boundary_points(self) -> List[NegotiationPoint]:
        return [p for p in self.points.values() if p.is_boundary]

    def get_point(self, point_id: str) -> Optional[NegotiationPoint]:
        return self.points.get(point_id)

    def list_points(self) -> List[NegotiationPoint]:
        return list(self.points.values())
