from pathlib import Path
from typing import List, Dict, Any, Optional

from .base_parser import BaseParser, ParseResult
from app.models import Actor, HandoverRecord, Scene, Prop
from app.models.enums import HandoverStatus


class ActorScheduleParser(BaseParser):

    def get_required_columns(self) -> List[str]:
        return ["actor_name", "scene_id", "prop_name"]

    def get_optional_columns(self) -> List[str]:
        return [
            "actor_id",
            "role",
            "contact_info",
            "prop_id",
            "scheduled_start_time",
            "scheduled_end_time",
            "quantity",
            "notes",
        ]

    def __init__(self, props: List[Prop] = None, scenes: List[Scene] = None):
        self.props = {p.id: p for p in (props or [])}
        self.props_by_name = {p.name: p for p in (props or [])}
        self.scenes = {s.id: s for s in (scenes or [])}

    def parse_file(self, file_path: Path) -> ParseResult:
        try:
            rows = self._read_csv_file(file_path)
            return self.parse_rows(rows)
        except Exception as e:
            return ParseResult(
                success=False,
                records=[],
                errors=[f"读取文件失败: {str(e)}"],
                warnings=[],
                row_count=0,
            )

    def parse_rows(self, rows: List[Dict[str, Any]]) -> ParseResult:
        if not rows:
            return ParseResult(
                success=False,
                records=[],
                errors=["CSV文件为空"],
                warnings=[],
                row_count=0,
            )

        errors = []
        warnings = []
        records = []
        actors = {}

        headers = list(rows[0].keys()) if rows else []
        missing, extra = self.validate_columns(headers)

        for col in missing:
            errors.append(f"缺少必需列: {col}")

        for col in extra:
            warnings.append(f"未知列将被忽略: {col}")

        if errors:
            return ParseResult(
                success=False,
                records=[],
                errors=errors,
                warnings=warnings,
                row_count=len(rows),
            )

        for index, row in enumerate(rows, start=2):
            try:
                actor_name = row.get("actor_name", "")
                actor_id = row.get("actor_id", "") or f"actor_{actor_name}"
                
                if actor_id not in actors:
                    actors[actor_id] = Actor(
                        id=actor_id,
                        name=actor_name,
                        role=row.get("role", ""),
                        contact_info=row.get("contact_info", ""),
                    )

                scene_id = row.get("scene_id", "")
                scene = self.scenes.get(scene_id)
                scene_title = scene.full_title if scene else scene_id

                prop_name = row.get("prop_name", "")
                prop_id = row.get("prop_id", "")
                
                prop = self.props.get(prop_id) or self.props_by_name.get(prop_name)
                if prop:
                    prop_id = prop.id
                    prop_name = prop.name
                else:
                    warnings.append(f"第{index}行: 道具 '{prop_name}' 未在道具表中找到")

                try:
                    quantity = int(row.get("quantity", 1))
                except (ValueError, TypeError):
                    quantity = 1
                    warnings.append(f"第{index}行: 数量格式错误，使用默认值 1")

                handover = HandoverRecord(
                    prop_id=prop_id,
                    prop_name=prop_name,
                    scene_id=scene_id,
                    scene_title=scene_title,
                    actor_id=actor_id,
                    actor_name=actor_name,
                    status=HandoverStatus.PENDING,
                    quantity=quantity,
                    notes=row.get("notes", ""),
                )

                from datetime import datetime
                if row.get("scheduled_start_time"):
                    try:
                        handover.scheduled_start_time = datetime.fromisoformat(row.get("scheduled_start_time"))
                    except (ValueError, TypeError):
                        warnings.append(f"第{index}行: 计划开始时间格式错误")

                if row.get("scheduled_end_time"):
                    try:
                        handover.scheduled_end_time = datetime.fromisoformat(row.get("scheduled_end_time"))
                    except (ValueError, TypeError):
                        warnings.append(f"第{index}行: 计划结束时间格式错误")

                records.append(handover)

            except Exception as e:
                errors.append(f"第{index}行解析失败: {str(e)}")

        return ParseResult(
            success=len(errors) == 0,
            records=records,
            errors=errors,
            warnings=warnings,
            row_count=len(rows),
        )
