from __future__ import annotations
import csv
import json
import os
from datetime import datetime
from typing import Optional

from .models import HitResult, ReviewSession
from .errors import get_error


class Exporter:
    HIT_TYPE_LABELS = {
        "exact": "精确命中",
        "partial": "部分命中",
        "miss": "未命中",
        "duplicate": "重复改判",
        "boundary": "边界情况",
    }

    STATUS_LABELS = {
        "auto": "自动判定",
        "confirmed": "已确认",
        "overridden": "已改判",
        "pending_review": "待复核",
    }

    def export_weekly_report_csv(
        self,
        hits: list,
        session: Optional[ReviewSession],
        output_path: str,
    ) -> str:
        if not hits:
            raise ValueError(get_error("EXPORT_NO_DATA"))

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        try:
            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(self._report_header())

                for h in hits:
                    writer.writerow(self._hit_to_row(h))

                writer.writerow([])
                writer.writerow(["=== 统计汇总 ==="])
                stats = self._calc_stats(hits)
                for key, val in stats.items():
                    writer.writerow([key, val])

                if session:
                    writer.writerow([])
                    writer.writerow(["=== 复核批次信息 ==="])
                    writer.writerow(["批次编号", session.id])
                    writer.writerow(["操作人", session.operator])
                    writer.writerow(["创建时间", session.created_at.strftime("%Y-%m-%d %H:%M:%S")])
                    writer.writerow(["已复核数", session.reviewed_count])
                    writer.writerow(["待复核数", session.pending_count])
                    if session.notes:
                        writer.writerow(["备注", session.notes])

            return output_path
        except (IOError, OSError):
            raise RuntimeError(get_error("EXPORT_WRITE_ERROR"))

    def export_weekly_report_json(
        self,
        hits: list,
        session: Optional[ReviewSession],
        output_path: str,
    ) -> str:
        if not hits:
            raise ValueError(get_error("EXPORT_NO_DATA"))

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        report = {
            "report_title": "客服知识命中 - 质检周报",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "statistics": self._calc_stats(hits),
            "results": [],
        }

        for h in hits:
            report["results"].append(self._hit_to_dict(h))

        if session:
            report["session"] = {
                "id": session.id,
                "operator": session.operator,
                "created_at": session.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "reviewed_count": session.reviewed_count,
                "pending_count": session.pending_count,
                "notes": session.notes,
            }

        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            return output_path
        except (IOError, OSError):
            raise RuntimeError(get_error("EXPORT_WRITE_ERROR"))

    def _report_header(self) -> list:
        return [
            "对话ID", "命中类型", "置信度", "关联知识ID",
            "复核状态", "复核人", "复核时间", "备注",
            "匹配关键词", "详细说明", "改判历史",
        ]

    def _hit_to_row(self, h: HitResult) -> list:
        override_summary = ""
        if h.override_history:
            parts = []
            for ov in h.override_history:
                parts.append(
                    f"{ov.get('reviewer', '?')}@{ov.get('time', '?')}: "
                    f"{ov.get('original_hit_type', '?')}→{h.hit_type.value}"
                )
            override_summary = "; ".join(parts)

        return [
            h.conversation_id,
            self.HIT_TYPE_LABELS.get(h.hit_type.value, h.hit_type.value),
            f"{h.confidence:.0%}",
            h.knowledge_id or "无",
            self.STATUS_LABELS.get(h.status.value, h.status.value),
            h.reviewed_by or "—",
            h.reviewed_at.strftime("%Y-%m-%d %H:%M") if h.reviewed_at else "—",
            h.reviewer_note or "—",
            "、".join(h.matched_keywords) if h.matched_keywords else "—",
            h.detail or "—",
            override_summary or "—",
        ]

    def _hit_to_dict(self, h: HitResult) -> dict:
        return {
            "对话ID": h.conversation_id,
            "命中类型": self.HIT_TYPE_LABELS.get(h.hit_type.value, h.hit_type.value),
            "置信度": round(h.confidence, 4),
            "关联知识ID": h.knowledge_id,
            "复核状态": self.STATUS_LABELS.get(h.status.value, h.status.value),
            "复核人": h.reviewed_by or "",
            "复核时间": h.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if h.reviewed_at else "",
            "备注": h.reviewer_note,
            "匹配关键词": h.matched_keywords,
            "详细说明": h.detail,
            "改判历史": h.override_history,
        }

    def _calc_stats(self, hits: list) -> dict:
        total = len(hits)
        if total == 0:
            return {"总条数": 0}

        by_type = {}
        for h in hits:
            label = self.HIT_TYPE_LABELS.get(h.hit_type.value, h.hit_type.value)
            by_type[label] = by_type.get(label, 0) + 1

        by_status = {}
        for h in hits:
            label = self.STATUS_LABELS.get(h.status.value, h.status.value)
            by_status[label] = by_status.get(label, 0) + 1

        hit_rate = (by_type.get("精确命中", 0) + by_type.get("部分命中", 0)) / total
        confirmed_rate = by_status.get("已确认", 0) / total
        override_rate = by_status.get("已改判", 0) / total

        low_conf = sum(1 for h in hits if h.confidence < 0.5)

        return {
            "总条数": total,
            "命中类型分布": by_type,
            "复核状态分布": by_status,
            "命中率（精确+部分）": f"{hit_rate:.1%}",
            "已确认率": f"{confirmed_rate:.1%}",
            "改判率": f"{override_rate:.1%}",
            "低置信度条目数（<50%）": low_conf,
        }
