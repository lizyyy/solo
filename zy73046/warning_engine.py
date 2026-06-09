import json
import math
import statistics
import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from models import get_conn


class StepLogger:
    def __init__(self):
        self.logs: List[Dict] = []

    def log(self, step_name: str, detail: Dict[str, Any]):
        self.logs.append({
            "step": step_name,
            "time": datetime.now().isoformat(),
            "detail": detail
        })

    def to_json(self) -> str:
        return json.dumps(self.logs, ensure_ascii=False, indent=2)

    def summary_text(self) -> str:
        lines = []
        for i, log in enumerate(self.logs, 1):
            d = log["detail"]
            brief = ", ".join(f"{k}={v}" for k, v in list(d.items())[:4])
            lines.append(f"[{i}] {log['step']}: {brief}")
        return "\n".join(lines)


def robust_stats(values: List[float]) -> Dict[str, float]:
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    median = statistics.median(sorted_vals)

    def _quantile(data, p):
        if not data:
            return 0.0
        k = (len(data) - 1) * p
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return data[int(k)]
        return data[f] + (data[c] - data[f]) * (k - f)

    q1 = _quantile(sorted_vals, 0.25)
    q3 = _quantile(sorted_vals, 0.75)
    iqr = q3 - q1
    mean = statistics.mean(sorted_vals) if n > 0 else 0.0
    stdev = statistics.stdev(sorted_vals) if n > 1 else 0.0

    return {
        "count": n,
        "median": round(median, 4),
        "mean": round(mean, 4),
        "q1": round(q1, 4),
        "q3": round(q3, 4),
        "iqr": round(iqr, 4),
        "stdev": round(stdev, 4)
    }


