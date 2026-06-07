import time
import uuid
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from scipy.interpolate import griddata, interp2d
from scipy import stats

from .models import (
    VolatilitySurface,
    VolatilityPoint,
    CleanResult,
    ConflictRecord,
    ParameterVersion,
    AuditLog,
    RecordStatus
)
from .params import ParameterManager
from .audit import AuditTrail


class VolatilitySurfaceCleaner:
    def __init__(self, param_manager: ParameterManager, audit_trail: AuditTrail):
        self.param_manager = param_manager
        self.audit_trail = audit_trail

    def clean(self, surface: VolatilitySurface,
              summary_page_data: Optional[Dict[str, float]] = None) -> CleanResult:
        start_time = time.time()
        surface_id = surface.surface_id

        self.audit_trail.log(
            action="开始清洗",
            surface_id=surface_id,
            reason=f"开始处理曲面 {surface.underlying} @ {surface.trade_date}",
            parameters_used=self.param_manager.get_all_params()
        )

        original_count = len(surface.points)
        audit_logs: List[AuditLog] = []
        conflicts: List[ConflictRecord] = []

        step1_result = self._step1_basic_validation(surface)
        points, logs1 = step1_result
        audit_logs.extend(logs1)

        step2_result = self._step2_outlier_detection(points, surface_id)
        points, logs2, outliers_removed = step2_result
        audit_logs.extend(logs2)

        step3_result = self._step3_arbitrage_check(points, surface_id)
        points, logs3 = step3_result
        audit_logs.extend(logs3)

        if summary_page_data:
            step4_result = self._step4_conflict_detection(
                points, surface_id, summary_page_data
            )
            points, logs4, new_conflicts = step4_result
            audit_logs.extend(logs4)
            conflicts.extend(new_conflicts)

        step5_result = self._step5_interpolation(points, surface)
        points, logs5, interpolated = step5_result
        audit_logs.extend(logs5)

        points, logs6 = self._step6_confidence_scoring(points)
        audit_logs.extend(logs6)

        surface.points = points
        surface.updated_at = datetime.now()

        if conflicts:
            surface.status = RecordStatus.CONFLICT
            surface.comments += f"发现 {len(conflicts)} 个冲突待处理；"
        elif any(p.review_comment for p in points):
            surface.status = RecordStatus.PENDING_REVIEW
        else:
            surface.status = RecordStatus.SUCCESS

        status_summary = self._build_status_summary(points, conflicts)

        param_versions = self.param_manager.get_all_param_versions()
        self.param_manager.mark_used_by_surface(surface_id)

        processing_time = time.time() - start_time
        self.audit_trail.log(
            action="清洗完成",
            surface_id=surface_id,
            reason=f"处理完成，耗时 {processing_time:.2f}s",
            parameters_used={"processing_time": processing_time}
        )

        final_outlier_count = len([p for p in points if p.is_outlier])
        result = CleanResult(
            surface=surface,
            original_points=original_count,
            cleaned_points=len([p for p in points if not p.is_outlier]),
            outliers_removed=final_outlier_count,
            interpolated_points=interpolated,
            conflicts_found=conflicts,
            parameter_versions_used=param_versions,
            audit_trail=audit_logs,
            processing_time=processing_time,
            status_summary=status_summary
        )

        return result

    def _step1_basic_validation(self, surface: VolatilitySurface) -> Tuple[List[VolatilityPoint], List[AuditLog]]:
        logs: List[AuditLog] = []
        vol_min = self.param_manager.get_param("vol_min_valid")
        vol_max = self.param_manager.get_param("vol_max_valid")
        source_weights = self.param_manager.get_param("confidence_weight_source")

        for point in surface.points:
            point.raw_value = point.implied_vol

            if point.data_source_id in source_weights:
                point.confidence = source_weights[point.data_source_id]

            if point.implied_vol < vol_min or point.implied_vol > vol_max:
                point.is_outlier = True
                point.outlier_reason = f"波动率超出有效范围 [{vol_min}, {vol_max}]"
                point.confidence = 0.1
                log = self.audit_trail.log(
                    action="范围校验标记",
                    surface_id=surface.surface_id,
                    point_id=point.point_id,
                    old_value=point.raw_value,
                    new_value=None,
                    reason=point.outlier_reason,
                    parameters_used={"vol_min": vol_min, "vol_max": vol_max}
                )
                logs.append(log)

        return surface.points, logs

    def _step2_outlier_detection(self, points: List[VolatilityPoint], surface_id: str) -> Tuple[List[VolatilityPoint], List[AuditLog], int]:
        logs: List[AuditLog] = []
        outliers_removed = 0
        zscore_threshold = self.param_manager.get_param("outlier_zscore_threshold")
        iqr_factor = self.param_manager.get_param("outlier_iqr_factor")

        tenors = {}
        for p in points:
            if p.tenor not in tenors:
                tenors[p.tenor] = []
            tenors[p.tenor].append(p)

        for tenor, tenor_points in tenors.items():
            if len(tenor_points) < 4:
                continue

            vols = np.array([p.implied_vol for p in tenor_points if not p.is_outlier])
            if len(vols) < 4:
                continue

            z_scores = np.abs(stats.zscore(vols))
            q1 = np.percentile(vols, 25)
            q3 = np.percentile(vols, 75)
            iqr = q3 - q1
            lower_bound = q1 - iqr_factor * iqr
            upper_bound = q3 + iqr_factor * iqr

            for i, p in enumerate(tenor_points):
                if p.is_outlier:
                    continue
                if i >= len(z_scores):
                    continue
                if z_scores[i] > zscore_threshold:
                    p.is_outlier = True
                    p.outlier_reason = f"Z-score={z_scores[i]:.2f} > 阈值={zscore_threshold}"
                    outliers_removed += 1
                    log = self.audit_trail.log(
                        action="Z-score异常检测",
                        surface_id=surface_id,
                        point_id=p.point_id,
                        old_value=p.implied_vol,
                        new_value=None,
                        reason=p.outlier_reason,
                        parameters_used={"zscore_threshold": zscore_threshold, "zscore": float(z_scores[i])}
                    )
                    logs.append(log)
                elif p.implied_vol < lower_bound or p.implied_vol > upper_bound:
                    p.is_outlier = True
                    p.outlier_reason = f"IQR范围检测: 值={p.implied_vol:.4f} 超出 [{lower_bound:.4f}, {upper_bound:.4f}]"
                    outliers_removed += 1
                    log = self.audit_trail.log(
                        action="IQR异常检测",
                        surface_id=surface_id,
                        point_id=p.point_id,
                        old_value=p.implied_vol,
                        new_value=None,
                        reason=p.outlier_reason,
                        parameters_used={"iqr_factor": iqr_factor, "lower": lower_bound, "upper": upper_bound}
                    )
                    logs.append(log)

        return points, logs, outliers_removed

    def _step3_arbitrage_check(self, points: List[VolatilityPoint], surface_id: str) -> Tuple[List[VolatilityPoint], List[AuditLog]]:
        logs: List[AuditLog] = []
        max_spread = self.param_manager.get_param("arbitrage_max_spread")

        valid_points = [p for p in points if not p.is_outlier]
        if len(valid_points) < 2:
            return points, logs

        by_strike = {}
        for p in valid_points:
            key = (round(p.strike, 4), round(p.maturity, 4))
            if key not in by_strike:
                by_strike[key] = []
            by_strike[key].append(p)

        for key, group in by_strike.items():
            if len(group) >= 2:
                call_vols = [p.implied_vol for p in group if p.option_type == "call"]
                put_vols = [p.implied_vol for p in group if p.option_type == "put"]
                if call_vols and put_vols:
                    spread = abs(np.mean(call_vols) - np.mean(put_vols))
                    if spread > max_spread:
                        for p in group:
                            p.review_comment = f"看涨看跌价差过大: {spread:.4f} > {max_spread}"
                            p.tags.append("arbitrage_flag")
                            log = self.audit_trail.log(
                                action="套利检查",
                                surface_id=surface_id,
                                point_id=p.point_id,
                                old_value=p.implied_vol,
                                new_value=None,
                                reason=p.review_comment,
                                parameters_used={"max_spread": max_spread, "actual_spread": spread}
                            )
                            logs.append(log)

        return points, logs

    def _step4_conflict_detection(self, points: List[VolatilityPoint], surface_id: str,
                                   summary_page_data: Dict[str, float]) -> Tuple[List[VolatilityPoint], List[AuditLog], List[ConflictRecord]]:
        logs: List[AuditLog] = []
        conflicts: List[ConflictRecord] = []
        tolerance = self.param_manager.get_param("conflict_tolerance_pct")

        for p in points:
            if p.is_outlier:
                continue
            key = f"{p.tenor}_{p.strike:.4f}"
            if key in summary_page_data:
                summary_val = summary_page_data[key]
                pct_diff = abs((p.implied_vol - summary_val) / summary_val * 100)
                if pct_diff > tolerance:
                    conflict = ConflictRecord(
                        conflict_id=str(uuid.uuid4())[:8],
                        surface_id=surface_id,
                        point_id=p.point_id,
                        summary_page_value=summary_val,
                        imported_value=p.implied_vol,
                        summary_page_source="老板看的汇总页",
                        imported_source=p.data_source_id,
                        difference=pct_diff,
                        suggested_action=f"差异{pct_diff:.1f}%，建议核对原始数据后确认"
                    )
                    conflicts.append(conflict)
                    p.tags.append("conflict_flag")
                    p.review_comment = f"与汇总页冲突: 导入={p.implied_vol:.4f}, 汇总={summary_val:.4f}, 差异={pct_diff:.1f}%"

                    log = self.audit_trail.log(
                        action="冲突检测",
                        surface_id=surface_id,
                        point_id=p.point_id,
                        old_value=p.implied_vol,
                        new_value=summary_val,
                        reason=f"与汇总页差异{pct_diff:.1f}%",
                        parameters_used={
                            "tolerance_pct": tolerance,
                            "summary_value": summary_val,
                            "difference_pct": pct_diff
                        }
                    )
                    logs.append(log)

        return points, logs, conflicts

    def _step5_interpolation(self, points: List[VolatilityPoint], surface: VolatilitySurface) -> Tuple[List[VolatilityPoint], List[AuditLog], int]:
        logs: List[AuditLog] = []
        interpolated_count = 0
        method = self.param_manager.get_param("interpolation_method")

        valid_points = [p for p in points if not p.is_outlier]
        if len(valid_points) < 6:
            return points, logs, interpolated_count

        strikes = np.array([p.strike for p in valid_points])
        maturities = np.array([p.maturity for p in valid_points])
        vols = np.array([p.implied_vol for p in valid_points])

        outlier_points = [p for p in points if p.is_outlier and "interpolate" in p.tags]

        for p in outlier_points:
            try:
                xi = np.array([[p.strike, p.maturity]])
                grid = np.column_stack((strikes, maturities))
                interp_val = griddata(grid, vols, xi, method=method.split("_")[0] if "_" in method else method)

                if not np.isnan(interp_val[0]):
                    old_val = p.implied_vol
                    p.implied_vol = float(interp_val[0])
                    p.is_interpolated = True
                    p.is_outlier = False
                    p.interpolated_from = [vp.point_id for vp in valid_points[:3]]
                    p.outlier_reason += f" | 已插值补全"
                    interpolated_count += 1

                    log = self.audit_trail.log(
                        action="插值补全",
                        surface_id=surface.surface_id,
                        point_id=p.point_id,
                        old_value=old_val,
                        new_value=p.implied_vol,
                        reason=f"使用{method}方法插值",
                        parameters_used={"method": method, "neighbors_count": 3}
                    )
                    logs.append(log)
            except Exception as e:
                p.review_comment = f"插值失败: {str(e)}"

        if len(valid_points) >= 10:
            required_tenors = self.param_manager.get_param("tenor_order")
            existing_tenors = surface.get_tenors()
            missing_tenors = [t for t in required_tenors if t not in existing_tenors]

            if missing_tenors:
                avg_maturity_by_tenor = {
                    "1M": 1/12, "3M": 3/12, "6M": 6/12,
                    "1Y": 1.0, "2Y": 2.0, "3Y": 3.0, "5Y": 5.0, "10Y": 10.0
                }
                for tenor in missing_tenors[:2]:
                    maturity = avg_maturity_by_tenor.get(tenor, 1.0)
                    for strike in np.percentile(strikes, [30, 50, 70]):
                        try:
                            xi = np.array([[strike, maturity]])
                            grid = np.column_stack((strikes, maturities))
                            interp_val = griddata(grid, vols, xi, method="linear")
                            if not np.isnan(interp_val[0]):
                                new_point = VolatilityPoint(
                                    strike=float(strike),
                                    maturity=maturity,
                                    implied_vol=float(interp_val[0]),
                                    tenor=tenor,
                                    option_type="call",
                                    is_interpolated=True,
                                    interpolated_from=[vp.point_id for vp in valid_points[:3]],
                                    confidence=0.7,
                                    tags=["synthetic_point", "interpolated"],
                                    data_source_id="interpolation_engine",
                                    review_comment=f"自动补充缺失的{tenor}期限点"
                                )
                                points.append(new_point)
                                interpolated_count += 1

                                log = self.audit_trail.log(
                                    action="补充期限点",
                                    surface_id=surface.surface_id,
                                    point_id=new_point.point_id,
                                    old_value=None,
                                    new_value=new_point.implied_vol,
                                    reason=f"补充缺失期限 {tenor}",
                                    parameters_used={"method": "linear", "tenor": tenor}
                                )
                                logs.append(log)
                        except Exception as e:
                            pass

        return points, logs, interpolated_count

    def _step6_confidence_scoring(self, points: List[VolatilityPoint]) -> Tuple[List[VolatilityPoint], List[AuditLog]]:
        logs: List[AuditLog] = []
        source_weights = self.param_manager.get_param("confidence_weight_source")

        for p in points:
            if p.is_outlier:
                p.confidence = max(0.1, p.confidence * 0.3)
            elif p.is_interpolated:
                p.confidence = max(0.5, p.confidence * 0.8)
            elif p.data_source_id in source_weights:
                p.confidence = min(1.0, p.confidence * source_weights[p.data_source_id])

            if "conflict_flag" in p.tags:
                p.confidence *= 0.7
            if "arbitrage_flag" in p.tags:
                p.confidence *= 0.8

            p.confidence = round(max(0.0, min(1.0, p.confidence)), 3)

        return points, logs

    def _build_status_summary(self, points: List[VolatilityPoint],
                               conflicts: List[ConflictRecord]) -> Dict[str, int]:
        summary = {
            "total_points": len(points),
            "valid_points": len([p for p in points if not p.is_outlier]),
            "outlier_points": len([p for p in points if p.is_outlier]),
            "interpolated_points": len([p for p in points if p.is_interpolated]),
            "high_confidence": len([p for p in points if p.confidence >= 0.8]),
            "medium_confidence": len([p for p in points if 0.5 <= p.confidence < 0.8]),
            "low_confidence": len([p for p in points if p.confidence < 0.5]),
            "needs_review": len([p for p in points if p.review_comment and not p.is_outlier]),
            "conflicts": len(conflicts),
            "pending_conflicts": len([c for c in conflicts if not c.resolved]),
            "legacy_points": len([p for p in points if "legacy" in p.tags])
        }
        return summary

    def get_processing_evidence(self, point: VolatilityPoint) -> Dict[str, Any]:
        logs = self.audit_trail.get_logs_for_point(point.point_id)
        return {
            "point": point.to_dict(),
            "processing_logs": [log.to_dict() for log in logs],
            "parameters_used": [
                pv.to_dict() for pv in self.param_manager.get_all_param_versions()
            ],
            "decision_path": self._build_decision_path(point, logs)
        }

    def _build_decision_path(self, point: VolatilityPoint, logs: List[AuditLog]) -> List[str]:
        if point.raw_value is not None:
            path = [f"1. 原始值导入: {point.raw_value:.4f} (来源: {point.data_source_id})"]
        else:
            path = [f"1. 数据来源: {point.data_source_id} (无原始值记录)"]
        step = 2
        for log in sorted(logs, key=lambda x: x.timestamp):
            if log.old_value is not None and log.new_value is not None:
                path.append(f"{step}. {log.action}: {log.old_value:.4f} → {log.new_value:.4f} ({log.reason})")
            elif log.old_value is not None:
                path.append(f"{step}. {log.action}: 检查值 {log.old_value:.4f} - {log.reason}")
            else:
                path.append(f"{step}. {log.action}: {log.reason}")
            step += 1
        path.append(f"{step}. 最终值: {point.implied_vol:.4f} (置信度: {point.confidence:.3f})")
        return path
