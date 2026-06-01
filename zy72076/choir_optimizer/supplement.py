"""补录备注模块 - 支持临时补录并展示差异"""
import json
import uuid
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

from .database import get_db, SUPPLEMENTS_TABLE, RAW_RECORDS_TABLE


class SupplementManager:
    """补录管理器 - 支持临时补录备注，并清晰展示补录前后差异"""

    def __init__(self, batch_id: str):
        self.db = get_db()
        self.batch_id = batch_id
        self.supplements: List[Dict] = []

    def _record_supplement(self, supplement_type: str, target_record_id: Optional[str],
                           field_name: Optional[str], old_value: Any, new_value: Any,
                           remark: str, operator: str = "周姐") -> str:
        """记录补录操作"""
        supplement_id = str(uuid.uuid4())
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"INSERT INTO {SUPPLEMENTS_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                supplement_id,
                self.batch_id,
                target_record_id,
                supplement_type,
                field_name,
                str(old_value) if old_value is not None else None,
                str(new_value) if new_value is not None else None,
                remark,
                operator,
                datetime.now().isoformat()
            )
        )
        self.db.conn.commit()
        supplement = {
            "id": supplement_id,
            "supplement_type": supplement_type,
            "target_record_id": target_record_id,
            "field_name": field_name,
            "old_value": old_value,
            "new_value": new_value,
            "remark": remark,
            "operator": operator
        }
        self.supplements.append(supplement)
        return supplement_id

    def add_remark(self, record_id: str, remark: str, operator: str = "周姐") -> Dict[str, Any]:
        """为现有记录补录备注"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT normalized_data FROM {RAW_RECORDS_TABLE} WHERE id = ?",
            (record_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"记录不存在: {record_id}")
        data = json.loads(row['normalized_data'])
        old_remark = data.get("指挥备注", "")
        new_remark = remark if not old_remark else f"{old_remark}\n{remark}"
        data["指挥备注"] = new_remark
        with self.db.transaction():
            cursor.execute(
                f"UPDATE {RAW_RECORDS_TABLE} SET normalized_data = ? WHERE id = ?",
                (json.dumps(data, ensure_ascii=False), record_id)
            )
            supplement_id = self._record_supplement(
                supplement_type="补录备注",
                target_record_id=record_id,
                field_name="指挥备注",
                old_value=old_remark,
                new_value=new_remark,
                remark=remark,
                operator=operator
            )
        self.db.log_audit(
            "supplement_remark",
            {"record_id": record_id, "old_remark": old_remark, "new_remark": new_remark},
            batch_id=self.batch_id,
            operator=operator
        )
        return self._format_diff(record_id, data, "指挥备注", old_remark, new_remark, supplement_id)

    def correct_field(self, record_id: str, field_name: str, new_value: Any,
                      reason: str, operator: str = "周姐") -> Dict[str, Any]:
        """修正指定字段的值（用于解决冲突或数据错误）"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT normalized_data, source_id FROM {RAW_RECORDS_TABLE} WHERE id = ?",
            (record_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"记录不存在: {record_id}")
        data = json.loads(row['normalized_data'])
        old_value = data.get(field_name)
        data[field_name] = new_value
        with self.db.transaction():
            cursor.execute(
                f"UPDATE {RAW_RECORDS_TABLE} SET normalized_data = ?, is_supplemented = 1, supplement_id = ? WHERE id = ?",
                (
                    json.dumps(data, ensure_ascii=False),
                    str(uuid.uuid4()),
                    record_id
                )
            )
            supplement_id = self._record_supplement(
                supplement_type="修正数据",
                target_record_id=record_id,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                remark=reason,
                operator=operator
            )
        self.db.log_audit(
            "supplement_correct_field",
            {"record_id": record_id, "field": field_name, "old": old_value, "new": new_value, "reason": reason},
            batch_id=self.batch_id,
            operator=operator
        )
        return self._format_diff(record_id, data, field_name, old_value, new_value, supplement_id)

    def add_new_record(self, record_data: Dict[str, Any], source_name: str = "人工补录",
                       reason: str = "", operator: str = "周姐") -> Dict[str, Any]:
        """新增一条记录（补录漏掉的人员）"""
        from .database import DATA_SOURCES_TABLE
        cursor = self.db.conn.cursor()
        source_id = str(uuid.uuid4())
        cursor.execute(
            f"INSERT INTO {DATA_SOURCES_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                source_id,
                "人工补录",
                source_name,
                None,
                1,
                json.dumps({k: k for k in record_data.keys()}, ensure_ascii=False),
                self.batch_id,
                datetime.now().isoformat()
            )
        )
        record_id = str(uuid.uuid4())
        supplement_id = str(uuid.uuid4())
        normalized_data = dict(record_data)
        section = normalized_data.get("声部")
        member_name = normalized_data.get("人员")
        rehearsal_date = normalized_data.get("排练日期")
        with self.db.transaction():
            cursor.execute(
                f"INSERT INTO {RAW_RECORDS_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    record_id,
                    source_id,
                    self.batch_id,
                    json.dumps(record_data, ensure_ascii=False),
                    json.dumps(normalized_data, ensure_ascii=False),
                    section,
                    member_name,
                    rehearsal_date,
                    1,
                    supplement_id,
                    datetime.now().isoformat()
                )
            )
            self._record_supplement(
                supplement_type="新增记录",
                target_record_id=record_id,
                field_name=None,
                old_value=None,
                new_value=json.dumps(record_data, ensure_ascii=False),
                remark=reason,
                operator=operator
            )
        self.db.log_audit(
            "supplement_add_record",
            {"record_id": record_id, "data": record_data, "reason": reason},
            batch_id=self.batch_id,
            operator=operator
        )
        return {
            "record_id": record_id,
            "source_id": source_id,
            "action": "新增记录",
            "new_data": record_data,
            "reason": reason,
            "supplement_id": supplement_id,
            "diff": {
                "field": "整条记录",
                "old_value": None,
                "new_value": record_data,
                "change_type": "新增"
            }
        }

    def _format_diff(self, record_id: str, data: Dict, field_name: str,
                     old_value: Any, new_value: Any, supplement_id: str) -> Dict[str, Any]:
        """格式化差异展示"""
        return {
            "record_id": record_id,
            "section": data.get("声部"),
            "member": data.get("人员"),
            "field": field_name,
            "old_value": old_value,
            "new_value": new_value,
            "change_type": "修改" if old_value else "新增",
            "supplement_id": supplement_id,
            "diff_display": f"{field_name}: {old_value if old_value else '(空)'} → {new_value}"
        }

    def get_supplements(self) -> List[Dict]:
        """获取本批次所有补录记录"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT * FROM {SUPPLEMENTS_TABLE} WHERE batch_id = ? ORDER BY created_at",
            (self.batch_id,)
        )
        rows = cursor.fetchall()
        results = []
        for row in rows:
            results.append({
                "id": row['id'],
                "supplement_type": row['supplement_type'],
                "target_record_id": row['target_record_id'],
                "field_name": row['field_name'],
                "old_value": row['old_value'],
                "new_value": row['new_value'],
                "remark": row['remark'],
                "operator": row['operator'],
                "created_at": row['created_at']
            })
        return results

    def get_supplement_summary(self) -> Dict[str, Any]:
        """获取补录汇总，清晰展示补录后的差异"""
        supplements = self.get_supplements()
        by_type = {}
        for s in supplements:
            t = s["supplement_type"]
            if t not in by_type:
                by_type[t] = []
            by_type[t].append(s)
        return {
            "total": len(supplements),
            "by_type": {k: {"count": len(v), "items": v} for k, v in by_type.items()},
            "affected_records": list(set(s["target_record_id"] for s in supplements if s["target_record_id"])),
            "diff_summary": [
                {
                    "type": s["supplement_type"],
                    "field": s["field_name"] or "整条记录",
                    "old": s["old_value"],
                    "new": s["new_value"],
                    "remark": s["remark"],
                    "operator": s["operator"]
                }
                for s in supplements
            ]
        }

    def get_updated_data(self, original_df: pd.DataFrame) -> pd.DataFrame:
        """获取包含补录后的数据"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT normalized_data, id, source_id FROM {RAW_RECORDS_TABLE} WHERE batch_id = ?",
            (self.batch_id,)
        )
        rows = cursor.fetchall()
        if not rows:
            return original_df
        records = []
        for row in rows:
            data = json.loads(row['normalized_data'])
            data['_record_id'] = row['id']
            data['_source_id'] = row['source_id']
            records.append(data)
        return pd.DataFrame(records)

    def compare_before_after(self, original_df: pd.DataFrame) -> Dict[str, Any]:
        """对比补录前后的关键指标差异"""
        updated_df = self.get_updated_data(original_df)
        if original_df.empty:
            return {"note": "无原始数据可对比"}
        def _calc_section_stats(df):
            if "声部" not in df.columns or "个人综合分" not in df.columns:
                return pd.DataFrame()
            return df.groupby("声部").agg(
                人数=("人员", "count"),
                平均分=("个人综合分", "mean"),
                达标率=("个人综合分", lambda x: (x >= 80).mean() * 100)
            ).reset_index()
        original_stats = _calc_section_stats(original_df)
        updated_stats = _calc_section_stats(updated_df)
        if original_stats.empty or updated_stats.empty:
            return {"note": "数据不完整，无法计算对比"}
        comparison = original_stats.merge(
            updated_stats,
            on="声部",
            suffixes=("_补录前", "_补录后"),
            how="outer"
        )
        comparison["人数变化"] = comparison["人数_补录后"].fillna(0) - comparison["人数_补录前"].fillna(0)
        comparison["平均分变化"] = comparison["平均分_补录后"].fillna(0) - comparison["平均分_补录前"].fillna(0)
        comparison["达标率变化"] = comparison["达标率_补录后"].fillna(0) - comparison["达标率_补录前"].fillna(0)
        return {
            "comparison_table": comparison,
            "original_count": len(original_df),
            "updated_count": len(updated_df),
            "new_records": len(updated_df) - len(original_df),
            "supplements": self.get_supplement_summary()
        }
