from __future__ import annotations

import statistics
from typing import Any, Dict, List, Optional, Tuple

from .models import FirstCrackType, RoastBatch


class BatchComparator:
    """批次对比器"""

    def compare(self, batches: List[RoastBatch]) -> Dict[str, Any]:
        """对比多个批次"""
        if not batches:
            raise ValueError("至少需要一个批次进行对比")

        comparison = {
            "total_batches": len(batches),
            "batch_ids": [b.batch_id for b in batches],
            "summary": self._generate_summary(batches),
            "comparison_table": self._generate_comparison_table(batches),
            "anomalies": self._collect_anomalies(batches),
            "recommendations": self._generate_recommendations(batches),
        }

        return comparison

    def _generate_summary(self, batches: List[RoastBatch]) -> Dict[str, Any]:
        """生成摘要"""
        summary: Dict[str, Any] = {}

        total_times = [b.total_roast_time_seconds for b in batches if b.total_roast_time_seconds]
        if total_times:
            summary["avg_total_time"] = statistics.mean(total_times)
            summary["min_total_time"] = min(total_times)
            summary["max_total_time"] = max(total_times)

        drop_temps = [b.dropout_temp for b in batches if b.dropout_temp]
        if drop_temps:
            summary["avg_dropout_temp"] = statistics.mean(drop_temps)
            summary["min_dropout_temp"] = min(drop_temps)
            summary["max_dropout_temp"] = max(drop_temps)

        fc_start_temps = [
            b.first_crack.start_temp
            for b in batches
            if b.first_crack and b.first_crack.start_temp
        ]
        if fc_start_temps:
            summary["avg_fc_start_temp"] = statistics.mean(fc_start_temps)
            summary["min_fc_start_temp"] = min(fc_start_temps)
            summary["max_fc_start_temp"] = max(fc_start_temps)

        weight_losses = [
            b.weight_loss_percent for b in batches if b.weight_loss_percent
        ]
        if weight_losses:
            summary["avg_weight_loss"] = statistics.mean(weight_losses)
            summary["min_weight_loss"] = min(weight_losses)
            summary["max_weight_loss"] = max(weight_losses)

        cup_scores = [
            b.cup_score.total_score for b in batches if b.cup_score
        ]
        if cup_scores:
            summary["avg_cup_score"] = statistics.mean(cup_scores)
            summary["min_cup_score"] = min(cup_scores)
            summary["max_cup_score"] = max(cup_scores)
            summary["best_batch"] = max(
                batches, key=lambda b: b.cup_score.total_score if b.cup_score else 0
            ).batch_id
            summary["worst_batch"] = min(
                batches, key=lambda b: b.cup_score.total_score if b.cup_score else 100
            ).batch_id

        summary["with_first_crack"] = sum(1 for b in batches if b.first_crack)
        summary["with_cup_score"] = sum(1 for b in batches if b.cup_score)

        fc_types = [
            b.first_crack.crack_type.value
            for b in batches
            if b.first_crack
        ]
        if fc_types:
            summary["first_crack_distribution"] = {
                t: fc_types.count(t) for t in set(fc_types)
            }

        return summary

    def _generate_comparison_table(self, batches: List[RoastBatch]) -> List[Dict[str, Any]]:
        """生成对比表格"""
        table: List[Dict[str, Any]] = []

        for batch in batches:
            row: Dict[str, Any] = {
                "batch_id": batch.batch_id,
                "coffee_name": batch.coffee_name,
                "origin": batch.origin,
                "process_method": batch.process_method,
            }

            if batch.total_roast_time_seconds:
                minutes = int(batch.total_roast_time_seconds // 60)
                seconds = int(batch.total_roast_time_seconds % 60)
                row["total_time"] = f"{minutes}:{seconds:02d}"
                row["total_time_seconds"] = batch.total_roast_time_seconds
            else:
                row["total_time"] = None

            row["dropout_temp"] = batch.dropout_temp
            row["weight_loss_percent"] = batch.weight_loss_percent

            if batch.first_crack:
                fc = batch.first_crack
                fc_minutes = int(fc.start_time_seconds // 60)
                fc_seconds = int(fc.start_time_seconds % 60)
                row["fc_start_time"] = f"{fc_minutes}:{fc_seconds:02d}"
                row["fc_start_time_seconds"] = fc.start_time_seconds
                row["fc_start_temp"] = fc.start_temp
                row["fc_crack_type"] = fc.crack_type.value
                row["fc_duration"] = fc.duration_seconds
                row["fc_time_ratio"] = batch.get_first_crack_time_ratio()
            else:
                row["fc_start_time"] = None
                row["fc_start_temp"] = None
                row["fc_crack_type"] = "missing"

            if batch.cup_score:
                row["cup_score_total"] = batch.cup_score.total_score
                row["cup_score_quality"] = batch.cup_score.quality_level
                row["cup_score_aroma"] = batch.cup_score.aroma
                row["cup_score_flavor"] = batch.cup_score.flavor
                row["cup_score_aftertaste"] = batch.cup_score.aftertaste
                row["cup_score_acidity"] = batch.cup_score.acidity
                row["cup_score_body"] = batch.cup_score.body
                row["cup_score_balance"] = batch.cup_score.balance
            else:
                row["cup_score_total"] = None

            table.append(row)

        return table

    def _collect_anomalies(self, batches: List[RoastBatch]) -> List[Dict[str, Any]]:
        """收集所有异常"""
        anomalies: List[Dict[str, Any]] = []

        for batch in batches:
            if not batch.first_crack:
                anomalies.append({
                    "batch_id": batch.batch_id,
                    "type": "missing_first_crack",
                    "severity": "high",
                    "message": "批次缺少一爆标记，无法进行完整对比",
                })

            if batch.first_crack:
                fc = batch.first_crack
                if fc.crack_type == FirstCrackType.EARLY:
                    anomalies.append({
                        "batch_id": batch.batch_id,
                        "type": "early_first_crack",
                        "severity": "medium",
                        "message": f"一爆发生过早 (时间比例: {batch.get_first_crack_time_ratio():.1%})",
                    })
                elif fc.crack_type == FirstCrackType.LATE:
                    anomalies.append({
                        "batch_id": batch.batch_id,
                        "type": "late_first_crack",
                        "severity": "medium",
                        "message": f"一爆发生过晚 (时间比例: {batch.get_first_crack_time_ratio():.1%})",
                    })

            if not batch.cup_score:
                anomalies.append({
                    "batch_id": batch.batch_id,
                    "type": "missing_cup_score",
                    "severity": "medium",
                    "message": "批次缺少杯测分数",
                })

            if batch.dropout_temp:
                if batch.dropout_temp < 200:
                    anomalies.append({
                        "batch_id": batch.batch_id,
                        "type": "low_dropout_temp",
                        "severity": "low",
                        "message": f"出炉温度较低: {batch.dropout_temp}°C",
                    })
                elif batch.dropout_temp > 230:
                    anomalies.append({
                        "batch_id": batch.batch_id,
                        "type": "high_dropout_temp",
                        "severity": "low",
                        "message": f"出炉温度较高: {batch.dropout_temp}°C",
                    })

            if batch.weight_loss_percent:
                if batch.weight_loss_percent < 10:
                    anomalies.append({
                        "batch_id": batch.batch_id,
                        "type": "low_weight_loss",
                        "severity": "low",
                        "message": f"减重比例较低: {batch.weight_loss_percent}%",
                    })
                elif batch.weight_loss_percent > 18:
                    anomalies.append({
                        "batch_id": batch.batch_id,
                        "type": "high_weight_loss",
                        "severity": "low",
                        "message": f"减重比例较高: {batch.weight_loss_percent}%",
                    })

        return anomalies

    def _generate_recommendations(self, batches: List[RoastBatch]) -> List[str]:
        """生成建议"""
        recommendations: List[str] = []

        scored_batches = [b for b in batches if b.cup_score]

        if scored_batches:
            best_batch = max(
                scored_batches, key=lambda b: b.cup_score.total_score
            )
            recommendations.append(
                f"最高分批次: {best_batch.batch_id} "
                f"(杯测分数: {best_batch.cup_score.total_score:.1f})，"
                f"建议将其作为参考配方"
            )

            if best_batch.first_crack:
                recommendations.append(
                    f"参考批次一爆参数: 时间 {best_batch.first_crack.start_time_seconds/60:.1f}min, "
                    f"温度 {best_batch.first_crack.start_temp}°C"
                )

        fc_batches = [b for b in batches if b.first_crack]
        if fc_batches:
            fc_ratios = [b.get_first_crack_time_ratio() for b in fc_batches]
            if fc_ratios:
                min_ratio = min(fc_ratios)
                max_ratio = max(fc_ratios)
                if max_ratio - min_ratio > 0.15:
                    recommendations.append(
                        f"批次间一爆时间比例差异较大 ({min_ratio:.1%} - {max_ratio:.1%})，"
                        f"建议稳定一爆出现时机"
                    )

        drop_temps = [b.dropout_temp for b in batches if b.dropout_temp]
        if drop_temps:
            if max(drop_temps) - min(drop_temps) > 15:
                recommendations.append(
                    f"批次间出炉温度差异较大 ({min(drop_temps)} - {max(drop_temps)}°C)，"
                    f"建议统一出炉温度目标"
                )

        missing_fc = [b for b in batches if not b.first_crack]
        if missing_fc:
            recommendations.append(
                f"建议为以下批次添加一爆标记: {', '.join(b.batch_id for b in missing_fc)}"
            )

        missing_scores = [b for b in batches if not b.cup_score]
        if missing_scores:
            recommendations.append(
                f"建议为以下批次添加杯测分数: {', '.join(b.batch_id for b in missing_scores)}"
            )

        return recommendations