def get_active_config(config_id: Optional[int] = None) -> Dict[str, Any]:
    conn = get_conn()
    c = conn.cursor()
    if config_id:
        c.execute("SELECT * FROM threshold_config WHERE id=?", (config_id,))
    else:
        c.execute("SELECT * FROM threshold_config WHERE is_active=1 ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    if not row:
        raise RuntimeError("未找到可用的阈值配置")
    return dict(row)


def compare_params(old: Dict, new: Dict) -> List[Dict]:
    diffs = []
    all_keys = set(old.keys()) | set(new.keys())
    for k in sorted(all_keys):
        ov = old.get(k)
        nv = new.get(k)
        if ov != nv:
            diffs.append({"param": k, "old": ov, "new": nv})
    return diffs


def group_parts(parts: List[Dict], group_by: str) -> Dict[str, List[Dict]]:
    groups: Dict[str, List[Dict]] = {}
    for p in parts:
        key = p.get(group_by) or "未分组"
        groups.setdefault(key, []).append(p)
    return groups


def detect_anomalies_for_group(
    group_key: str,
    group_parts_list: List[Dict],
    params: Dict,
    logger: StepLogger
) -> List[Dict]:
    warnings = []
    values = [p["measured_value"] for p in group_parts_list if p.get("measured_value") is not None]
    if not values:
        logger.log(f"组[{group_key}]跳过", {"reason": "无有效测量值", "count": len(group_parts_list)})
        return warnings

    stats = robust_stats(values)
    logger.log(f"组[{group_key}]统计", stats)

    use_robust = params.get("use_robust_stat", 1)
    iqr_mult = params.get("iqr_multiplier", 1.5)
    z_thresh = params.get("zscore_threshold", 2.5)
    dev_up = params.get("deviation_upper_pct", 20.0)
    dev_low = params.get("deviation_lower_pct", 20.0)
    min_n = params.get("min_sample_size", 5)

    center = stats["median"] if use_robust else stats["mean"]
    if use_robust:
        bound_upper = stats["q3"] + iqr_mult * stats["iqr"]
        bound_lower = stats["q1"] - iqr_mult * stats["iqr"]
        logger.log(f"组[{group_key}]稳健边界", {
            "中心(中位数)": center,
            "上限": round(bound_upper, 4),
            "下限": round(bound_lower, 4),
            "方法": f"Q3+{iqr_mult}*IQR / Q1-{iqr_mult}*IQR"
        })
    else:
        bound_upper = center * (1 + dev_up / 100)
        bound_lower = center * (1 - dev_low / 100)
        logger.log(f"组[{group_key}]均值边界", {
            "中心(均值)": center,
            "上限%": dev_up,
            "下限%": dev_low,
            "上限值": round(bound_upper, 4),
            "下限值": round(bound_lower, 4)
        })

    for part in group_parts_list:
        val = part.get("measured_value")
        if val is None:
            warnings.append({
                "spare_part_id": part["id"],
                "level": "一般",
                "anomaly_type": "数据缺失",
                "detected_value": None,
                "threshold_value": 0,
                "deviation": None,
                "step_detected": "数据完整性检查",
                "step_detail": {"note": "缺少测量值，需后补"},
                "priority": "中"
            })
            continue

        pct_dev = ((val - center) / center * 100) if center != 0 else 0.0

        if stats["count"] < min_n:
            abs_thr = params.get("single_value_abs_threshold")
            if abs_thr is not None and val > abs_thr:
                warnings.append({
                    "spare_part_id": part["id"],
                    "level": "严重",
                    "anomaly_type": "绝对值超限(样本不足)",
                    "detected_value": val,
                    "threshold_value": abs_thr,
                    "deviation": round(val - abs_thr, 4),
                    "step_detected": f"绝对值校验(样本n={stats['count']}<{min_n})",
                    "step_detail": {"abs_threshold": abs_thr, "sample_count": stats["count"]},
                    "priority": "高"
                })
            continue

        if val > bound_upper:
            level = "严重" if val > bound_upper * 1.2 else "警告"
            priority = "高" if level == "严重" else "中"
            step_name = "稳健上界(IQR)超限" if use_robust else "上界(均值百分比)超限"
            warnings.append({
                "spare_part_id": part["id"],
                "level": level,
                "anomaly_type": "测量值偏高",
                "detected_value": val,
                "threshold_value": round(bound_upper, 4),
                "deviation": round(pct_dev, 2),
                "step_detected": step_name,
                "step_detail": {
                    "bound_type": "upper",
                    "stats_center": center,
                    "stats_method": "robust_median_iqr" if use_robust else "mean_pct",
                    "pct_deviation": round(pct_dev, 2),
                    "raw_deviation": round(val - bound_upper, 4)
                },
                "priority": priority
            })
            continue

        if val < bound_lower:
            level = "严重" if val < bound_lower * 0.8 else "警告"
            priority = "高" if level == "严重" else "中"
            step_name = "稳健下界(IQR)超限" if use_robust else "下界(均值百分比)超限"
            warnings.append({
                "spare_part_id": part["id"],
                "level": level,
                "anomaly_type": "测量值偏低",
                "detected_value": val,
                "threshold_value": round(bound_lower, 4),
                "deviation": round(pct_dev, 2),
                "step_detected": step_name,
                "step_detail": {
                    "bound_type": "lower",
                    "stats_center": center,
                    "stats_method": "robust_median_iqr" if use_robust else "mean_pct",
                    "pct_deviation": round(pct_dev, 2),
                    "raw_deviation": round(val - bound_lower, 4)
                },
                "priority": priority
            })
            continue

        if stats["stdev"] > 0:
            z = (val - stats["mean"]) / stats["stdev"]
            if abs(z) > z_thresh:
                warnings.append({
                    "spare_part_id": part["id"],
                    "level": "警告",
                    "anomaly_type": f"Z分数异常(|Z|>{z_thresh})",
                    "detected_value": val,
                    "threshold_value": round(z_thresh, 2),
                    "deviation": round(z, 3),
                    "step_detected": "Z-score二次校验",
                    "step_detail": {
                        "z_score": round(z, 3),
                        "mean": stats["mean"],
                        "stdev": stats["stdev"],
                        "note": "通过稳健边界但Z分数仍偏离，需人工复核"
                    },
                    "priority": "中"
                })

    return warnings


def run_warning_pipeline(import_batch_id: str, config_id: Optional[int] = None,
                         operator: str = "算法值班人") -> Dict[str, Any]:
    logger = StepLogger()
    conn = get_conn()
    c = conn.cursor()

    try:
        config_row = get_active_config(config_id)
        params = json.loads(config_row["params_json"])
        run_no = f"WRN-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"

        logger.log("启动预警", {
            "run_no": run_no,
            "config_id": config_row["id"],
            "config_name": config_row["config_name"],
            "operator": operator,
            "import_batch_id": import_batch_id
        })

        prev_run = conn.execute("""
            SELECT wr.*, tc.params_json as prev_params
            FROM warning_run wr
            JOIN threshold_config tc ON wr.config_id = tc.id
            WHERE wr.import_batch_id = ? AND wr.status = '完成'
            ORDER BY wr.id DESC LIMIT 1
        """, (import_batch_id,)).fetchone()

        if prev_run:
            prev_params = json.loads(prev_run["prev_params"])
            diffs = compare_params(prev_params, params)
            if diffs:
                logger.log("参数变更检测", {
                    "对比批次": prev_run["run_no"],
                    "变更项数": len(diffs),
                    "变更明细": diffs
                })
            else:
                logger.log("参数一致性", {"结果": "与上次运行参数完全一致"})
        else:
            logger.log("历史对比", {"结果": "该导入批次无历史预警记录，为首次运行"})

        c.execute("""
            SELECT id, batch_no, material_code, material_name, spec_model,
                   measured_value, unit, supplier, raw_remark, manual_remark, is_complete
            FROM spare_parts WHERE import_batch_id = ?
        """, (import_batch_id,))
        parts = [dict(r) for r in c.fetchall()]

        if not parts:
            raise RuntimeError(f"导入批次[{import_batch_id}]无备件数据")

        logger.log("数据装载", {
            "总条数": len(parts),
            "齐整条数": sum(1 for p in parts if p["is_complete"]),
            "不齐整条数": sum(1 for p in parts if not p["is_complete"])
        })

        c.execute("""
            INSERT INTO warning_run (run_no, config_id, import_batch_id, started_at, status, params_snapshot_json)
            VALUES (?, ?, ?, ?, '运行中', ?)
        """, (
            run_no, config_row["id"], import_batch_id,
            datetime.now().isoformat(),
            json.dumps(params, ensure_ascii=False)
        ))
        run_id = c.lastrowid
        conn.commit()

        group_by = params.get("group_by", "spec_model")
        groups = group_parts(parts, group_by)
        logger.log("分组", {"分组字段": group_by, "组数": len(groups), "分组明细": list(groups.keys())})

        all_warnings: List[Dict] = []
        for gk, gps in groups.items():
            group_warns = detect_anomalies_for_group(gk, gps, params, logger)
            all_warnings.extend(group_warns)

        logger.log("异常汇总", {
            "严重": sum(1 for w in all_warnings if w["level"] == "严重"),
            "警告": sum(1 for w in all_warnings if w["level"] == "警告"),
            "一般": sum(1 for w in all_warnings if w["level"] == "一般"),
            "合计": len(all_warnings)
        })

        inserted_count = 0
        for w in all_warnings:
            c.execute("""
                INSERT INTO warning_record (
                    run_id, spare_part_id, level, anomaly_type, detected_value,
                    threshold_value, deviation, step_detected, step_detail_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                run_id, w["spare_part_id"], w["level"], w["anomaly_type"],
                w["detected_value"], w["threshold_value"], w["deviation"],
                w["step_detected"], json.dumps(w["step_detail"], ensure_ascii=False)
            ))
            wr_id = c.lastrowid
            c.execute("""
                INSERT INTO anomaly_queue (warning_record_id, queue_status, priority, created_at)
                VALUES (?, '待分派', ?, ?)
            """, (wr_id, w["priority"], datetime.now().isoformat()))
            inserted_count += 1

        c.execute("""
            UPDATE warning_run
            SET finished_at = ?, status = '完成', step_logs_json = ?
            WHERE id = ?
        """, (datetime.now().isoformat(), logger.to_json(), run_id))
        conn.commit()

        logger.log("入库完成", {"预警记录": inserted_count, "异常队列条目": inserted_count})

        return {
            "success": True,
            "run_id": run_id,
            "run_no": run_no,
            "config_name": config_row["config_name"],
            "config_id": config_row["id"],
            "total_parts": len(parts),
            "warning_count": len(all_warnings),
            "by_level": {
                "严重": sum(1 for w in all_warnings if w["level"] == "严重"),
                "警告": sum(1 for w in all_warnings if w["level"] == "警告"),
                "一般": sum(1 for w in all_warnings if w["level"] == "一般"),
            },
            "step_logs": logger.logs,
            "step_summary": logger.summary_text()
        }
    except Exception as e:
        conn.rollback()
        logger.log("运行异常", {"error": str(e)})
        return {"success": False, "error": str(e), "step_logs": logger.logs}
    finally:
        conn.close()
