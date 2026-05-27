from typing import List, Dict, Any, Tuple, Set
from app.services.idempotency import RULES

REQUIRED_FIELDS = ["agent_id", "call_id"]


def classify_records(
    quality_records: List[Dict[str, Any]],
    audio_summaries: Dict[str, Dict[str, Any]],
    appeal_records: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:

    appeal_map = {}
    appeal_matched_keys: Set[str] = set()
    for appeal in appeal_records:
        key = f"{appeal.get('agent_id', '')}|{appeal.get('call_id', '')}"
        appeal_map[key] = appeal

    normal = []
    pending = []
    failed = []

    for q_record in quality_records:
        key = f"{q_record.get('agent_id', '')}|{q_record.get('call_id', '')}"

        missing_fields = _check_required_fields(q_record)
        if missing_fields:
            failed.append(_build_failed_record(
                q_record,
                error_type="missing_fields",
                error_message=f"缺少必填字段: {', '.join(missing_fields)}",
                suggestion=f"请补充以下字段后重新提交: {', '.join(missing_fields)}"
            ))
            continue

        appeal = appeal_map.get(key)
        if appeal:
            appeal_matched_keys.add(key)

        audio = audio_summaries.get(q_record.get('call_id', ''))

        result = _apply_rules(q_record, appeal, audio)
        record_type = result.pop("_record_type")
        result.update(q_record)

        if appeal:
            result["appeal_reason"] = appeal.get("appeal_reason", "")
            result["score_after_appeal"] = appeal.get("score_after_appeal")

        if record_type == "normal":
            normal.append(result)
        elif record_type == "pending":
            pending.append(result)
        else:
            failed.append(result)

    for key, appeal in appeal_map.items():
        if key not in appeal_matched_keys:
            failed.append(_build_failed_record(
                appeal,
                error_type="appeal_unmatched",
                error_message=f"申诉单记录未找到匹配的质检记录 (坐席工号: {appeal.get('agent_id', '未知')}, 通话ID: {appeal.get('call_id', '未知')})",
                suggestion="请核实质检CSV中是否包含对应记录，或检查坐席工号/通话ID是否正确",
                source="appeal"
            ))

    return normal, pending, failed


def _check_required_fields(record: Dict[str, Any]) -> List[str]:
    missing = []
    for field in REQUIRED_FIELDS:
        value = record.get(field)
        if value is None or str(value).strip() == "":
            missing.append(field)
    return missing


def _build_failed_record(
    source_data: Dict[str, Any],
    error_type: str,
    error_message: str,
    suggestion: str,
    source: str = "quality"
) -> Dict[str, Any]:
    raw_data = source_data.get("_raw", str(source_data))
    return {
        "record_type": "failed",
        "error_type": error_type,
        "agent_id": source_data.get("agent_id", ""),
        "agent_name": source_data.get("agent_name", ""),
        "call_id": source_data.get("call_id", ""),
        "score_original": source_data.get("score_original"),
        "score_after_appeal": source_data.get("score_after_appeal"),
        "deduction_reason": source_data.get("deduction_reason", ""),
        "appeal_reason": source_data.get("appeal_reason", ""),
        "review_status": f"failed_{error_type}",
        "is_deduction_revoked": False,
        "needs_second_review": False,
        "suggestion": suggestion,
        "error_message": error_message,
        "raw_data": raw_data,
        "source": source
    }


def _apply_rules(
    quality: Dict[str, Any],
    appeal: Dict[str, Any],
    audio: Dict[str, Any]
) -> Dict[str, Any]:

    result = {
        "review_status": "normal",
        "is_deduction_revoked": False,
        "needs_second_review": False,
        "suggestion": "",
        "error_message": "",
        "raw_data": quality.get("_raw", ""),
    }

    if not appeal:
        result["_record_type"] = "normal"
        result["review_status"] = "no_appeal"
        result["suggestion"] = "无申诉，记录正常归档"
        return result

    score_original = _safe_float(quality.get("score_original"))
    score_appeal = _safe_float(appeal.get("score_after_appeal"))
    review_score = _safe_float(appeal.get("review_score"))
    review_result = str(appeal.get("review_result", "")).lower()
    review_opinion = str(appeal.get("reviewer_opinion", ""))

    deduction_points = _safe_float(quality.get("deduction_points"))

    if score_original is None and score_appeal is None:
        result["_record_type"] = "failed"
        result["review_status"] = "failed_missing_scores"
        result["error_message"] = "原始分数和申诉后分数均缺失，无法进行分数对比"
        result["suggestion"] = "请补充质检原始分数或申诉后期望分数后重新处理"
        return result

    should_revoke, revoke_reason = _check_revoke(quality, appeal, audio)
    if should_revoke:
        result["is_deduction_revoked"] = True
        result["suggestion"] = f"【扣分项撤销】{revoke_reason}"
        result["score_final"] = score_original + deduction_points if deduction_points else score_appeal
        result["_record_type"] = "normal"
        result["review_status"] = "revoked"
        return result

    if deduction_points is None and (score_original is not None and score_appeal is not None):
        deduction_points = score_original - score_appeal

    if deduction_points is not None and deduction_points >= 5:
        result["needs_second_review"] = True
        result["_record_type"] = "pending"
        result["review_status"] = "need_second_review"
        result["suggestion"] = f"【二次复核】扣分数值({deduction_points})≥5分或存在重大争议，需质检主管二次复核"
        return result

    if "重大" in review_opinion or "争议" in review_opinion:
        result["needs_second_review"] = True
        result["_record_type"] = "pending"
        result["review_status"] = "need_second_review"
        result["suggestion"] = "【二次复核】复核意见标注存在重大争议，需质检主管二次复核"
        return result

    if score_appeal is not None and review_score is not None and abs(score_appeal - review_score) >= 2:
        result["_record_type"] = "pending"
        result["review_status"] = "score_inconsistent"
        result["suggestion"] = f"【分数不一致】申诉后期望分数({score_appeal})与复核分数({review_score})差异≥2分，需确认"
        return result

    if review_result and ("驳回" in review_result or "拒绝" in review_result):
        result["_record_type"] = "normal"
        result["review_status"] = "appeal_rejected"
        result["suggestion"] = "申诉已驳回，成绩保持不变"
        result["score_final"] = score_original
        return result

    if review_result and ("通过" in review_result or "同意" in review_result):
        result["_record_type"] = "normal"
        result["review_status"] = "appeal_approved"
        result["suggestion"] = "【成绩回写】申诉通过，最终成绩已更新"
        result["score_final"] = score_appeal if score_appeal is not None else review_score
        return result

    if not review_result or review_result.strip() == "":
        result["_record_type"] = "pending"
        result["review_status"] = "review_pending"
        result["suggestion"] = "申诉处理状态不明确（无复核结论），需人工确认"
        return result

    result["_record_type"] = "failed"
    result["review_status"] = "failed_unknown_review_status"
    result["error_message"] = f"无法识别的复核结论: {review_result}"
    result["suggestion"] = "请检查复核结论字段值是否为以下之一: 通过/驳回/待确认"
    return result


def _check_revoke(
    quality: Dict[str, Any],
    appeal: Dict[str, Any],
    audio: Dict[str, Any]
) -> Tuple[bool, str]:

    if not audio:
        return False, ""

    deduction_reason = str(quality.get("deduction_reason", ""))
    appeal_reason = str(appeal.get("appeal_reason", ""))
    audio_summary = str(audio.get("summary", audio.get("content", "")))

    if not audio_summary or audio_summary.strip() == "":
        return False, ""

    if "未使用" in deduction_reason and "已使用" in appeal_reason and "使用" in audio_summary:
        return True, f"录音摘要显示【{audio_summary[:30]}...】，与申诉理由一致，原扣分『{deduction_reason[:20]}』不成立"

    if "未告知" in deduction_reason and "已告知" in appeal_reason and "告知" in audio_summary:
        return True, f"录音摘要显示已告知相关信息，与申诉吻合，撤销扣分项"

    if "态度" in deduction_reason and "态度良好" in appeal_reason and "礼貌" in audio_summary:
        return True, "录音显示服务态度礼貌，申诉有理，撤销态度相关扣分项"

    return False, ""


def _safe_float(value: Any) -> float:
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def get_rules_info() -> List[Dict[str, Any]]:
    return RULES
