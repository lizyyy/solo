from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.models.result import ResultVersion, ResultRecord
from app.models.race import Race
from app.config import get_settings


class ExportService:
    """公示导出服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    async def export_public_results(
        self,
        race_id: int,
        format_type: str = "CSV",
        include_rank: bool = True,
        include_category: bool = True,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """导出公示成绩"""
        version_result = await self.db.execute(
            select(ResultVersion).where(
                and_(
                    ResultVersion.race_id == race_id,
                    ResultVersion.is_public == True,
                )
            ).order_by(ResultVersion.version_number.desc())
        )
        version = version_result.scalars().first()

        if not version:
            return {"error": "未找到公开的成绩版本", "success": False}

        records_result = await self.db.execute(
            select(ResultRecord).where(ResultRecord.version_id == version.id)
        )
        records = records_result.scalars().all()

        if category:
            records = [r for r in records if r.category == category]

        records = sorted(
            records,
            key=lambda x: (x.rank if x.rank else float('inf'), x.duration_seconds if x.duration_seconds else float('inf'))
        )

        if len(records) > self.settings.export_max_rows:
            records = records[:self.settings.export_max_rows]
            truncated = True
        else:
            truncated = False

        race_result = await self.db.execute(
            select(Race).where(Race.id == race_id)
        )
        race = race_result.scalar_one_or_none()

        if format_type == "CSV":
            content = self._format_csv(records, include_rank, include_category)
        elif format_type == "JSON":
            content = self._format_json(records, include_rank, include_category)
        else:
            return {"error": "不支持的导出格式", "success": False}

        return {
            "success": True,
            "race_id": race_id,
            "race_name": race.name if race else None,
            "version_id": version.id,
            "version_number": version.version_number,
            "format": format_type,
            "total_records": len(records),
            "truncated": truncated,
            "generated_at": datetime.utcnow().isoformat(),
            "content": content,
        }

    def _format_csv(
        self,
        records: List[ResultRecord],
        include_rank: bool,
        include_category: bool,
    ) -> str:
        """CSV格式导出"""
        headers = ["运动员ID", "姓名", "号码布"]
        if include_rank:
            headers.append("名次")
        if include_category:
            headers.append("组别")
        headers.extend(["用时(秒)", "状态", "来源"])

        lines = [",".join(headers)]

        for record in records:
            row = [
                record.athlete_id,
                record.athlete_name,
                record.bib_number or "",
            ]
            if include_rank:
                row.append(str(record.rank) if record.rank else "")
            if include_category:
                row.append(record.category or "")
            row.extend([
                f"{record.duration_seconds:.3f}" if record.duration_seconds else "",
                record.status or "",
                record.source or "",
            ])
            lines.append(",".join(row))

        return "\n".join(lines)

    def _format_json(
        self,
        records: List[ResultRecord],
        include_rank: bool,
        include_category: bool,
    ) -> List[Dict[str, Any]]:
        """JSON格式导出"""
        result = []
        for record in records:
            item = {
                "athlete_id": record.athlete_id,
                "athlete_name": record.athlete_name,
                "bib_number": record.bib_number,
                "duration_seconds": record.duration_seconds,
                "status": record.status,
                "source": record.source,
            }
            if include_rank:
                item["rank"] = record.rank
            if include_category:
                item["category"] = record.category
            result.append(item)
        return result

    async def generate_publication_report(
        self,
        race_id: int,
    ) -> Dict[str, Any]:
        """生成发布报告"""
        versions_result = await self.db.execute(
            select(ResultVersion).where(ResultVersion.race_id == race_id).order_by(
                ResultVersion.version_number.desc()
            )
        )
        versions = versions_result.scalars().all()

        public_versions = [v for v in versions if v.is_public]
        latest_public = public_versions[0] if public_versions else None

        race_result = await self.db.execute(
            select(Race).where(Race.id == race_id)
        )
        race = race_result.scalar_one_or_none()

        version_stats = []
        for version in versions:
            records_result = await self.db.execute(
                select(ResultRecord).where(ResultRecord.version_id == version.id)
            )
            records = records_result.scalars().all()

            finished = len([r for r in records if r.status == "FINISHED"])
            dnf = len([r for r in records if r.status == "DNF"])
            dq = len([r for r in records if r.status == "DQ"])

            version_stats.append({
                "version_number": version.version_number,
                "is_public": version.is_public,
                "is_latest": version.is_latest,
                "published_at": version.published_at.isoformat() if version.published_at else None,
                "total_records": len(records),
                "finished": finished,
                "dnf": dnf,
                "dq": dq,
                "created_at": version.created_at.isoformat(),
            })

        return {
            "race_id": race_id,
            "race_name": race.name if race else None,
            "race_date": race.race_date.isoformat() if race and race.race_date else None,
            "is_published": race.is_published if race else False,
            "total_versions": len(versions),
            "public_versions": len(public_versions),
            "latest_public_version": latest_public.version_number if latest_public else None,
            "version_history": version_stats,
            "generated_at": datetime.utcnow().isoformat(),
        }

    async def get_audit_trail(
        self,
        race_id: int,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """获取审计追踪"""
        versions_result = await self.db.execute(
            select(ResultVersion).where(ResultVersion.race_id == race_id).order_by(
                ResultVersion.created_at.desc()
            ).limit(limit)
        )
        versions = versions_result.scalars().all()

        audit_entries = []
        for version in versions:
            audit_entries.append({
                "event_type": "VERSION_CREATED",
                "version_number": version.version_number,
                "timestamp": version.created_at.isoformat(),
                "created_by": version.created_by,
                "notes": version.notes,
                "is_public": version.is_public,
                "published_at": version.published_at.isoformat() if version.published_at else None,
            })

        return {
            "race_id": race_id,
            "total_entries": len(audit_entries),
            "audit_trail": audit_entries,
        }
