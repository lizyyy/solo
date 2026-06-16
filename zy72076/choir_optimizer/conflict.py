"""冲突检测模块 - 不替用户拍板，展示证据和建议动作"""
import json
import uuid
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

from .database import get_db, CONFLICTS_TABLE, RAW_RECORDS_TABLE, DATA_SOURCES_TABLE


class ConflictDetector:
    """冲突检测器 - 数据冲突时只摆证据，不给自动结论"""

    def __init__(self, batch_id: str):
        self.db = get_db()
        self.batch_id = batch_id
        self.conflicts: List[Dict] = []

    def _record_conflict(self, field_name: str, source_a: str, source_b: str,
                         value_a: Any, value_b: Any,
                         evidence_a: str, evidence_b: str,
                         suggested_action: str,
                         record_id: Optional[str] = None) -> str:
        """记录冲突到数据库"""
        conflict_id = str(uuid.uuid4())
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"INSERT INTO {CONFLICTS_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                conflict_id,
                self.batch_id,
                field_name,
                source_a,
                source_b,
                str(value_a) if value_a is not None else None,
                str(value_b) if value_b is not None else None,
                evidence_a,
                evidence_b,
                suggested_action,
                0,
                None,
                datetime.now().isoformat()
            )
        )
        self.db.conn.commit()
        conflict = {
            "id": conflict_id,
            "field_name": field_name,
            "source_a": source_a,
            "source_b": source_b,
            "value_a": value_a,
            "value_b": value_b,
            "evidence_a": evidence_a,
            "evidence_b": evidence_b,
            "suggested_action": suggested_action,
            "is_resolved": False
        }
        self.conflicts.append(conflict)
        return conflict_id

    def _get_source_name(self, source_id: str) -> str:
        """获取数据源名称"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT source_name, source_type FROM {DATA_SOURCES_TABLE} WHERE id = ?",
            (source_id,)
        )
        row = cursor.fetchone()
        if row:
            return f"{row['source_type']}:{row['source_name']}"
        return f"unknown:{source_id}"

    def detect_duplicate_records(self, df: pd.DataFrame) -> List[Dict]:
        """检测同一(声部,人员,排练日期)下的重复记录，可能存在数据冲突"""
        if "声部" not in df.columns or "人员" not in df.columns:
            return []
        conflicts = []
        key_cols = ["声部", "人员"]
        if "排练日期" in df.columns:
            key_cols.append("排练日期")
        numeric_fields = ["音准得分", "节奏得分", "合声得分", "音量平衡", "情感表达", "出勤状态"]
        grouped = df.groupby(key_cols)
        for key, group in grouped:
            if len(group) <= 1:
                continue
            source_ids = group['_source_id'].unique()
            if len(source_ids) <= 1:
                continue
            source_names = [self._get_source_name(sid) for sid in source_ids]
            for field in numeric_fields:
                if field not in group.columns:
                    continue
                values = group[field].dropna().unique()
                if len(values) > 1:
                    record_ids = group['_record_id'].tolist()
                    source_a = source_names[0]
                    source_b = source_names[1] if len(source_names) > 1 else "同一来源"
                    value_a = group.iloc[0][field]
                    value_b = group.iloc[1][field] if len(group) > 1 else None
                    member_name = group.iloc[0]['人员']
                    section_name = group.iloc[0]['声部']
                    evidence_a = f"来源[{source_a}]记录{section_name}-{member_name}的{field}={value_a}"
                    evidence_b = f"来源[{source_b}]记录{section_name}-{member_name}的{field}={value_b}"
                    suggested_action = f"请周姐核对原始资料，确认{section_name}-{member_name}的{field}正确值。建议以业务表为准，或咨询指挥老师。"
                    conflict_id = self._record_conflict(
                        field_name=field,
                        source_a=source_a,
                        source_b=source_b,
                        value_a=value_a,
                        value_b=value_b,
                        evidence_a=evidence_a,
                        evidence_b=evidence_b,
                        suggested_action=suggested_action,
                        record_id=record_ids[0]
                    )
                    conflicts.append({
                        "conflict_id": conflict_id,
                        "field": field,
                        "section": section_name,
                        "member": member_name
                    })
        self.db.log_audit(
            "detect_duplicate_records",
            {"count": len(conflicts)},
            batch_id=self.batch_id
        )
        return conflicts

    def detect_review_vs_import(self, imported_df: pd.DataFrame,
                                review_data: Optional[Dict] = None) -> List[Dict]:
        """检测复盘图表说法与导入数据的冲突"""
        if review_data is None:
            return []
        conflicts = []
        for section, section_review in review_data.items():
            section_data = imported_df[imported_df["声部"] == section]
            if section_data.empty:
                continue
            for field, review_value in section_review.items():
                if field not in section_data.columns:
                    continue
                if field in ["音准得分", "节奏得分", "合声得分", "音量平衡", "情感表达", "个人综合分"]:
                    actual_avg = section_data[field].mean()
                    if isinstance(review_value, (int, float)):
                        diff = abs(actual_avg - review_value)
                        if diff > 5.0:
                            evidence_a = f"复盘图表声称{section}的{field}平均约{review_value}分"
                            evidence_b = f"实际导入数据计算{section}的{field}平均为{actual_avg:.1f}分（共{len(section_data)}条记录）"
                            suggested_action = f"{section}的{field}复盘数据与实际导入差异{diff:.1f}分。建议：1)核对复盘图表数据源；2)确认是否有遗漏记录；3)与指挥老师确认实际水平。"
                            conflict_id = self._record_conflict(
                                field_name=field,
                                source_a="复盘图表",
                                source_b="导入数据计算",
                                value_a=review_value,
                                value_b=round(actual_avg, 1),
                                evidence_a=evidence_a,
                                evidence_b=evidence_b,
                                suggested_action=suggested_action
                            )
                            conflicts.append({"conflict_id": conflict_id, "section": section, "field": field})
                elif field == "声部人数":
                    actual_count = section_data["人员"].nunique()
                    if actual_count != review_value:
                        evidence_a = f"复盘图表声称{section}共有{review_value}人"
                        evidence_b = f"实际导入数据中{section}有{actual_count}人（名单：{', '.join(section_data['人员'].unique())}）"
                        suggested_action = f"{section}人数不一致（声称{review_value}人，实际{actual_count}人）。建议核对最新名单，确认是否有人员变动或漏录。"
                        conflict_id = self._record_conflict(
                            field_name="声部人数",
                            source_a="复盘图表",
                            source_b="导入数据计算",
                            value_a=review_value,
                            value_b=actual_count,
                            evidence_a=evidence_a,
                            evidence_b=evidence_b,
                            suggested_action=suggested_action
                        )
                        conflicts.append({"conflict_id": conflict_id, "section": section, "field": "声部人数"})
        self.db.log_audit(
            "detect_review_vs_import",
            {"count": len(conflicts)},
            batch_id=self.batch_id
        )
        return conflicts

    def run_all_detections(self, df: pd.DataFrame,
                           review_data: Optional[Dict] = None) -> Dict[str, Any]:
        """运行所有冲突检测"""
        cursor = self.db.conn.cursor()
        cursor.execute(f"DELETE FROM {CONFLICTS_TABLE} WHERE batch_id = ?", (self.batch_id,))
        self.db.conn.commit()
        self.conflicts = []
        all_conflicts = {
            "duplicate_records": self.detect_duplicate_records(df),
            "review_vs_import": self.detect_review_vs_import(df, review_data)
        }
        return {
            "conflicts": self.conflicts,
            "by_type": all_conflicts,
            "total_count": len(self.conflicts),
            "fields_affected": list(set(c["field_name"] for c in self.conflicts)),
            "sections_affected": list(set(
                c.get("section") for c in all_conflicts["duplicate_records"] + all_conflicts["review_vs_import"]
            ))
        }

    def get_conflict_summary(self) -> Dict[str, Any]:
        """获取冲突汇总"""
        if not self.conflicts:
            self._load_conflicts_from_db()
        fields = {}
        for c in self.conflicts:
            f = c["field_name"]
            if f not in fields:
                fields[f] = {"count": 0, "sources": set()}
            fields[f]["count"] += 1
            fields[f]["sources"].add(c["source_a"])
            fields[f]["sources"].add(c["source_b"])
        for f in fields:
            fields[f]["sources"] = list(fields[f]["sources"])
        return {
            "total": len(self.conflicts),
            "unresolved": sum(1 for c in self.conflicts if not c.get("is_resolved")),
            "by_field": fields,
            "details": self.conflicts
        }

    def _load_conflicts_from_db(self):
        """从数据库加载冲突数据到内存"""
        cursor = self.db.conn.cursor()
        cursor.execute(f"SELECT * FROM {CONFLICTS_TABLE} WHERE batch_id = ? ORDER BY created_at", (self.batch_id,))
        rows = cursor.fetchall()
        self.conflicts = []
        for row in rows:
            self.conflicts.append({
                "id": row["id"],
                "field_name": row["field_name"],
                "source_a": row["source_a"],
                "source_b": row["source_b"],
                "value_a": row["value_a"],
                "value_b": row["value_b"],
                "evidence_a": row["evidence_a"],
                "evidence_b": row["evidence_b"],
                "suggested_action": row["suggested_action"],
                "is_resolved": row["is_resolved"],
                "resolution": row["resolution"]
            })

    def resolve_conflict(self, conflict_id: str, resolution: str,
                         operator: str = "周姐") -> Dict[str, Any]:
        """
        记录冲突解决结果。注意：不自动修改数据，只记录决策。
        数据修改由用户通过补录功能显式执行。
        """
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"UPDATE {CONFLICTS_TABLE} SET is_resolved = 1, resolution = ? WHERE id = ?",
            (resolution, conflict_id)
        )
        self.db.conn.commit()
        for c in self.conflicts:
            if c["id"] == conflict_id:
                c["is_resolved"] = True
                c["resolution"] = resolution
        self.db.log_audit(
            "resolve_conflict",
            {"conflict_id": conflict_id, "resolution": resolution},
            batch_id=self.batch_id,
            operator=operator
        )
        return {
            "conflict_id": conflict_id,
            "status": "resolved",
            "resolution": resolution
        }

    def get_conflict_for_decision(self, conflict_id: str) -> Dict[str, Any]:
        """获取冲突详情用于决策，只摆事实"""
        for c in self.conflicts:
            if c["id"] == conflict_id:
                return {
                    "field": c["field_name"],
                    "options": [
                        {
                            "source": c["source_a"],
                            "value": c["value_a"],
                            "evidence": c["evidence_a"]
                        },
                        {
                            "source": c["source_b"],
                            "value": c["value_b"],
                            "evidence": c["evidence_b"]
                        }
                    ],
                    "suggested_action": c["suggested_action"],
                    "note": "系统不替您做决定，请根据实际情况选择或录入正确值"
                }
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT * FROM {CONFLICTS_TABLE} WHERE id = ?",
            (conflict_id,)
        )
        row = cursor.fetchone()
        if row:
            return {
                "field": row["field_name"],
                "options": [
                    {
                        "source": row["source_a"],
                        "value": row["value_a"],
                        "evidence": row["evidence_a"]
                    },
                    {
                        "source": row["source_b"],
                        "value": row["value_b"],
                        "evidence": row["evidence_b"]
                    }
                ],
                "suggested_action": row["suggested_action"],
                "note": "系统不替您做决定，请根据实际情况选择或录入正确值"
            }
        return {}
