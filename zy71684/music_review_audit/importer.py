import csv
import json
import os
from typing import Optional

from .models import (
    AlgorithmTag,
    ImportResult,
    ManualCorrection,
    ReportRecord,
    ReviewRecord,
    SongInfo,
    SourceTrace,
)

FIELD_MAPS = {
    "reviews": {
        "required": ["review_id"],
        "aliases": {
            "review_id": ["review_id", "id", "reviewId", "review_id"],
            "text": ["text", "content", "review_text", "reviewText", "body"],
            "user_id": ["user_id", "userId", "uid", "author_id"],
            "song_id": ["song_id", "songId", "track_id", "music_id"],
            "created_at": ["created_at", "createdAt", "timestamp", "date", "time"],
        },
    },
    "tags": {
        "required": ["review_id", "tag"],
        "aliases": {
            "review_id": ["review_id", "id", "reviewId"],
            "tag": ["tag", "label", "emotion", "sentiment", "emotion_tag"],
            "confidence": ["confidence", "score", "prob", "probability"],
            "algorithm_version": ["algorithm_version", "algoVersion", "version", "algo_version", "model_version"],
            "tagged_at": ["tagged_at", "taggedAt", "timestamp", "created_at"],
        },
    },
    "corrections": {
        "required": ["review_id"],
        "aliases": {
            "review_id": ["review_id", "id", "reviewId"],
            "original_tag": ["original_tag", "originalTag", "old_tag", "before_tag"],
            "corrected_tag": ["corrected_tag", "correctedTag", "new_tag", "after_tag", "manual_tag"],
            "reviewer_id": ["reviewer_id", "reviewerId", "auditor_id", "operator_id"],
            "corrected_at": ["corrected_at", "correctedAt", "timestamp", "updated_at"],
            "note": ["note", "reason", "comment", "remark"],
        },
    },
    "songs": {
        "required": ["song_id"],
        "aliases": {
            "song_id": ["song_id", "id", "songId", "track_id"],
            "title": ["title", "name", "song_name", "songName"],
            "artist": ["artist", "singer", "performer"],
            "status": ["status", "song_status", "state"],
        },
    },
    "reports": {
        "required": ["report_id", "review_id"],
        "aliases": {
            "report_id": ["report_id", "id", "reportId", "complaint_id"],
            "review_id": ["review_id", "reviewId"],
            "reason": ["reason", "type", "report_reason", "report_type"],
            "status": ["status", "report_status", "state"],
            "reported_at": ["reported_at", "reportedAt", "timestamp", "created_at"],
        },
    },
}

CONSTRUCTORS = {
    "reviews": ReviewRecord,
    "tags": AlgorithmTag,
    "corrections": ManualCorrection,
    "songs": SongInfo,
    "reports": ReportRecord,
}


def _detect_encoding(file_path: str) -> str:
    for enc in ["utf-8", "utf-8-sig", "gbk", "gb2312", "gb18030", "latin-1"]:
        try:
            with open(file_path, "r", encoding=enc) as f:
                f.read(4096)
            return enc
        except (UnicodeDecodeError, UnicodeError):
            continue
    return "utf-8"


def _detect_delimiter(file_path: str, encoding: str) -> str:
    try:
        with open(file_path, "r", encoding=encoding) as f:
            sample = f.read(4096)
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(sample, delimiters=",\t;|")
        return dialect.delimiter
    except csv.Error:
        return ","


def _normalize_key(key: str) -> str:
    return key.strip().lower().replace(" ", "_").replace("-", "_")


def _resolve_field(available_keys: list, target_field: str, aliases: list) -> Optional[str]:
    normalized_aliases = [_normalize_key(a) for a in aliases]
    for k in available_keys:
        nk = _normalize_key(k)
        if nk in normalized_aliases:
            return k
    return None


