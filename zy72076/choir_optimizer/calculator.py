"""计算引擎 - 计算过程全透明可追溯"""
import json
import uuid
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from copy import deepcopy

from .database import get_db, CALCULATIONS_TABLE, CALC_STEPS_TABLE, RAW_RECORDS_TABLE
from .params import ParameterManager


class CalculationStep:
    """计算步骤 - 用于记录每个计算环节的详细过程"""

    def __init__(self, order: int, name: str, input_values: Dict[str, Any],
                 formula: str, output_value: float):
        self.order = order
        self.name = name
        self.input_values = input_values
        self.formula = formula
        self.output_value = output_value


class CalculationEngine:
    """计算引擎 - 每个计算步骤都记录，便于复查"""

    def __init__(self, batch_id: str):
        self.db = get_db()
        self.batch_id = batch_id
        self.param_manager = ParameterManager()
        self.param_version = self.param_manager.get_current_version_tag()
        self.weights = self.param_manager.get_effective_weights()
        self.thresholds = self.param_manager.get_thresholds()
        self._calc_results: List[Dict] = []

    def _record_calc_step(self, calc_id: str, step: CalculationStep):
        """记录单个计算步骤"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"INSERT INTO {CALC_STEPS_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                calc_id,
                step.order,
                step.name,
                json.dumps(step.input_values, ensure_ascii=False),
                step.formula,
                step.output_value,
                datetime.now().isoformat()
            )
        )

    def calculate_personal_score(self, record: Dict, record_id: str) -> Tuple[float, List[CalculationStep]]:
        """计算个人综合分，记录每一步"""
        steps = []
        weights = self.weights
        score_fields = ["音准得分", "节奏得分", "合声得分", "音量平衡", "情感表达"]
        weighted_scores = {}
        total = 0.0
        step_order = 1
        for field in score_fields:
            raw_score = record.get(field)
            if raw_score is None or pd.isna(raw_score):
                raw_score = 0.0
            weight = weights.get(field, 0)
            weighted = raw_score * weight
            step = CalculationStep(
                order=step_order,
                name=f"{field}加权",
                input_values={field: raw_score, "权重": weight},
                formula=f"{field} × 权重 = {raw_score} × {weight}",
                output_value=weighted
            )
            steps.append(step)
            weighted_scores[field] = weighted
            total += weighted
            step_order += 1
        formula_parts = [f"{f}×{weights.get(f, 0)}" for f in score_fields]
        formula = " + ".join(formula_parts)
        step = CalculationStep(
            order=step_order,
            name="综合分汇总",
            input_values=weighted_scores,
            formula=formula,
            output_value=round(total, 2)
        )
        steps.append(step)
        calc_id = str(uuid.uuid4())
        calc_details = {
            "weighted_scores": weighted_scores,
            "weights_used": weights,
            "param_version": self.param_version
        }
        cursor = self.db.conn.cursor()
        with self.db.transaction():
            cursor.execute(
                f"INSERT INTO {CALCULATIONS_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    calc_id,
                    self.batch_id,
                    record_id,
                    "个人综合分",
                    round(total, 2),
                    None,
                    self.param_version,
                    json.dumps(calc_details, ensure_ascii=False),
                    datetime.now().isoformat()
                )
            )
            for step in steps:
                self._record_calc_step(calc_id, step)
        return round(total, 2), steps

    def calculate_section_metrics(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算声部维度的汇总指标"""
        if "个人综合分" not in df.columns:
            records = df.to_dict('records')
            scores = []
            for _, row in df.iterrows():
                record_id = row.get('_record_id')
                score, _ = self.calculate_personal_score(row.to_dict(), record_id)
                scores.append(score)
            df = df.copy()
            df["个人综合分"] = scores
        section_stats = df.groupby("声部").agg(
            声部人数=("人员", "count"),
            声部平均分=("个人综合分", "mean"),
            声部标准差=("个人综合分", "std"),
            声部最高分=("个人综合分", "max"),
            声部最低分=("个人综合分", "min")
        ).reset_index()
        section_stats["声部平均分"] = section_stats["声部平均分"].round(2)
        section_stats["声部标准差"] = section_stats["声部标准差"].round(2)
        pass_threshold = self.thresholds.get('good', 80)
        excellent_threshold = self.thresholds.get('excellent', 90)
        pass_counts = df[df["个人综合分"] >= pass_threshold].groupby("声部").size().reset_index(name="达标人数")
        section_stats = section_stats.merge(pass_counts, on="声部", how="left")
        section_stats["达标人数"] = section_stats["达标人数"].fillna(0).astype(int)
        section_stats["声部达标率"] = (section_stats["达标人数"] / section_stats["声部人数"] * 100).round(2)
        excellent_counts = df[df["个人综合分"] >= excellent_threshold].groupby("声部").size().reset_index(name="优秀人数")
        section_stats = section_stats.merge(excellent_counts, on="声部", how="left")
        section_stats["优秀人数"] = section_stats["优秀人数"].fillna(0).astype(int)
        section_stats["声部优秀率"] = (section_stats["优秀人数"] / section_stats["声部人数"] * 100).round(2)
        def _get_priority(row):
            rate = row["声部达标率"]
            if rate < self.thresholds.get('pass', 70):
                return "优先排练"
            elif rate < self.thresholds.get('good', 80):
                return "加强排练"
            elif rate < self.thresholds.get('excellent', 90):
                return "正常排练"
            else:
                return "保持状态"
        section_stats["排练优先级"] = section_stats.apply(_get_priority, axis=1)
        for _, row in section_stats.iterrows():
            calc_details = {
                "param_version": self.param_version,
                "thresholds": self.thresholds,
                "member_count": row["声部人数"],
                "pass_count": row["达标人数"],
                "excellent_count": row["优秀人数"]
            }
            cursor = self.db.conn.cursor()
            cursor.execute(
                f"INSERT INTO {CALCULATIONS_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    str(uuid.uuid4()),
                    self.batch_id,
                    None,
                    f"声部汇总_{row['声部']}",
                    row["声部平均分"],
                    row["排练优先级"],
                    self.param_version,
                    json.dumps(calc_details, ensure_ascii=False),
                    datetime.now().isoformat()
                )
            )
        self.db.conn.commit()
        self._calc_results.append({
            "type": "section_metrics",
            "data": section_stats.to_dict('records'),
            "param_version": self.param_version
        })
        return section_stats

    def calculate_attendance_metrics(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算出勤率指标"""
        if "出勤状态" not in df.columns:
            return pd.DataFrame()
        att_counts = df.groupby(["声部", "出勤状态"]).size().reset_index(name="人数")
        att_pivot = att_counts.pivot(index="声部", columns="出勤状态", values="人数").fillna(0).reset_index()
        for col in ["出勤", "迟到", "请假", "缺勤"]:
            if col not in att_pivot.columns:
                att_pivot[col] = 0
        att_pivot["总人数"] = att_pivot[["出勤", "迟到", "请假", "缺勤"]].sum(axis=1)
        att_pivot["出勤率"] = ((att_pivot["出勤"] + att_pivot["迟到"] * 0.5) / att_pivot["总人数"] * 100).round(2)
        return att_pivot

    def calculate_trend(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算排练时间趋势（如果有多次排练数据）"""
        if "排练日期" not in df.columns or "个人综合分" not in df.columns:
            return pd.DataFrame()
        trend = df.groupby(["排练日期", "声部"]).agg(
            当日平均分=("个人综合分", "mean"),
            当日参与人数=("人员", "count")
        ).reset_index()
        trend["当日平均分"] = trend["当日平均分"].round(2)
        trend = trend.sort_values(["声部", "排练日期"])
        trend["环比变化"] = trend.groupby("声部")["当日平均分"].diff().round(2)
        trend["环比变化率"] = (trend.groupby("声部")["当日平均分"].pct_change() * 100).round(2)
        return trend

    def get_calculation_audit(self, record_id: Optional[str] = None) -> List[Dict]:
        """获取计算审计记录，用于复查"""
        cursor = self.db.conn.cursor()
        if record_id:
            cursor.execute(
                f"""
                SELECT c.*, GROUP_CONCAT(s.step_name || '|' || s.formula || '|' || s.output_value, '||') as steps
                FROM {CALCULATIONS_TABLE} c
                LEFT JOIN {CALC_STEPS_TABLE} s ON c.id = s.calc_id
                WHERE c.batch_id = ? AND c.record_id = ?
                GROUP BY c.id
                ORDER BY c.created_at
                """,
                (self.batch_id, record_id)
            )
        else:
            cursor.execute(
                f"""
                SELECT c.*, GROUP_CONCAT(s.step_name || '|' || s.formula || '|' || s.output_value, '||') as steps
                FROM {CALCULATIONS_TABLE} c
                LEFT JOIN {CALC_STEPS_TABLE} s ON c.id = s.calc_id
                WHERE c.batch_id = ?
                GROUP BY c.id
                ORDER BY c.created_at
                """,
                (self.batch_id,)
            )
        rows = cursor.fetchall()
        results = []
        for row in rows:
            result = {
                "id": row['id'],
                "calc_type": row['calc_type'],
                "result_value": row['result_value'],
                "result_text": row['result_text'],
                "param_version": row['param_version'],
                "details": json.loads(row['calc_details']) if row['calc_details'] else {},
                "created_at": row['created_at']
            }
            if row['steps']:
                steps = []
                for step_str in row['steps'].split('||'):
                    parts = step_str.split('|')
                    if len(parts) >= 3:
                        steps.append({
                            "step_name": parts[0],
                            "formula": parts[1],
                            "output_value": float(parts[2])
                        })
                result["steps"] = steps
            results.append(result)
        return results

    def run_full_calculation(self, df: pd.DataFrame) -> Dict[str, Any]:
        """运行全套计算，返回所有结果"""
        df = df.copy()
        df = df[df["人员"].notna() & (df["人员"] != "")].copy()
        df = df.reset_index(drop=True)
        personal_scores = []
        for _, row in df.iterrows():
            record_id = row.get('_record_id')
            score, _ = self.calculate_personal_score(row.to_dict(), record_id)
            personal_scores.append(score)
        df["个人综合分"] = personal_scores
        section_metrics = self.calculate_section_metrics(df)
        attendance_metrics = self.calculate_attendance_metrics(df)
        trend_metrics = self.calculate_trend(df)
        self.db.log_audit(
            "full_calculation",
            {
                "param_version": self.param_version,
                "weights": self.weights,
                "thresholds": self.thresholds,
                "record_count": len(df),
                "section_count": len(section_metrics)
            },
            batch_id=self.batch_id
        )
        return {
            "personal_scores": df,
            "section_metrics": section_metrics,
            "attendance_metrics": attendance_metrics,
            "trend_metrics": trend_metrics,
            "param_version": self.param_version,
            "weights_used": self.weights,
            "thresholds_used": self.thresholds
        }
