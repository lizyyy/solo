from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .models import CupScore, RoastBatch


class CupScoreManager:
    """杯测分数管理器"""

    MIN_SCORE = 0
    MAX_SCORE = 10

    def associate(
        self,
        batch: RoastBatch,
        aroma: float,
        flavor: float,
        aftertaste: float,
        acidity: float,
        body: float,
        balance: float,
        uniformity: float,
        overall: float,
        defects: float = 0.0,
    ) -> RoastBatch:
        """关联杯测分数到批次"""
        scores = [aroma, flavor, aftertaste, acidity, body, balance, uniformity, overall]

        issues = []
        for name, score in zip(
            ["香气", "风味", "余韵", "酸质", "醇厚度", "平衡", "一致性", "整体"],
            scores,
        ):
            if score < self.MIN_SCORE or score > self.MAX_SCORE:
                issues.append(f"{name}: {score}")

        if issues:
            raise ValueError(
                f"杯测分数必须在 {self.MIN_SCORE}-{self.MAX_SCORE} 之间: "
                f"{', '.join(issues)}"
            )

        if defects < 0:
            raise ValueError(f"缺陷分不能为负值: {defects}")

        cup_score = CupScore(
            aroma=aroma,
            flavor=flavor,
            aftertaste=aftertaste,
            acidity=acidity,
            body=body,
            balance=balance,
            uniformity=uniformity,
            overall=overall,
            defects=defects,
        )

        return batch.model_copy(update={"cup_score": cup_score})

    def import_from_file(
        self,
        batch: RoastBatch,
        file_path: str,
    ) -> RoastBatch:
        """从文件导入杯测分数"""
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"杯测文件不存在: {file_path}")

        suffix = path.suffix.lower()

        if suffix == ".json":
            return self._import_from_json(batch, path)
        elif suffix == ".csv":
            return self._import_from_csv(batch, path)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _import_from_json(self, batch: RoastBatch, path: Path) -> RoastBatch:
        """从 JSON 导入杯测分数"""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        data = self._normalize_cupping_data(data, batch.batch_id)

        return self.associate(
            batch,
            aroma=data["aroma"],
            flavor=data["flavor"],
            aftertaste=data["aftertaste"],
            acidity=data["acidity"],
            body=data["body"],
            balance=data["balance"],
            uniformity=data["uniformity"],
            overall=data["overall"],
            defects=data.get("defects", 0.0),
        )

    def _import_from_csv(self, batch: RoastBatch, path: Path) -> RoastBatch:
        """从 CSV 导入杯测分数"""
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            data = {}
            for row in reader:
                if row.get("batch_id") == batch.batch_id or len(data) == 0:
                    data = row

        if not data:
            raise ValueError(f"在 CSV 中未找到批次 {batch.batch_id} 的数据")

        normalized = self._normalize_cupping_data(data, batch.batch_id)

        return self.associate(
            batch,
            aroma=normalized["aroma"],
            flavor=normalized["flavor"],
            aftertaste=normalized["aftertaste"],
            acidity=normalized["acidity"],
            body=normalized["body"],
            balance=normalized["balance"],
            uniformity=normalized["uniformity"],
            overall=normalized["overall"],
            defects=normalized.get("defects", 0.0),
        )

    @staticmethod
    def _normalize_cupping_data(data: Dict[str, Any], batch_id: str) -> Dict[str, float]:
        """标准化杯测数据"""
        mapping = {
            "aroma": ["aroma", "香气", "香氣"],
            "flavor": ["flavor", "风味"],
            "aftertaste": ["aftertaste", "余韵", "after taste", "finish"],
            "acidity": ["acidity", "酸质", "酸度"],
            "body": ["body", "醇厚度", "醇度"],
            "balance": ["balance", "平衡"],
            "uniformity": ["uniformity", "一致性", "均匀度"],
            "overall": ["overall", "整体", "总评", "综合"],
            "defects": ["defects", "缺陷"],
        }

        normalized: Dict[str, float] = {}

        for key, aliases in mapping.items():
            value = None
            for alias in aliases:
                if alias in data:
                    value = data[alias]
                    break
                if value is not None:
                    break

            if value is None and key != "defects":
                raise ValueError(f"缺少杯测指标: {key}")

            if value is not None:
                normalized[key] = float(value)

        return normalized

    def analyze_correlations(
        self,
        batches: List[RoastBatch],
    ) -> Dict[str, Any]:
        """分析烘焙参数与杯测分数的相关性"""
        scored_batches = [b for b in batches if b.cup_score]

        if len(scored_batches) < 2:
            return {"error": "需要至少 2 个带有杯测分数的批次进行相关性分析"}

        correlations: Dict[str, Any] = {
            "total_batches_analyzed": len(scored_batches),
            "correlations": [],
            "insights": [],
        }

        fc_temp_scores = [
            (b.first_crack.start_temp, b.cup_score.total_score)
            for b in scored_batches
            if b.first_crack and b.first_crack.start_temp
        ]

        if fc_temp_scores:
            corr = self._calculate_simple_correlation(fc_temp_scores)
            correlations["correlations"].append({
                "factor": "一爆起始温度",
                "correlation": round(corr, 3),
                "interpretation": self._interpret_correlation(corr),
            })

        fc_ratio_scores = [
            (b.get_first_crack_time_ratio(), b.cup_score.total_score)
            for b in scored_batches
            if b.first_crack and b.get_first_crack_time_ratio()
        ]

        if fc_ratio_scores:
            corr = self._calculate_simple_correlation(fc_ratio_scores)
            correlations["correlations"].append({
                "factor": "一爆时间比例",
                "correlation": round(corr, 3),
                "interpretation": self._interpret_correlation(corr),
            })

        drop_temp_scores = [
            (b.dropout_temp, b.cup_score.total_score)
            for b in scored_batches
            if b.dropout_temp
        ]

        if drop_temp_scores:
            corr = self._calculate_simple_correlation(drop_temp_scores)
            correlations["correlations"].append({
                "factor": "出炉温度",
                "correlation": round(corr, 3),
                "interpretation": self._interpret_correlation(corr),
            })

        weight_loss_scores = [
            (b.weight_loss_percent, b.cup_score.total_score)
            for b in scored_batches
            if b.weight_loss_percent
        ]

        if weight_loss_scores:
            corr = self._calculate_simple_correlation(weight_loss_scores)
            correlations["correlations"].append({
                "factor": "减重比例",
                "correlation": round(corr, 3),
                "interpretation": self._interpret_correlation(corr),
            })

        correlations["insights"] = self._generate_insights(correlations["correlations"])

        return correlations

    @staticmethod
    def _calculate_simple_correlation(points: List[Tuple[float, float]]) -> float:
        """计算简单相关性系数"""
        if len(points) < 2:
            return 0.0

        x = [p[0] for p in points]
        y = [p[1] for p in points]

        n = len(points)
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xy = sum(xi * yi for xi, yi in points)
        sum_x2 = sum(xi ** 2 for xi in x)
        sum_y2 = sum(yi ** 2 for yi in y)

        numerator = n * sum_xy - sum_x * sum_y
        denominator1 = n * sum_x2 - sum_x ** 2
        denominator2 = n * sum_y2 - sum_y ** 2

        if denominator1 == 0 or denominator2 == 0:
            return 0.0

        import math
        denominator = math.sqrt(denominator1 * denominator2)

        return numerator / denominator if denominator != 0 else 0.0

    @staticmethod
    def _interpret_correlation(corr: float) -> str:
        """解释相关性系数"""
        abs_corr = abs(corr)

        if abs_corr >= 0.8:
            strength = "强"
        elif abs_corr >= 0.5:
            strength = "中等"
        elif abs_corr >= 0.3:
            strength = "弱"
        else:
            strength = "几乎无"

        direction = "正相关" if corr > 0 else "负相关"

        return f"{strength}{direction}"

    @staticmethod
    def _generate_insights(correlations: List[Dict[str, Any]]) -> List[str]:
        """生成洞察"""
        insights: List[str] = []

        for corr_data in correlations:
            factor = corr_data["factor"]
            correlation = corr_data["correlation"]

            if abs(correlation) >= 0.5:
                if correlation > 0:
                    insights.append(
                        f"{factor} 与杯测分数呈正相关 (r={correlation:.3f})，"
                        f"建议优化此参数可能提升杯测质量"
                    )
                else:
                    insights.append(
                        f"{factor} 与杯测分数呈负相关 (r={correlation:.3f})，"
                        f"建议降低此参数可能提升杯测质量"
                    )

        return insights

    def export_score_summary(self, batches: List[RoastBatch]) -> List[Dict[str, Any]]:
        """导出杯测分数摘要"""
        summary = []

        for batch in batches:
            if not batch.cup_score:
                continue

            summary.append({
                "batch_id": batch.batch_id,
                "coffee_name": batch.coffee_name,
                "total_score": batch.cup_score.total_score,
                "quality_level": batch.cup_score.quality_level,
                "aroma": batch.cup_score.aroma,
                "flavor": batch.cup_score.flavor,
                "aftertaste": batch.cup_score.aftertaste,
                "acidity": batch.cup_score.acidity,
                "body": batch.cup_score.body,
                "balance": batch.cup_score.balance,
                "uniformity": batch.cup_score.uniformity,
                "overall": batch.cup_score.overall,
                "defects": batch.cup_score.defects,
                "fc_start_temp": batch.first_crack.start_temp if batch.first_crack else None,
                "fc_start_time": batch.first_crack.start_time_seconds if batch.first_crack else None,
            })

        return summary