def _build_field_mapping(headers: list, data_type: str) -> dict:
    config = FIELD_MAPS.get(data_type, {})
    aliases_map = config.get("aliases", {})
    mapping = {}
    for target_field, alias_list in aliases_map.items():
        resolved = _resolve_field(headers, target_field, alias_list)
        if resolved:
            mapping[target_field] = resolved
    return mapping


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def import_csv(file_path: str, data_type: str) -> ImportResult:
    result = ImportResult(data_type=data_type)
    constructor = CONSTRUCTORS.get(data_type)

    if not constructor:
        result.errors.append(f"未知数据类型: {data_type}")
        return result

    if not os.path.isfile(file_path):
        result.errors.append(f"文件不存在: {file_path}")
        return result

    encoding = _detect_encoding(file_path)
    delimiter = _detect_delimiter(file_path, encoding)

    try:
        with open(file_path, "r", encoding=encoding) as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            headers = reader.fieldnames or []
            field_mapping = _build_field_mapping(headers, data_type)

            required_fields = FIELD_MAPS.get(data_type, {}).get("required", [])
            missing_required = []
            for rf in required_fields:
                if rf not in field_mapping:
                    missing_required.append(rf)

            if missing_required:
                result.errors.append(
                    f"缺少必填字段映射: {missing_required}，可用表头: {headers}"
                )

            for row_num, raw_row in enumerate(reader, start=2):
                result.total_rows += 1
                try:
                    mapped = {}
                    for target_field, source_field in field_mapping.items():
                        val = raw_row.get(source_field, "").strip()
                        mapped[target_field] = val

                    for rf in required_fields:
                        if not mapped.get(rf):
                            raise ValueError(f"必填字段 {rf} 为空")

                    if data_type == "tags" and "confidence" in mapped:
                        mapped["confidence"] = _safe_float(mapped.get("confidence", 0), 0.0)

                    trace = SourceTrace(
                        file_path=file_path,
                        row_number=row_num,
                        raw_line=json.dumps(
                            {k: v[:80] for k, v in raw_row.items()}, ensure_ascii=False
                        ),
                    )
                    mapped["source"] = trace

                    record = constructor(**mapped)
                    result.records.append(record)
                    result.success_rows += 1
                except Exception as e:
                    result.skipped_rows += 1
                    result.errors.append(
                        f"第{row_num}行跳过: {e} | 数据片段: {str(raw_row)[:150]}"
                    )

    except Exception as e:
        result.errors.append(f"文件读取失败: {e}")

    return result


def import_json(file_path: str, data_type: str) -> ImportResult:
    result = ImportResult(data_type=data_type)
    constructor = CONSTRUCTORS.get(data_type)

    if not constructor:
        result.errors.append(f"未知数据类型: {data_type}")
        return result

    if not os.path.isfile(file_path):
        result.errors.append(f"文件不存在: {file_path}")
        return result

    encoding = _detect_encoding(file_path)

    try:
        with open(file_path, "r", encoding=encoding) as f:
            data = json.load(f)

        if isinstance(data, dict):
            items = data.get("data", data.get("items", data.get("records", [data])))
            if not isinstance(items, list):
                items = [data]
        elif isinstance(data, list):
            items = data
        else:
            result.errors.append(f"JSON 格式不支持: 期望对象或数组")
            return result

        if items:
            sample = items[0] if isinstance(items[0], dict) else {}
            headers = list(sample.keys())
            field_mapping = _build_field_mapping(headers, data_type)

        for idx, raw_item in enumerate(items, start=1):
            result.total_rows += 1
            try:
                if not isinstance(raw_item, dict):
                    raise ValueError(f"期望对象，得到 {type(raw_item).__name__}")

                mapped = {}
                for target_field, source_field in field_mapping.items():
                    val = raw_item.get(source_field, "")
                    mapped[target_field] = str(val).strip() if val is not None else ""

                required_fields = FIELD_MAPS.get(data_type, {}).get("required", [])
                for rf in required_fields:
                    if not mapped.get(rf):
                        raise ValueError(f"必填字段 {rf} 为空")

                if data_type == "tags" and "confidence" in mapped:
                    mapped["confidence"] = _safe_float(mapped.get("confidence", 0), 0.0)

                trace = SourceTrace(
                    file_path=file_path,
                    row_number=idx,
                    raw_line=json.dumps(
                        {k: str(v)[:80] for k, v in raw_item.items()}, ensure_ascii=False
                    ),
                )
                mapped["source"] = trace

                record = constructor(**mapped)
                result.records.append(record)
                result.success_rows += 1
            except Exception as e:
                result.skipped_rows += 1
                result.errors.append(
                    f"第{idx}条跳过: {e} | 数据片段: {str(raw_item)[:150]}"
                )

    except json.JSONDecodeError as e:
        result.errors.append(f"JSON 解析失败: {e}")
    except Exception as e:
        result.errors.append(f"文件读取失败: {e}")

    return result


def import_file(file_path: str, data_type: str) -> ImportResult:
    ext = os.path.splitext(file_path)[1].lower()
    if ext in (".csv", ".tsv", ".txt"):
        return import_csv(file_path, data_type)
    elif ext in (".json", ".jsonl"):
        return import_json(file_path, data_type)
    else:
        result = ImportResult(data_type=data_type)
        result.errors.append(f"不支持的文件格式: {ext}，请使用 csv/tsv/json")
        return result


def import_all(files_config: dict) -> dict:
    results = {}
    for data_type, file_path in files_config.items():
        if not file_path:
            continue
        result = import_file(file_path, data_type)
        results[data_type] = result
    return results
