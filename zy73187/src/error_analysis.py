import pandas as pd
import json
import copy
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "data" / "error_samples.csv"


class ErrorAnalysisPipeline:
    """统一数据源的误差传播错题归因分析管线。

    所有输出（筛选条件、统计、明细表、CSV导出）共享同一份处理后的 DataFrame，
    确保图表、详情、导出的口径完全一致。
    """

    def __init__(self, data_path: Path = DATA_PATH):
        self.raw_df = pd.read_csv(data_path)
        self.df = self._preprocess(self.raw_df)
        self.active_filters = {}
        self.filtered_df = self.df.copy()
        self.last_recalc_params = None

    @staticmethod
    def _preprocess(df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["created_at"] = pd.to_datetime(df["created_at"])
        df["confirmed_at"] = pd.to_datetime(df["confirmed_at"], errors="coerce")
        for col in ["supplementary_remark", "supplementary_explanation",
                    "confirm_before_note", "confirm_after_note"]:
            df[col] = df[col].fillna("")
        df["has_supplementary"] = (
            (df["supplementary_remark"] != "") | (df["supplementary_explanation"] != "")
        )
        df["has_confirm_diff"] = (
            (df["confirm_before_note"] != "")
            & (df["confirm_after_note"] != "")
            & (df["confirm_before_note"] != df["confirm_after_note"])
        )
        df["error_magnitude"] = pd.to_numeric(df["error_magnitude"], errors="coerce")
        df["propagated_error"] = pd.to_numeric(df["propagated_error"], errors="coerce")
        return df

    # --------------- 筛选（口径入口）---------------
    def apply_filters(self, **filters) -> "ErrorAnalysisPipeline":
        """应用筛选条件并记录。所有后续输出都基于 self.filtered_df。"""
        self.active_filters = {k: v for k, v in filters.items() if v not in (None, "", [], "all")}
        df = self.df.copy()

        if "subject" in self.active_filters:
            df = df[df["subject"] == self.active_filters["subject"]]
        if "error_type" in self.active_filters:
            df = df[df["error_type"] == self.active_filters["error_type"]]
        if "error_source" in self.active_filters:
            df = df[df["error_source"] == self.active_filters["error_source"]]
        if "review_round" in self.active_filters:
            df = df[df["review_round"] == int(self.active_filters["review_round"])]
        if "manual_confirmed" in self.active_filters:
            val = self.active_filters["manual_confirmed"]
            if val in ("true", "True", True):
                df = df[df["manual_confirmed"] == True]
            elif val in ("false", "False", False):
                df = df[df["manual_confirmed"] != True]
        if "has_duplicates" in self.active_filters:
            if self.active_filters["has_duplicates"] in ("true", "True", True):
                df = df[df["is_duplicate"] == True]
        if "has_supplementary" in self.active_filters:
            if self.active_filters["has_supplementary"] in ("true", "True", True):
                df = df[df["has_supplementary"] == True]
        if "min_error_magnitude" in self.active_filters:
            df = df[df["error_magnitude"] >= float(self.active_filters["min_error_magnitude"])]

        self.filtered_df = df.reset_index(drop=True)
        return self

    # --------------- 复算（误差传播重算）---------------
    def recalculate_propagated_error(self, formula: str = "rss") -> "ErrorAnalysisPipeline":
        """按指定公式复算传播误差，更新 filtered_df 并记录参数。

        formula:
          - "rss": 方和根 sqrt(ΣΔx_i²)  （默认）
          - "abs": 绝对和 Σ|Δx_i|
          - "max": 最大分量 max(|Δx_i|)
        这里单条记录的 propagated_error 即 Δx，复算的是分组汇总口径。
        """
        self.last_recalc_params = {"formula": formula}
        df = self.filtered_df.copy()

        if formula == "rss":
            df["_recalc_component"] = df["propagated_error"] ** 2
        elif formula == "abs":
            df["_recalc_component"] = df["propagated_error"].abs()
        elif formula == "max":
            df["_recalc_component"] = df["propagated_error"].abs()
        else:
            raise ValueError(f"Unknown formula: {formula}")

        df["recalc_formula"] = formula
        self.filtered_df = df
        return self

    # --------------- 重复检测 ---------------
    def detect_duplicates(self) -> pd.DataFrame:
        """返回所有被标记为重复或作为重复源的记录详情，用于提醒。"""
        dup_mask = self.filtered_df["is_duplicate"] == True
        dup_ids = set(self.filtered_df.loc[dup_mask, "duplicate_of"].dropna())
        src_mask = self.filtered_df["sample_id"].isin(dup_ids)
        return self.filtered_df[dup_mask | src_mask].sort_values(["duplicate_of", "sample_id"])

    # --------------- 人工确认差异 ---------------
    def get_confirm_diffs(self) -> pd.DataFrame:
        """返回所有存在人工确认前/后备注差异的记录，用于第二天复盘。"""
        return self.filtered_df[self.filtered_df["has_confirm_diff"]].sort_values("confirmed_at")

    # --------------- 统计数字 ---------------
    def get_statistics(self) -> dict:
        """基于当前 filtered_df 生成统计数字——与明细表完全同口径。"""
        df = self.filtered_df
        total = len(df)
        by_subject = df["subject"].value_counts().to_dict()
        by_error_type = df["error_type"].value_counts().to_dict()
        by_error_source = df["error_source"].value_counts().to_dict()
        duplicate_count = int((df["is_duplicate"] == True).sum())
        confirmed_count = int((df["manual_confirmed"] == True).sum())
        unconfirmed_count = total - confirmed_count
        supplementary_count = int(df["has_supplementary"].sum())
        confirm_diff_count = int(df["has_confirm_diff"].sum())
        avg_propagated = float(df["propagated_error"].mean()) if total else 0.0
        sum_error_magnitude = float(df["error_magnitude"].sum()) if total else 0.0

        if self.last_recalc_params:
            formula = self.last_recalc_params["formula"]
            if formula == "rss":
                grouped_propagated = float((df["propagated_error"] ** 2).sum() ** 0.5)
            elif formula == "abs":
                grouped_propagated = float(df["propagated_error"].abs().sum())
            else:
                grouped_propagated = float(df["propagated_error"].abs().max()) if total else 0.0
        else:
            grouped_propagated = float((df["propagated_error"] ** 2).sum() ** 0.5) if total else 0.0

        return {
            "total_samples": total,
            "by_subject": by_subject,
            "by_error_type": by_error_type,
            "by_error_source": by_error_source,
            "duplicate_count": duplicate_count,
            "confirmed_count": confirmed_count,
            "unconfirmed_count": unconfirmed_count,
            "supplementary_count": supplementary_count,
            "confirm_diff_count": confirm_diff_count,
            "avg_propagated_error": round(avg_propagated, 6),
            "sum_error_magnitude": round(sum_error_magnitude, 6),
            "grouped_propagated_error": round(grouped_propagated, 6),
            "recalc_formula": self.last_recalc_params["formula"] if self.last_recalc_params else "rss",
            "active_filters": self.active_filters,
        }

    @staticmethod
    def _df_to_safe_records(df: pd.DataFrame) -> list:
        """将 DataFrame 转为 JSON 安全的 records 列表，处理 NaT/NaN/Timestamp。"""
        import pandas as pd
        df = df.copy().where(pd.notnull(df), None)
        records = df.to_dict(orient="records")
        nat_type = type(pd.NaT)
        for r in records:
            for k, v in list(r.items()):
                if isinstance(v, pd.Timestamp):
                    r[k] = v.strftime("%Y-%m-%d %H:%M") if pd.notnull(v) else ""
                elif type(v) is nat_type:
                    r[k] = ""
                elif isinstance(v, float) and pd.isna(v):
                    r[k] = None
        return records

    # --------------- 明细表 ---------------
    def get_detail_table(self) -> list:
        """基于当前 filtered_df 生成明细表列表——与统计数字同口径。"""
        return self._df_to_safe_records(self.filtered_df)

    # --------------- CSV 导出（同一口径）---------------
    def export_csv(self) -> str:
        """导出 CSV，内容与明细表、统计完全同口径。"""
        df = self.filtered_df.copy()
        df = df.drop(columns=["has_supplementary", "has_confirm_diff"], errors="ignore")
        if "_recalc_component" in df.columns:
            df = df.drop(columns=["_recalc_component"])
        df["is_duplicate_warning"] = df["is_duplicate"].apply(
            lambda x: "⚠ 重复样本，请核对 duplicate_of 列" if x else ""
        )
        return df.to_csv(index=False)

    # --------------- 筛选条件元数据（供前端下拉）---------------
    def get_filter_options(self) -> dict:
        return {
            "subject": sorted(self.df["subject"].dropna().unique().tolist()),
            "error_type": sorted(self.df["error_type"].dropna().unique().tolist()),
            "error_source": sorted(self.df["error_source"].dropna().unique().tolist()),
            "review_round": sorted(self.df["review_round"].dropna().unique().tolist()),
        }

    # --------------- 单条详情（含重复提醒和确认差异）---------------
    def get_sample_detail(self, sample_id: str) -> dict:
        row = self.df[self.df["sample_id"] == sample_id]
        if row.empty:
            return {}
        rec = row.iloc[0].to_dict()
        nat_type = type(pd.NaT)
        for k, v in list(rec.items()):
            if isinstance(v, pd.Timestamp):
                rec[k] = v.strftime("%Y-%m-%d %H:%M") if pd.notnull(v) else ""
            elif type(v) is nat_type:
                rec[k] = ""
            elif isinstance(v, float) and pd.isna(v):
                rec[k] = None

        warnings = []
        if rec.get("is_duplicate") == True:
            warnings.append(
                f"⚠ 该样本不是普通记录，标记为重复样本，对应主记录 {rec.get('duplicate_of')}。"
                "请核对是否为同一人重复提交或自我修正。"
            )
        duplicates_of_this = self.df[
            (self.df["duplicate_of"] == sample_id) & (self.df["sample_id"] != sample_id)
        ]["sample_id"].tolist()
        if duplicates_of_this:
            warnings.append(
                f"⚠ 该样本被其他记录引用为重复源：{', '.join(duplicates_of_this)}。"
            )
        rec["warnings"] = warnings
        return rec

    # --------------- 图表数据（同口径）---------------
    def get_chart_data(self) -> dict:
        """返回前端图表需要的数据，全部基于当前 filtered_df。"""
        df = self.filtered_df
        subject_stats = df.groupby("subject").agg(
            count=("sample_id", "count"),
            avg_error=("propagated_error", "mean"),
            sum_sq_error=("error_magnitude", "sum"),
        ).reset_index()
        error_type_stats = df.groupby("error_type").agg(
            count=("sample_id", "count"),
        ).reset_index()
        error_source_stats = df.groupby("error_source").agg(
            count=("sample_id", "count"),
        ).reset_index()
        return {
            "subject": subject_stats.to_dict(orient="records"),
            "error_type": error_type_stats.to_dict(orient="records"),
            "error_source": error_source_stats.to_dict(orient="records"),
            "filters": self.active_filters,
        }

    # --------------- 完整统一结果包 ---------------
    def get_unified_result(self) -> dict:
        """一次性返回所有输出——保证完全同一套数据口径。"""
        return {
            "filters": self.active_filters,
            "filter_options": self.get_filter_options(),
            "statistics": self.get_statistics(),
            "detail_table": self.get_detail_table(),
            "chart_data": self.get_chart_data(),
            "duplicates": self._df_to_safe_records(self.detect_duplicates()),
            "confirm_diffs": self._df_to_safe_records(self.get_confirm_diffs()),
            "recalc_params": self.last_recalc_params or {"formula": "rss"},
        }
