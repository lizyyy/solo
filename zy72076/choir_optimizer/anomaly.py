"""异常检测模块 - 边界样本和例外不被汇总淹没"""
import json
import uuid
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Any

from .config import ANOMALY_TYPES
from .database import get_db, ANOMALIES_TABLE
from .params import ParameterManager


class AnomalyDetector:
    """异常检测器 - 确保例外情况在汇总中不被悄悄淹没"""

    def __init__(self, batch_id: str):
        self.db = get_db()
        self.batch_id = batch_id
        self.param_manager = ParameterManager()
        self.thresholds = self.param_manager.get_thresholds()
        self.anomalies: List[Dict] = []

    def _record_anomaly(self, anomaly_type: str, description: str, severity: str,
                        values: Dict[str, Any], record_id: Optional[str] = None) -> str:
        """记录异常到数据库"""
        anomaly_id = str(uuid.uuid4())
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"""INSERT INTO {ANOMALIES_TABLE} 
               (id, batch_id, record_id, anomaly_type, anomaly_description, 
                severity, anomaly_values, is_resolved, resolution_note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                anomaly_id,
                self.batch_id,
                record_id,
                anomaly_type,
                description,
                severity,
                json.dumps(values, ensure_ascii=False),
                0,
                None,
                datetime.now().isoformat()
            )
        )
        self.db.conn.commit()
        anomaly = {
            "id": anomaly_id,
            "anomaly_type": anomaly_type,
            "anomaly_name": ANOMALY_TYPES.get(anomaly_type, anomaly_type),
            "description": description,
            "severity": severity,
            "values": values,
            "record_id": record_id
        }
        self.anomalies.append(anomaly)
        return anomaly_id

    def detect_low_scores(self, df: pd.DataFrame) -> List[Dict]:
        """检测得分过低的样本"""
        if "个人综合分" not in df.columns:
            return []
        anomalies = []
        pass_threshold = self.thresholds.get('pass', 70)
        low_score_df = df[df["个人综合分"] < pass_threshold]
        for _, row in low_score_df.iterrows():
            anomaly_id = self._record_anomaly(
                anomaly_type="low_score",
                description=f"{row['声部']} - {row['人员']} 个人综合分{row['个人综合分']}低于及格线{pass_threshold}",
                severity="high",
                values={
                    "score": row['个人综合分'],
                    "threshold": pass_threshold,
                    "section": row['声部'],
                    "member": row['人员'],
                    "音准得分": row.get('音准得分'),
                    "节奏得分": row.get('节奏得分'),
                    "合声得分": row.get('合声得分'),
                    "音量平衡": row.get('音量平衡'),
                    "情感表达": row.get('情感表达')
                },
                record_id=row.get('_record_id')
            )
            anomalies.append({"anomaly_id": anomaly_id, "record_id": row.get('_record_id')})
        self.db.log_audit(
            "detect_low_scores",
            {"count": len(anomalies), "threshold": pass_threshold},
            batch_id=self.batch_id
        )
        return anomalies

    def detect_high_std(self, df: pd.DataFrame) -> List[Dict]:
        """检测声部内标准差过大（离散程度高）"""
        if "个人综合分" not in df.columns or "声部" not in df.columns:
            return []
        anomalies = []
        anomaly_std = self.thresholds.get('anomaly_std', 2.0)
        section_std = df.groupby("声部")["个人综合分"].std()
        section_mean = df.groupby("声部")["个人综合分"].mean()
        for section, std_val in section_std.items():
            if pd.isna(std_val):
                continue
            if std_val > anomaly_std * 10:
                high_std_members = df[df["声部"] == section]
                mean_val = section_mean[section]
                outliers = high_std_members[
                    (high_std_members["个人综合分"] > mean_val + std_val) |
                    (high_std_members["个人综合分"] < mean_val - std_val)
                ]
                anomaly_id = self._record_anomaly(
                    anomaly_type="high_std",
                    description=f"{section} 声部内标准差{std_val:.2f}过大，说明水平差异明显",
                    severity="medium",
                    values={
                        "section": section,
                        "std": round(std_val, 2),
                        "mean": round(mean_val, 2),
                        "threshold": anomaly_std * 10,
                        "outlier_count": len(outliers),
                        "outliers": outliers[["人员", "个人综合分"]].to_dict('records')
                    }
                )
                anomalies.append({"anomaly_id": anomaly_id, "section": section})
        self.db.log_audit(
            "detect_high_std",
            {"count": len(anomalies)},
            batch_id=self.batch_id
        )
        return anomalies

    def detect_boundary_samples(self, df: pd.DataFrame) -> List[Dict]:
        """检测边界样本（接近阈值的样本，防止汇总时被忽略）"""
        if "个人综合分" not in df.columns:
            return []
        anomalies = []
        good_threshold = self.thresholds.get('good', 80)
        boundary_range = 3.0
        boundary_df = df[
            (df["个人综合分"] >= good_threshold - boundary_range) &
            (df["个人综合分"] < good_threshold + boundary_range)
        ]
        for _, row in boundary_df.iterrows():
            position = "低于" if row["个人综合分"] < good_threshold else "高于"
            anomaly_id = self._record_anomaly(
                anomaly_type="boundary_sample",
                description=f"{row['声部']} - {row['人员']} 得分{row['个人综合分']}{position}达标线{good_threshold}仅{abs(row['个人综合分'] - good_threshold):.1f}分，属于边界样本",
                severity="low",
                values={
                    "score": row['个人综合分'],
                    "threshold": good_threshold,
                    "boundary_range": boundary_range,
                    "position": position,
                    "distance": abs(row['个人综合分'] - good_threshold),
                    "section": row['声部'],
                    "member": row['人员']
                },
                record_id=row.get('_record_id')
            )
            anomalies.append({"anomaly_id": anomaly_id, "record_id": row.get('_record_id')})
        self.db.log_audit(
            "detect_boundary_samples",
            {"count": len(anomalies), "good_threshold": good_threshold, "boundary_range": boundary_range},
            batch_id=self.batch_id
        )
        return anomalies

    def detect_missing_data(self, df: pd.DataFrame) -> List[Dict]:
        """检测数据缺失"""
        anomalies = []
        score_fields = ["音准得分", "节奏得分", "合声得分", "音量平衡", "情感表达"]
        for _, row in df.iterrows():
            missing_fields = [f for f in score_fields if pd.isna(row.get(f))]
            if missing_fields:
                anomaly_id = self._record_anomaly(
                    anomaly_type="missing_data",
                    description=f"{row.get('声部', '未知声部')} - {row.get('人员', '未知人员')} 缺少字段: {', '.join(missing_fields)}",
                    severity="medium",
                    values={
                        "missing_fields": missing_fields,
                        "section": row.get('声部'),
                        "member": row.get('人员'),
                        "record_id": row.get('_record_id')
                    },
                    record_id=row.get('_record_id')
                )
                anomalies.append({"anomaly_id": anomaly_id, "record_id": row.get('_record_id')})
        self.db.log_audit(
            "detect_missing_data",
            {"count": len(anomalies)},
            batch_id=self.batch_id
        )
        return anomalies

    def detect_attendance_issues(self, df: pd.DataFrame) -> List[Dict]:
        """检测出勤率异常"""
        if "出勤状态" not in df.columns or "声部" not in df.columns:
            return []
        anomalies = []
        section_attendance = df.groupby("声部")["出勤状态"].value_counts(normalize=True).unstack(fill_value=0)
        for section in section_attendance.index:
            absent_rate = section_attendance.loc[section].get("缺勤", 0) * 100
            leave_rate = section_attendance.loc[section].get("请假", 0) * 100
            total_absent = absent_rate + leave_rate
            if total_absent > 20:
                anomaly_id = self._record_anomaly(
                    anomaly_type="attendance_issue",
                    description=f"{section} 声部缺勤+请假率达到{total_absent:.1f}%，超过20%警戒线",
                    severity="medium",
                    values={
                        "section": section,
                        "absent_rate": round(absent_rate, 2),
                        "leave_rate": round(leave_rate, 2),
                        "total_absent": round(total_absent, 2),
                        "threshold": 20
                    }
                )
                anomalies.append({"anomaly_id": anomaly_id, "section": section})
        self.db.log_audit(
            "detect_attendance_issues",
            {"count": len(anomalies)},
            batch_id=self.batch_id
        )
        return anomalies

    def detect_score_drops(self, trend_df: pd.DataFrame) -> List[Dict]:
        """检测得分环比下降超过10%"""
        if trend_df.empty or "环比变化率" not in trend_df.columns:
            return []
        anomalies = []
        drop_threshold = -10.0
        drops = trend_df[trend_df["环比变化率"] < drop_threshold]
        for _, row in drops.iterrows():
            anomaly_id = self._record_anomaly(
                anomaly_type="score_drop",
                description=f"{row['声部']} 在{row['排练日期']}得分环比下降{row['环比变化率']:.1f}%，需要关注",
                severity="high",
                values={
                    "section": row['声部'],
                    "date": row['排练日期'],
                    "score": row['当日平均分'],
                    "drop_rate": row['环比变化率'],
                    "threshold": drop_threshold
                }
            )
            anomalies.append({"anomaly_id": anomaly_id, "section": row['声部']})
        self.db.log_audit(
            "detect_score_drops",
            {"count": len(anomalies), "threshold": drop_threshold},
            batch_id=self.batch_id
        )
        return anomalies

    def run_all_detections(self, df: pd.DataFrame, trend_df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
        """运行所有异常检测"""
        self.thresholds = self.param_manager.get_thresholds()
        cursor = self.db.conn.cursor()
        cursor.execute(f"DELETE FROM {ANOMALIES_TABLE} WHERE batch_id = ?", (self.batch_id,))
        self.db.conn.commit()
        self.anomalies = []
        all_anomalies = {
            "low_scores": self.detect_low_scores(df),
            "high_std": self.detect_high_std(df),
            "boundary_samples": self.detect_boundary_samples(df),
            "missing_data": self.detect_missing_data(df),
            "attendance_issues": self.detect_attendance_issues(df)
        }
        if trend_df is not None and not trend_df.empty:
            all_anomalies["score_drops"] = self.detect_score_drops(trend_df)
        else:
            all_anomalies["score_drops"] = []
        return {
            "anomalies": self.anomalies,
            "by_type": all_anomalies,
            "total_count": len(self.anomalies),
            "high_count": sum(1 for a in self.anomalies if a["severity"] == "high"),
            "medium_count": sum(1 for a in self.anomalies if a["severity"] == "medium"),
            "low_count": sum(1 for a in self.anomalies if a["severity"] == "low")
        }

    def get_anomalies_by_severity(self, severity: Optional[str] = None) -> List[Dict]:
        """按严重程度获取异常列表"""
        if severity:
            return [a for a in self.anomalies if a["severity"] == severity]
        return sorted(self.anomalies, key=lambda x: {"high": 0, "medium": 1, "low": 2}[x["severity"]])

    def get_anomaly_summary(self) -> Dict[str, Any]:
        """获取异常汇总，确保例外不会在汇总数字里消失"""
        summary = {
            "total": len(self.anomalies),
            "by_severity": {
                "high": sum(1 for a in self.anomalies if a["severity"] == "high"),
                "medium": sum(1 for a in self.anomalies if a["severity"] == "medium"),
                "low": sum(1 for a in self.anomalies if a["severity"] == "low")
            },
            "by_type": {},
            "sections_affected": [],
            "details": self.anomalies
        }
        for anomaly_type in ANOMALY_TYPES.keys():
            type_anomalies = [a for a in self.anomalies if a["anomaly_type"] == anomaly_type]
            if type_anomalies:
                summary["by_type"][anomaly_type] = {
                    "count": len(type_anomalies),
                    "name": ANOMALY_TYPES[anomaly_type],
                    "items": type_anomalies
                }
        sections = set()
        for a in self.anomalies:
            if "values" in a and "section" in a["values"]:
                sections.add(a["values"]["section"])
        summary["sections_affected"] = list(sections)
        return summary

    def resolve_anomaly(self, anomaly_id: str, resolution_note: str, operator: str = "周姐"):
        """标记异常为已解决"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"UPDATE {ANOMALIES_TABLE} SET is_resolved = 1, resolution_note = ? WHERE id = ?",
            (resolution_note, anomaly_id)
        )
        self.db.conn.commit()
        for a in self.anomalies:
            if a["id"] == anomaly_id:
                a["is_resolved"] = 1
                a["resolution_note"] = resolution_note
        self.db.log_audit(
            "resolve_anomaly",
            {"anomaly_id": anomaly_id, "resolution": resolution_note},
            batch_id=self.batch_id,
            operator=operator
        )
