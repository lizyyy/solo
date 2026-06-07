import json
import os
from datetime import datetime
from typing import List, Optional
from jinja2 import Environment, FileSystemLoader
from .models import Point, Street, Complaint, ReviewStatus, PointType


class MapExporter:
    def __init__(self, output_dir: str = None):
        if output_dir is None:
            output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'output')
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        template_dir = os.path.join(os.path.dirname(__file__), 'templates')
        self.env = Environment(loader=FileSystemLoader(template_dir))

    def _get_status_color(self, status: ReviewStatus) -> str:
        color_map = {
            ReviewStatus.PENDING: '#f39c12',
            ReviewStatus.BOUNDARY_PENDING: '#e74c3c',
            ReviewStatus.COMPLAINT_ADDED: '#9b59b6',
            ReviewStatus.MANUAL_FIXED: '#3498db',
            ReviewStatus.RE_RUN: '#2ecc71',
            ReviewStatus.CONFIRMED: '#27ae60'
        }
        return color_map.get(status, '#95a5a6')

    def _get_point_type_label(self, point_type: PointType) -> str:
        label_map = {
            PointType.NORMAL: '常规点位',
            PointType.NIGHT_SAMPLING: '夜间采样点',
            PointType.BOUNDARY: '边界点位'
        }
        return label_map.get(point_type, '未知')

    def _generate_point_note(self, point: Point, complaint: Optional[Complaint],
                              street_names: List[str]) -> dict:
        notes = []
        missing_materials = []
        next_step = ""
        next_operator = ""

        if point.is_on_boundary:
            notes.append(f"点位位于{ '、'.join(street_names) }街道交界处")
            notes.append("因跨街道边界，未自动归类，留待项目经理复核")
            missing_materials.append("需项目经理确认归属街道")
            next_step = "提交项目经理确认街道归属"
            next_operator = "项目经理"
        else:
            next_step = "正常复核流程"
            next_operator = "复核员"

        if complaint:
            notes.append(f"关联居民投诉编号：{complaint.complaint_no}")
            notes.append(f"投诉内容：{complaint.description}")
            notes.append(f"投诉来源：{complaint.source}，登记人：{complaint.reporter}")
        else:
            if not point.is_on_boundary:
                missing_materials.append("待补录居民投诉编号（如有）")
                next_step = "社区书记周姐核实是否有居民投诉"
                next_operator = "社区书记周姐"

        if point.status == ReviewStatus.MANUAL_FIXED:
            notes.append("已进行人工修正")
        if point.status == ReviewStatus.RE_RUN:
            notes.append("已重跑复核计算")

        return {
            "why_kept": "、".join(notes) if notes else "常规点位，服务半径正常",
            "missing": missing_materials,
            "next_step": next_step,
            "next_operator": next_operator
        }

    def export_map(self, points: List[Point], streets: List[Street],
                    complaints: List[Complaint],
                    title: str = "公厕服务半径复核地图",
                    filename: str = None) -> str:
        if filename is None:
            filename = f"复核地图_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"

        street_map = {s.id: s for s in streets}
        complaint_map = {c.id: c for c in complaints}
        complaint_by_point = {c.point_id: c for c in complaints}

        points_data = []
        for point in points:
            street_names = [street_map[sid].name for sid in point.street_ids if sid in street_map]
            complaint = complaint_by_point.get(point.id)
            note_info = self._generate_point_note(point, complaint, street_names)

            point_data = {
                "id": point.id,
                "name": point.name,
                "lng": point.lng,
                "lat": point.lat,
                "address": point.address,
                "point_type": point.point_type.value,
                "point_type_label": self._get_point_type_label(point.point_type),
                "status": point.status.value,
                "status_color": self._get_status_color(point.status),
                "is_on_boundary": point.is_on_boundary,
                "street_names": street_names,
                "complaint_no": complaint.complaint_no if complaint else None,
                "complaint_desc": complaint.description if complaint else None,
                "service_radius": point.service_radius,
                "notes": note_info,
                "review_records": [
                    {
                        "action": r.action,
                        "operator": r.operator,
                        "timestamp": r.timestamp,
                        "note": r.note,
                        "before": r.before_status,
                        "after": r.after_status
                    }
                    for r in point.review_records
                ]
            }
            points_data.append(point_data)

        streets_data = [
            {
                "id": s.id,
                "name": s.name,
                "color": s.color,
                "boundary": s.boundary
            }
            for s in streets
        ]

        stats = {
            "total": len(points),
            "boundary": len([p for p in points if p.is_on_boundary]),
            "complaint": len([p for p in points if p.complaint_id]),
            "night": len([p for p in points if p.point_type == PointType.NIGHT_SAMPLING]),
            "pending": len([p for p in points if p.status == ReviewStatus.PENDING]),
            "boundary_pending": len([p for p in points if p.status == ReviewStatus.BOUNDARY_PENDING])
        }

        template = self.env.get_template('map.html')
        html = template.render(
            title=title,
            export_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            points=points_data,
            streets=streets_data,
            stats=stats,
            points_json=json.dumps(points_data, ensure_ascii=False),
            streets_json=json.dumps(streets_data, ensure_ascii=False)
        )

        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)

        return filepath
