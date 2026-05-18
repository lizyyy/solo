import pandas as pd
import numpy as np
import yaml
import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = [
    "艺术品编号",
    "艺术品名称",
    "估值基数(CNY)",
    "临时出库",
    "临时出库天数",
    "币种",
]

CURRENCY_SYMBOLS = {
    "CNY": "¥",
    "USD": "$",
    "EUR": "€",
    "JPY": "¥",
}


class ValuationEngine:
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self._progress = None
        self.errors: List[Dict[str, Any]] = []

    @property
    def progress(self):
        if self._progress is None:
            self._progress = self._load_progress()
        return self._progress

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        default_config = {
            "valuation": {
                "default_currency": "CNY",
                "supported_currencies": ["CNY", "USD", "EUR", "JPY"],
                "exchange_rates": {
                    "USD_to_CNY": 7.25,
                    "EUR_to_CNY": 7.85,
                    "JPY_to_CNY": 0.048,
                },
                "temporary_out_adjustment": {
                    "discount_rate": 0.85,
                    "max_days": 30,
                },
                "valuation_rules": {
                    "base_value_multiplier": 1.0,
                    "insurance_premium_rate": 0.005,
                    "age_depreciation_rate": 0.02,
                },
            },
            "processing": {
                "remove_duplicates": True,
                "skip_errors": True,
                "save_progress": True,
                "progress_file": ".valuation_progress.json",
            },
            "output": {
                "format": "xlsx",
                "include_summary": True,
                "include_details": True,
                "comparison_report": True,
                "timestamp_filename": False,
            },
        }

        if config_path and os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                user_config = yaml.safe_load(f)
            self._deep_update(default_config, user_config)
            logger.info(f"已加载配置文件: {config_path}")
        else:
            logger.info("使用默认配置")

        return default_config

    def _deep_update(self, d: Dict, u: Dict) -> Dict:
        for k, v in u.items():
            if isinstance(v, dict) and k in d and isinstance(d[k], dict):
                self._deep_update(d[k], v)
            else:
                d[k] = v
        return d

    def _load_progress(self) -> Dict:
        progress_file = self.config["processing"]["progress_file"]
        if os.path.exists(progress_file):
            with open(progress_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"processed_ids": [], "last_run": None}

    def _save_progress(self, processed_ids: List[str]):
        if not self.config["processing"]["save_progress"]:
            return

        self._progress = {
            "processed_ids": processed_ids,
            "last_run": datetime.now().isoformat(),
        }
        progress_file = self.config["processing"]["progress_file"]
        with open(progress_file, "w", encoding="utf-8") as f:
            json.dump(self._progress, f, indent=2, ensure_ascii=False)

    def validate_input(self, df: pd.DataFrame) -> Tuple[bool, List[str]]:
        errors = []
        missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
        
        if missing_cols:
            errors.append(f"缺少必需列: {', '.join(missing_cols)}")
            return False, errors

        if len(df) == 0:
            errors.append("输入文件为空，没有数据行")
            return False, errors

        return True, errors

    def _convert_to_cny(self, value: float, currency: str) -> float:
        if currency == "CNY":
            return value
        
        rate_key = f"{currency}_to_CNY"
        rate = self.config["valuation"]["exchange_rates"].get(rate_key)
        
        if rate is None:
            raise ValueError(f"不支持的币种汇率: {currency}")
        
        return value * rate

    def _apply_temporary_out_adjustment(
        self, base_value: float, is_temporary_out: bool, days: int
    ) -> Tuple[float, Dict[str, Any]]:
        adjustment_info = {
            "调整前估值": base_value,
            "是否临时出库": is_temporary_out,
            "临时出库天数": days,
            "调整率": 1.0,
            "调整原因": "正常寄存",
        }

        if not is_temporary_out:
            return base_value, adjustment_info

        discount_rate = self.config["valuation"]["temporary_out_adjustment"][
            "discount_rate"
        ]
        max_days = self.config["valuation"]["temporary_out_adjustment"]["max_days"]

        if days > max_days:
            adjustment_info["调整原因"] = f"临时出库超{max_days}天"
            adjustment_info["调整率"] = discount_rate
        else:
            adjustment_info["调整原因"] = f"临时出库{days}天"
            adjustment_info["调整率"] = discount_rate + (
                (1 - discount_rate) * (max_days - days) / max_days
            )

        adjusted_value = base_value * adjustment_info["调整率"]
        adjustment_info["调整后估值"] = adjusted_value

        return adjusted_value, adjustment_info

    def _calculate_insurance_premium(self, value: float) -> float:
        rate = self.config["valuation"]["valuation_rules"]["insurance_premium_rate"]
        return value * rate

    def process_row(self, row: pd.Series, row_num: int) -> Optional[Dict[str, Any]]:
        try:
            art_id = str(row["艺术品编号"])
            base_value = float(row["估值基数(CNY)"])
            currency = str(row["币种"]).upper()
            is_temporary_out = str(row["临时出库"]).strip() in ["是", "yes", "true", "True", "1"]
            temp_out_days = int(row["临时出库天数"]) if pd.notna(row["临时出库天数"]) else 0

            value_in_cny = self._convert_to_cny(base_value, currency)
            adjusted_value, adjustment_info = self._apply_temporary_out_adjustment(
                value_in_cny, is_temporary_out, temp_out_days
            )
            insurance_premium = self._calculate_insurance_premium(adjusted_value)

            result = {
                "艺术品编号": art_id,
                "艺术品名称": str(row.get("艺术品名称", "")),
                "艺术家": str(row.get("艺术家", "")),
                "类别": str(row.get("类别", "")),
                "原始币种": currency,
                "原始估值": base_value,
                "币种转换后(CNY)": round(value_in_cny, 2),
                "临时出库调整后估值(CNY)": round(adjusted_value, 2),
                "保险保费(CNY)": round(insurance_premium, 2),
                "临时出库状态": "是" if is_temporary_out else "否",
                "临时出库天数": temp_out_days,
                "调整说明": adjustment_info["调整原因"],
                "调整率": round(adjustment_info["调整率"], 4),
                "处理状态": "成功",
            }

            return result

        except Exception as e:
            error_info = {
                "行号": row_num,
                "艺术品编号": str(row.get("艺术品编号", "未知")),
                "错误类型": type(e).__name__,
                "错误信息": str(e),
            }
            self.errors.append(error_info)
            logger.error(f"处理第 {row_num} 行失败: {str(e)}")

            if not self.config["processing"]["skip_errors"]:
                raise

            return {
                "艺术品编号": str(row.get("艺术品编号", "未知")),
                "艺术品名称": str(row.get("艺术品名称", "")),
                "处理状态": "失败",
                "错误信息": str(e),
            }

    def process_data(
        self, df: pd.DataFrame, resume: bool = False
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        is_valid, errors = self.validate_input(df)
        if not is_valid:
            for error in errors:
                logger.error(error)
            raise ValueError("输入数据验证失败: " + "; ".join(errors))

        if self.config["processing"]["remove_duplicates"]:
            dup_count = df.duplicated(subset=["艺术品编号"]).sum()
            if dup_count > 0:
                logger.info(f"发现 {dup_count} 条重复记录，已移除")
                df = df.drop_duplicates(subset=["艺术品编号"], keep="first")

        processed_ids = self.progress["processed_ids"] if resume else []
        results = []

        for idx, row in df.iterrows():
            art_id = str(row["艺术品编号"])
            if resume and art_id in processed_ids:
                logger.debug(f"跳过已处理: {art_id}")
                continue

            result = self.process_row(row, idx + 2)
            if result:
                results.append(result)
                processed_ids.append(art_id)

        self._save_progress(processed_ids)

        success_results = [r for r in results if r.get("处理状态") == "成功"]
        failed_results = [r for r in results if r.get("处理状态") == "失败"]

        return pd.DataFrame(success_results), pd.DataFrame(failed_results)

    def generate_summary(
        self, success_df: pd.DataFrame, failed_df: pd.DataFrame
    ) -> Dict[str, Any]:
        total_count = len(success_df) + len(failed_df)
        success_count = len(success_df)
        failed_count = len(failed_df)

        if success_count > 0:
            total_valuation = success_df["临时出库调整后估值(CNY)"].sum()
            total_premium = success_df["保险保费(CNY)"].sum()
            avg_valuation = success_df["临时出库调整后估值(CNY)"].mean()
            max_valuation = success_df["临时出库调整后估值(CNY)"].max()
            min_valuation = success_df["临时出库调整后估值(CNY)"].min()

            temp_out_count = success_df[success_df["临时出库状态"] == "是"].shape[0]
            temp_out_valuation = success_df[success_df["临时出库状态"] == "是"][
                "临时出库调整后估值(CNY)"
            ].sum()
        else:
            total_valuation = 0
            total_premium = 0
            avg_valuation = 0
            max_valuation = 0
            min_valuation = 0
            temp_out_count = 0
            temp_out_valuation = 0

        currency_breakdown = {}
        if success_count > 0:
            for currency in success_df["原始币种"].unique():
                subset = success_df[success_df["原始币种"] == currency]
                currency_breakdown[currency] = {
                    "数量": len(subset),
                    "总估值(CNY)": round(subset["临时出库调整后估值(CNY)"].sum(), 2),
                }

        summary = {
            "统计时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "处理总数": total_count,
            "成功数量": success_count,
            "失败数量": failed_count,
            "成功率": round(success_count / total_count * 100, 2) if total_count > 0 else 0,
            "总估值(CNY)": round(total_valuation, 2),
            "总保险保费(CNY)": round(total_premium, 2),
            "平均估值(CNY)": round(avg_valuation, 2),
            "最高估值(CNY)": round(max_valuation, 2),
            "最低估值(CNY)": round(min_valuation, 2),
            "临时出库数量": temp_out_count,
            "临时出库总估值(CNY)": round(temp_out_valuation, 2),
            "币种分布": currency_breakdown,
        }

        return summary

    def save_output(
        self,
        success_df: pd.DataFrame,
        failed_df: pd.DataFrame,
        summary: Dict[str, Any],
        output_path: str,
    ) -> str:
        if self.config["output"]["timestamp_filename"]:
            base, ext = os.path.splitext(output_path)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"{base}_{timestamp}{ext}"

        output_format = self.config["output"]["format"]

        if output_format == "xlsx":
            with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                if self.config["output"]["include_summary"]:
                    summary_df = pd.DataFrame(
                        [(k, v) for k, v in summary.items() if k != "币种分布"],
                        columns=["项目", "数值"],
                    )
                    summary_df.to_excel(writer, sheet_name="估值汇总", index=False)

                    if "币种分布" in summary and summary["币种分布"]:
                        currency_data = []
                        for curr, data in summary["币种分布"].items():
                            currency_data.append(
                                {
                                    "币种": curr,
                                    "数量": data["数量"],
                                    "总估值(CNY)": data["总估值(CNY)"],
                                }
                            )
                        pd.DataFrame(currency_data).to_excel(
                            writer, sheet_name="币种分布", index=False
                        )

                if self.config["output"]["include_details"]:
                    success_df.to_excel(
                        writer, sheet_name="估值成功明细", index=False
                    )
                    if len(failed_df) > 0:
                        failed_df.to_excel(
                            writer, sheet_name="估值失败明细", index=False
                        )

                if self.config["output"]["comparison_report"]:
                    comparison_df = success_df[
                        [
                            "艺术品编号",
                            "艺术品名称",
                            "原始币种",
                            "原始估值",
                            "币种转换后(CNY)",
                            "临时出库状态",
                            "临时出库天数",
                            "临时出库调整后估值(CNY)",
                            "保险保费(CNY)",
                        ]
                    ]
                    comparison_df.to_excel(
                        writer, sheet_name="对比分析报告", index=False
                    )

        else:
            success_df.to_csv(output_path, index=False, encoding="utf-8-sig")

        logger.info(f"输出文件已保存: {output_path}")
        return output_path

    def clear_progress(self):
        progress_file = self.config["processing"]["progress_file"]
        if os.path.exists(progress_file):
            os.remove(progress_file)
            logger.info(f"已清除进度文件: {progress_file}")
        self._progress = {"processed_ids": [], "last_run": None}
