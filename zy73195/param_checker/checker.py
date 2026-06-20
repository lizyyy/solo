import csv
import os
from difflib import SequenceMatcher
from typing import List, Tuple, Optional

from .models import ParamItem, TestRecord, CheckResult, CheckSummary


SORT_UNSTABLE_KEYWORDS = ["排序不稳定", "排序参考", "按.*排序", "详见参数表"]
PENDING_NAME_SIMILARITY_THRESHOLD = 0.45


def _is_name_approx_match(record_name: str, param_name: str, score: float) -> bool:
    if record_name == param_name:
        return False
    if score >= PENDING_NAME_SIMILARITY_THRESHOLD:
        return True
    if record_name and param_name:
        if record_name in param_name or param_name in record_name:
            return True
    return False


def load_params(csv_path: str) -> List[ParamItem]:
    params = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                std_val = float(row["standard_value"])
                tol = float(row["tolerance"])
            except (ValueError, KeyError):
                continue
            params.append(ParamItem(
                material_name=row.get("material_name", "").strip(),
                param_name=row.get("param_name", "").strip(),
                standard_value=std_val,
                tolerance=tol,
                unit=row.get("unit", "").strip(),
                version=row.get("version", "v1").strip(),
                remark=row.get("remark", "").strip(),
            ))
    return params


def load_records(csv_path: str) -> List[TestRecord]:
    records = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                val = float(row["measured_value"])
            except (ValueError, KeyError):
                continue
            records.append(TestRecord(
                material_name=row.get("material_name", "").strip(),
                param_name=row.get("param_name", "").strip(),
                measured_value=val,
                batch_no=row.get("batch_no", "").strip(),
                test_date=row.get("test_date", "").strip(),
                operator=row.get("operator", "").strip(),
                remark=row.get("remark", "").strip(),
            ))
    return records


def name_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def find_matching_param(record: TestRecord, params: List[ParamItem]) -> Tuple[Optional[ParamItem], float]:
    best_match = None
    best_score = 0.0
    for p in params:
        if p.param_name != record.param_name:
            continue
        score = name_similarity(record.material_name, p.material_name)
        if score > best_score:
            best_score = score
            best_match = p
    return best_match, best_score


def is_sort_unstable(param: ParamItem) -> Tuple[bool, str]:
    remark = param.remark
    for kw in SORT_UNSTABLE_KEYWORDS:
        if kw in remark:
            return True, remark
    return False, ""


def check_record(record: TestRecord, params: List[ParamItem]) -> CheckResult:
    param, score = find_matching_param(record, params)

    if param is None:
        return CheckResult(
            record=record,
            param=None,
            is_pass=False,
            is_pending=True,
            pending_reason="未找到匹配参数项",
            is_abnormal=True,
            abnormal_reason="参数缺失",
        )

    is_pending = _is_name_approx_match(record.material_name, param.material_name, score)
    pending_reason = ""
    if is_pending:
        if param.material_name in record.material_name:
            pending_reason = f"材料名称写法不一致：记录「{record.material_name}」包含参数表「{param.material_name}」(相似度{score:.0%})"
        elif record.material_name in param.material_name:
            pending_reason = f"材料名称写法不一致：参数表「{param.material_name}」包含记录「{record.material_name}」(相似度{score:.0%})"
        else:
            pending_reason = f"材料名称相似但写法不一致(相似度{score:.0%})：记录为「{record.material_name}」，参数表为「{param.material_name}」"

    deviation = record.measured_value - param.standard_value
    deviation_pct = (deviation / param.standard_value * 100) if param.standard_value != 0 else 0.0

    is_pass = param.is_within_range(record.measured_value)

    sort_unstable, sort_original_note = is_sort_unstable(param)

    is_abnormal = not is_pass and not is_pending
    abnormal_reason = ""
    if is_abnormal:
        if record.measured_value > param.upper_bound:
            abnormal_reason = f"超出上限 {record.measured_value - param.upper_bound:.3f}{param.unit}"
        elif record.measured_value < param.lower_bound:
            abnormal_reason = f"低于下限 {param.lower_bound - record.measured_value:.3f}{param.unit}"

    if not is_pass and is_pending:
        is_abnormal = True
        abnormal_reason = "待确认且数值超差，需人工复核"

    return CheckResult(
        record=record,
        param=param,
        is_pass=is_pass,
        is_pending=is_pending,
        pending_reason=pending_reason,
        is_abnormal=is_abnormal,
        abnormal_reason=abnormal_reason,
        sort_unstable=sort_unstable,
        sort_original_note=sort_original_note,
        deviation=deviation,
        deviation_pct=deviation_pct,
    )


def batch_check(records: List[TestRecord], params: List[ParamItem]) -> Tuple[List[CheckResult], CheckSummary]:
    results = [check_record(r, params) for r in records]
    summary = CheckSummary()
    summary.total = len(results)
    summary.param_version = params[0].version if params else "unknown"

    for r in results:
        if r.is_pending:
            summary.pending += 1
        if r.is_abnormal:
            summary.abnormal += 1
        if r.sort_unstable:
            summary.sort_unstable += 1
        if r.is_pass and not r.is_pending:
            summary.passed += 1
        elif not r.is_pass and not r.is_pending:
            summary.failed += 1

    return results, summary


def save_results_csv(results: List[CheckResult], csv_path: str) -> None:
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "批次号", "材料名称(记录)", "材料名称(参数表)", "参数名称",
            "实测值", "标准值", "允许偏差", "单位",
            "偏差值", "偏差%", "结果", "是否待确认", "待确认原因",
            "是否异常", "异常原因", "排序不稳定", "参数表原始备注",
            "试验日期", "操作员", "记录备注", "参数版本",
        ])
        for r in results:
            writer.writerow([
                r.record.batch_no,
                r.record.material_name,
                r.param.material_name if r.param else "",
                r.record.param_name,
                f"{r.record.measured_value:.3f}",
                f"{r.param.standard_value:.3f}" if r.param else "",
                f"±{r.param.tolerance:.3f}" if r.param else "",
                r.param.unit if r.param else "",
                f"{r.deviation:+.3f}",
                f"{r.deviation_pct:+.2f}%",
                "合格" if r.is_pass else "不合格",
                "是" if r.is_pending else "否",
                r.pending_reason,
                "是" if r.is_abnormal else "否",
                r.abnormal_reason,
                "是" if r.sort_unstable else "否",
                r.sort_original_note,
                r.record.test_date,
                r.record.operator,
                r.record.remark,
                r.param.version if r.param else "",
            ])
