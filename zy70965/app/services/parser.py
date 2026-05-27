import pandas as pd
import json
import math
from typing import List, Dict, Any, Optional
from io import BytesIO, StringIO


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def parse_quality_csv(content: bytes) -> List[Dict[str, Any]]:
    try:
        csv_content = content.decode('utf-8-sig')
        df = pd.read_csv(StringIO(csv_content))
        records = df.to_dict('records')
        return [_normalize_quality_record(r) for r in records]
    except Exception as e:
        raise ValueError(f"质检CSV解析失败: {str(e)}")


def parse_audio_json(content: bytes) -> Dict[str, Dict[str, Any]]:
    try:
        data = json.loads(content.decode('utf-8'))
        result = {}
        for item in data.get("summaries", data if isinstance(data, list) else [data]):
            call_id = str(item.get("call_id", item.get("record_id", "")))
            if call_id:
                result[call_id] = item
        return result
    except Exception as e:
        raise ValueError(f"录音摘要JSON解析失败: {str(e)}")


def parse_appeal_csv(content: bytes) -> List[Dict[str, Any]]:
    try:
        csv_content = content.decode('utf-8-sig')
        df = pd.read_csv(StringIO(csv_content))
        records = df.to_dict('records')
        return [_normalize_appeal_record(r) for r in records]
    except Exception as e:
        raise ValueError(f"申诉单CSV解析失败: {str(e)}")


def _normalize_quality_record(record: Dict[str, Any]) -> Dict[str, Any]:
    normalized = {}
    key_mapping = {
        'agent_id': ['坐席工号', '工号', 'agent_id', 'agentId'],
        'agent_name': ['坐席姓名', '姓名', 'agent_name', 'agentName'],
        'call_id': ['通话ID', '呼叫ID', 'call_id', 'callId'],
        'score_original': ['原始分数', '质检分数', 'score', '原始分', 'score_original'],
        'deduction_reason': ['扣分原因', '扣分项', 'deduction_reason', 'reason'],
        'deduction_points': ['扣分数', '扣分', 'deduction_points', 'points']
    }
    for target_key, possible_keys in key_mapping.items():
        for k in possible_keys:
            if k in record and not _is_empty(record[k]):
                normalized[target_key] = record[k]
                break
    normalized["_raw"] = json.dumps(record, ensure_ascii=False, default=str)
    return normalized


def _normalize_appeal_record(record: Dict[str, Any]) -> Dict[str, Any]:
    normalized = {}
    key_mapping = {
        'agent_id': ['坐席工号', '工号', 'agent_id', 'agentId'],
        'call_id': ['通话ID', '呼叫ID', 'call_id', 'callId'],
        'appeal_reason': ['申诉理由', '申诉内容', 'appeal_reason', 'reason'],
        'score_after_appeal': ['申诉后分数', '期望分数', 'score_after_appeal'],
        'reviewer_opinion': ['复核意见', '复核结果', 'reviewer_opinion'],
        'review_score': ['复核分数', 'review_score'],
        'review_result': ['复核结论', '处理结果', 'review_result']
    }
    for target_key, possible_keys in key_mapping.items():
        for k in possible_keys:
            if k in record and not _is_empty(record[k]):
                normalized[target_key] = record[k]
                break
    normalized["_raw"] = json.dumps(record, ensure_ascii=False, default=str)
    return normalized
