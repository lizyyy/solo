"""导出模块 - 导出排练座位单"""
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
from pathlib import Path
import csv
import io

from ..models.member import Member, VoicePart, MemberStatus
from ..models.seating import Seat, SeatingLayout, SeatingAssignment
from ..models.version import RehearsalPlan


class ExportFormat(Enum):
    """导出格式"""
    CSV = "csv"
    TEXT = "text"
    JSON = "json"


@dataclass
class ExportResult:
    """导出结果"""
    success: bool = True
    message: str = ""
    file_path: str = ""
    content: str = ""


class Exporter:
    """导出器"""
    
    def __init__(self):
        self.voice_colors = {
            VoicePart.SOPRANO_1: ("#FF6B9D", "女高1"),
            VoicePart.SOPRANO_2: ("#FF8FB1", "女高2"),
            VoicePart.ALTO_1: ("#7B68EE", "女低1"),
            VoicePart.ALTO_2: ("#9370DB", "女低2"),
            VoicePart.TENOR_1: ("#4ECDC4", "男高1"),
            VoicePart.TENOR_2: ("#45B7AA", "男高2"),
            VoicePart.BASS_1: ("#2C3E50", "男低1"),
            VoicePart.BASS_2: ("#34495E", "男低2"),
            VoicePart.UNASSIGNED: ("#95A5A6", "未分配"),
        }
    
    def export_seating_chart(
        self,
        plan: RehearsalPlan,
        format: ExportFormat = ExportFormat.TEXT,
        output_path: Optional[str] = None
    ) -> ExportResult:
        """导出座位图"""
        result = ExportResult()
        
        try:
            layout = SeatingLayout.from_dict(plan.layout)
            members: Dict[str, Member] = {}
            for mid, mdata in plan.members.items():
                members[mid] = Member.from_dict(mdata)
            
            if format == ExportFormat.TEXT:
                content = self._generate_text_chart(layout, members, plan)
                result.content = content
            elif format == ExportFormat.CSV:
                content = self._generate_csv_chart(layout, members, plan)
                result.content = content
            elif format == ExportFormat.JSON:
                import json
                data = self._generate_json_data(layout, members, plan)
                content = json.dumps(data, ensure_ascii=False, indent=2)
                result.content = content
            else:
                result.success = False
                result.message = f"不支持的格式：{format}"
                return result
            
            if output_path:
                path = Path(output_path)
                path.parent.mkdir(parents=True, exist_ok=True)
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                result.file_path = str(path)
            
            result.success = True
            result.message = f"导出成功：{len(members)} 位成员"
            
        except Exception as e:
            result.success = False
            result.message = f"导出失败：{e}"
        
        return result
    
    def _generate_text_chart(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member],
        plan: RehearsalPlan
    ) -> str:
        """生成文本格式座位图"""
        lines = []
        
        lines.append("=" * 80)
        lines.append(f"                    合 唱 团 排 练 座 位 单")
        lines.append("=" * 80)
        lines.append("")
        lines.append(f"排练计划：{plan.name}")
        lines.append(f"排练日期：{plan.rehearsal_date.strftime('%Y-%m-%d %H:%M') if plan.rehearsal_date else '未设置'}")
        lines.append(f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        member_at_seat: Dict[str, Member] = {}
        for seat_id, assignment in layout.assignments.items():
            if assignment.member_id:
                member = members.get(assignment.member_id)
                if member:
                    member_at_seat[seat_id] = member
        
        lines.append("-" * 80)
        lines.append("                            【 座 位 图 】")
        lines.append("-" * 80)
        lines.append("")
        lines.append("                                    ▲ 指 挥 台 ▲")
        lines.append("")
        
        for row_idx in range(layout.rows):
            row_seats = layout.get_seats_by_row(row_idx)
            if not row_seats:
                continue
            
            row_display = f"第 {row_idx + 1} 排："
            row_info = f"         "
            
            seat_cells: List[str] = []
            info_cells: List[str] = []
            
            for col_idx in range(layout.cols):
                seat = layout.get_seat_at(row_idx, col_idx)
                if not seat or not seat.is_enabled:
                    seat_cells.append(" " * 10)
                    info_cells.append(" " * 10)
                    continue
                
                member = member_at_seat.get(seat.id)
                if member:
                    name_display = member.name[:4].ljust(4)
                    voice_short = VoicePart.display_name(member.voice_part)[:2]
                    seat_cells.append(f"[{name_display}]")
                    
                    status_mark = ""
                    if member.status == MemberStatus.LEAVE:
                        status_mark = "假"
                    elif member.status == MemberStatus.ABSENT:
                        status_mark = "缺"
                    
                    info_cells.append(f" {voice_short}{status_mark} ")
                else:
                    seat_cells.append("[  空  ]")
                    info_cells.append("       ")
            
            row_display += " ".join(seat_cells)
            row_info += " ".join(info_cells)
            
            lines.append(row_display)
            lines.append(row_info)
            lines.append("")
        
        lines.append("")
        lines.append("-" * 80)
        lines.append("                            【 成 员 列 表 】")
        lines.append("-" * 80)
        lines.append("")
        
        header = f"{'姓名':<10} {'声部':<10} {'身高':<8} {'资深度':<8} {'状态':<8} {'座位':<12}"
        lines.append(header)
        lines.append("-" * 70)
        
        sorted_members = sorted(
            members.values(),
            key=lambda m: (m.voice_part.value, m.name)
        )
        
        for member in sorted_members:
            assignment = layout.get_assignment_by_member(member.id)
            seat_label = "未分配"
            if assignment:
                seat = layout.seats.get(assignment.seat_id)
                if seat:
                    seat_label = seat.label
            
            line = (
                f"{member.name:<10} "
                f"{VoicePart.display_name(member.voice_part):<10} "
                f"{member.height_cm:<8} "
                f"{member.seniority.display_name(member.seniority):<8} "
                f"{member.status.display_name(member.status):<8} "
                f"{seat_label:<12}"
            )
            lines.append(line)
        
        lines.append("")
        lines.append("-" * 80)
        lines.append("                            【 声 部 统 计 】")
        lines.append("-" * 80)
        lines.append("")
        
        voice_count: Dict[VoicePart, int] = {}
        for member in members.values():
            vp = member.voice_part
            voice_count[vp] = voice_count.get(vp, 0) + 1
        
        for vp in [
            VoicePart.SOPRANO_1, VoicePart.SOPRANO_2,
            VoicePart.ALTO_1, VoicePart.ALTO_2,
            VoicePart.TENOR_1, VoicePart.TENOR_2,
            VoicePart.BASS_1, VoicePart.BASS_2,
            VoicePart.UNASSIGNED,
        ]:
            count = voice_count.get(vp, 0)
            if count > 0:
                lines.append(f"  {VoicePart.display_name(vp):<10} : {count:>3} 人")
        
        lines.append("")
        lines.append("-" * 80)
        lines.append(f"                              总人数：{len(members)} 人")
        lines.append("=" * 80)
        
        return "\n".join(lines)
    
    def _generate_csv_chart(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member],
        plan: RehearsalPlan
    ) -> str:
        """生成 CSV 格式座位图"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["合唱排练座位单"])
        writer.writerow([])
        writer.writerow(["排练计划", plan.name])
        writer.writerow(["排练日期", plan.rehearsal_date.strftime('%Y-%m-%d %H:%M') if plan.rehearsal_date else ""])
        writer.writerow(["生成时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow([])
        
        member_at_seat: Dict[str, Member] = {}
        for seat_id, assignment in layout.assignments.items():
            if assignment.member_id:
                member = members.get(assignment.member_id)
                if member:
                    member_at_seat[seat_id] = member
        
        writer.writerow(["座位图", "(" + " " * (layout.cols * 10) + "▲ 指挥台 ▲" + " " * (layout.cols * 10) + ")"])
        writer.writerow([])
        
        for row_idx in range(layout.rows):
            row_names = [f"第{row_idx + 1}排"]
            row_voices = ["声部"]
            
            for col_idx in range(layout.cols):
                seat = layout.get_seat_at(row_idx, col_idx)
                if not seat or not seat.is_enabled:
                    row_names.append("")
                    row_voices.append("")
                    continue
                
                member = member_at_seat.get(seat.id)
                if member:
                    row_names.append(member.name)
                    row_voices.append(VoicePart.display_name(member.voice_part))
                else:
                    row_names.append("(空)")
                    row_voices.append("")
            
            writer.writerow(row_names)
            writer.writerow(row_voices)
            writer.writerow([])
        
        writer.writerow([])
        writer.writerow(["成员列表"])
        writer.writerow(["姓名", "声部", "身高(cm)", "资深度", "状态", "座位"])
        
        sorted_members = sorted(
            members.values(),
            key=lambda m: (m.voice_part.value, m.name)
        )
        
        for member in sorted_members:
            assignment = layout.get_assignment_by_member(member.id)
            seat_label = "未分配"
            if assignment:
                seat = layout.seats.get(assignment.seat_id)
                if seat:
                    seat_label = seat.label
            
            writer.writerow([
                member.name,
                VoicePart.display_name(member.voice_part),
                member.height_cm,
                member.seniority.display_name(member.seniority),
                member.status.display_name(member.status),
                seat_label
            ])
        
        return output.getvalue()
    
    def _generate_json_data(
        self,
        layout: SeatingLayout,
        members: Dict[str, Member],
        plan: RehearsalPlan
    ) -> Dict[str, Any]:
        """生成 JSON 数据"""
        member_at_seat: Dict[str, Member] = {}
        seat_of_member: Dict[str, Seat] = {}
        
        for seat_id, assignment in layout.assignments.items():
            if assignment.member_id:
                member = members.get(assignment.member_id)
                if member:
                    member_at_seat[seat_id] = member
                    seat = layout.seats.get(seat_id)
                    if seat:
                        seat_of_member[member.id] = seat
        
        seats_data = []
        for seat in layout.seats.values():
            member = member_at_seat.get(seat.id)
            seat_info = {
                "id": seat.id,
                "row": seat.row,
                "col": seat.col,
                "label": seat.label,
                "is_enabled": seat.is_enabled,
                "member": None
            }
            if member:
                seat_info["member"] = {
                    "id": member.id,
                    "name": member.name,
                    "voice_part": VoicePart.display_name(member.voice_part),
                    "height_cm": member.height_cm,
                    "seniority": member.seniority.display_name(member.seniority),
                    "status": member.status.display_name(member.status),
                }
            seats_data.append(seat_info)
        
        members_data = []
        for member in members.values():
            seat = seat_of_member.get(member.id)
            members_data.append({
                "id": member.id,
                "name": member.name,
                "voice_part": VoicePart.display_name(member.voice_part),
                "height_cm": member.height_cm,
                "seniority": member.seniority.display_name(member.seniority),
                "status": member.status.display_name(member.status),
                "seat_label": seat.label if seat else "未分配",
                "seat_row": seat.row if seat else None,
                "seat_col": seat.col if seat else None,
            })
        
        return {
            "plan_name": plan.name,
            "rehearsal_date": plan.rehearsal_date.isoformat() if plan.rehearsal_date else None,
            "generated_at": datetime.now().isoformat(),
            "layout": {
                "rows": layout.rows,
                "cols": layout.cols,
            },
            "seats": seats_data,
            "members": members_data,
            "statistics": {
                "total_members": len(members),
                "total_seats": layout.get_total_enabled_seats(),
                "occupied_seats": len(layout.assignments),
            }
        }


def export_seating_chart(
    plan: RehearsalPlan,
    format: str = "text",
    output_path: Optional[str] = None
) -> ExportResult:
    """便捷函数：导出座位图"""
    format_map = {
        "csv": ExportFormat.CSV,
        "text": ExportFormat.TEXT,
        "txt": ExportFormat.TEXT,
        "json": ExportFormat.JSON,
    }
    export_format = format_map.get(format.lower(), ExportFormat.TEXT)
    
    exporter = Exporter()
    return exporter.export_seating_chart(plan, export_format, output_path)


def export_to_csv(plan: RehearsalPlan, output_path: Optional[str] = None) -> ExportResult:
    """便捷函数：导出为 CSV"""
    exporter = Exporter()
    return exporter.export_seating_chart(plan, ExportFormat.CSV, output_path)


def export_to_text(plan: RehearsalPlan, output_path: Optional[str] = None) -> ExportResult:
    """便捷函数：导出为文本"""
    exporter = Exporter()
    return exporter.export_seating_chart(plan, ExportFormat.TEXT, output_path)
