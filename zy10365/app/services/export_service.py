import pandas as pd
from io import BytesIO
from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import (
    GrayVersion, HistoryRequest, ResponseDiff,
    Timeline, ReleaseConclusion, Confirmer, DiffLevel
)


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_verification_summary(
        self,
        version: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        include_diffs: bool = True,
        include_timeline: bool = True
    ) -> Dict[str, Any]:
        query = self.db.query(GrayVersion)
        
        if version:
            query = query.filter(GrayVersion.version == version)
        
        if start_date:
            query = query.filter(GrayVersion.created_at >= start_date)
        
        if end_date:
            query = query.filter(GrayVersion.created_at <= end_date)
        
        gray_versions = query.order_by(GrayVersion.created_at.desc()).all()

        result = {
            "export_metadata": {
                "export_time": datetime.now().isoformat(),
                "total_versions": len(gray_versions),
                "filters": {
                    "version": version,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                    "include_diffs": include_diffs,
                    "include_timeline": include_timeline
                }
            },
            "versions": []
        }

        for gv in gray_versions:
            version_data = self._get_version_summary(gv)
            
            if include_diffs:
                version_data["diffs"] = self._get_diffs_summary(gv.id)
            
            if include_timeline:
                version_data["timeline"] = self._get_timeline_summary(gv.id)
            
            version_data["confirmers"] = self._get_confirmers_summary(gv.id)
            version_data["conclusion"] = self._get_conclusion_summary(gv.id)
            
            result["versions"].append(version_data)

        return result

    def _get_version_summary(self, gv: GrayVersion) -> Dict[str, Any]:
        requests = self.db.query(HistoryRequest).filter(
            HistoryRequest.gray_version_id == gv.id
        ).all()

        replayed_count = sum(1 for r in requests if r.gray_response is not None)
        success_count = sum(
            1 for r in requests
            if r.gray_status_code and 200 <= r.gray_status_code < 300
        )

        avg_base_time = (
            sum(r.base_response_time or 0 for r in requests) / len(requests)
            if requests else 0
        )
        avg_gray_time = (
            sum(r.gray_response_time or 0 for r in requests) / len(requests)
            if requests else 0
        )

        return {
            "version": gv.version,
            "description": gv.description,
            "base_url": gv.base_url,
            "target_url": gv.target_url,
            "created_by": gv.created_by,
            "status": gv.status,
            "created_at": gv.created_at.isoformat(),
            "updated_at": gv.updated_at.isoformat() if gv.updated_at else None,
            "requests": {
                "total": len(requests),
                "replayed": replayed_count,
                "success": success_count,
                "failed": replayed_count - success_count
            },
            "performance": {
                "avg_base_response_time_ms": round(avg_base_time, 2),
                "avg_gray_response_time_ms": round(avg_gray_time, 2),
                "time_diff_ms": round(avg_gray_time - avg_base_time, 2),
                "time_diff_percent": round(
                    ((avg_gray_time - avg_base_time) / avg_base_time * 100)
                    if avg_base_time > 0 else 0,
                    2
                )
            }
        }

    def _get_diffs_summary(self, gray_version_id: int) -> Dict[str, Any]:
        diffs = self.db.query(ResponseDiff).join(HistoryRequest).filter(
            HistoryRequest.gray_version_id == gray_version_id
        ).all()

        if not diffs:
            return {
                "total": 0,
                "by_level": {},
                "by_type": {},
                "tolerated": 0,
                "untolerated": 0,
                "details": []
            }

        by_level = {}
        by_type = {}
        tolerated = 0

        for d in diffs:
            by_level[d.level] = by_level.get(d.level, 0) + 1
            by_type[d.diff_type] = by_type.get(d.diff_type, 0) + 1
            if d.is_tolerated:
                tolerated += 1

        details = [
            {
                "request_id": d.request.request_id,
                "path": d.request.path,
                "method": d.request.method,
                "diff_path": d.diff_path,
                "diff_type": d.diff_type,
                "base_value": d.base_value,
                "gray_value": d.gray_value,
                "level": d.level,
                "is_tolerated": d.is_tolerated
            }
            for d in diffs
        ]

        return {
            "total": len(diffs),
            "by_level": by_level,
            "by_type": by_type,
            "tolerated": tolerated,
            "untolerated": len(diffs) - tolerated,
            "details": details
        }

    def _get_timeline_summary(self, gray_version_id: int) -> list:
        timelines = self.db.query(Timeline).filter(
            Timeline.gray_version_id == gray_version_id
        ).order_by(Timeline.created_at.asc()).all()

        return [
            {
                "time": t.created_at.isoformat(),
                "action": t.action,
                "actor": t.actor,
                "details": t.details
            }
            for t in timelines
        ]

    def _get_confirmers_summary(self, gray_version_id: int) -> list:
        confirmers = self.db.query(Confirmer).filter(
            Confirmer.gray_version_id == gray_version_id
        ).all()

        return [
            {
                "user_id": c.user_id,
                "user_name": c.user_name,
                "role": c.role,
                "confirmed": c.confirmed,
                "confirmed_at": c.confirmed_at.isoformat() if c.confirmed_at else None,
                "comment": c.comment
            }
            for c in confirmers
        ]

    def _get_conclusion_summary(self, gray_version_id: int) -> Optional[Dict[str, Any]]:
        conclusion = self.db.query(ReleaseConclusion).filter(
            ReleaseConclusion.gray_version_id == gray_version_id
        ).first()

        if not conclusion:
            return None

        return {
            "conclusion_type": conclusion.conclusion_type,
            "summary": conclusion.summary,
            "total_requests": conclusion.total_requests,
            "success_requests": conclusion.success_requests,
            "failed_requests": conclusion.failed_requests,
            "total_diffs": conclusion.total_diffs,
            "critical_diffs": conclusion.critical_diffs,
            "error_diffs": conclusion.error_diffs,
            "warning_diffs": conclusion.warning_diffs,
            "tolerated_diffs": conclusion.tolerated_diffs,
            "released_by": conclusion.released_by,
            "released_at": conclusion.released_at.isoformat() if conclusion.released_at else None
        }

    def export_to_excel(
        self,
        version: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> bytes:
        summary = self.export_verification_summary(version, start_date, end_date)
        
        output = BytesIO()
        
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            versions_data = []
            for v in summary["versions"]:
                versions_data.append({
                    "Version": v["version"],
                    "Description": v["description"],
                    "Status": v["status"],
                    "Created By": v["created_by"],
                    "Created At": v["created_at"],
                    "Total Requests": v["requests"]["total"],
                    "Replayed": v["requests"]["replayed"],
                    "Success": v["requests"]["success"],
                    "Failed": v["requests"]["failed"],
                    "Total Diffs": v["diffs"]["total"] if "diffs" in v else 0,
                    "Critical Diffs": v["diffs"]["by_level"].get(DiffLevel.CRITICAL, 0) if "diffs" in v else 0
                })
            
            pd.DataFrame(versions_data).to_excel(writer, sheet_name="Summary", index=False)
            
            all_diffs = []
            for v in summary["versions"]:
                if "diffs" in v and "details" in v["diffs"]:
                    for d in v["diffs"]["details"]:
                        all_diffs.append({
                            "Version": v["version"],
                            "Request ID": d["request_id"],
                            "Path": d["path"],
                            "Method": d["method"],
                            "Diff Path": d["diff_path"],
                            "Diff Type": d["diff_type"],
                            "Base Value": d["base_value"],
                            "Gray Value": d["gray_value"],
                            "Level": d["level"],
                            "Tolerated": d["is_tolerated"]
                        })
            
            if all_diffs:
                pd.DataFrame(all_diffs).to_excel(writer, sheet_name="Diffs", index=False)
            
            all_timelines = []
            for v in summary["versions"]:
                if "timeline" in v:
                    for t in v["timeline"]:
                        all_timelines.append({
                            "Version": v["version"],
                            "Time": t["time"],
                            "Action": t["action"],
                            "Actor": t["actor"],
                            "Details": str(t["details"])
                        })
            
            if all_timelines:
                pd.DataFrame(all_timelines).to_excel(writer, sheet_name="Timeline", index=False)

        output.seek(0)
        return output.getvalue()
