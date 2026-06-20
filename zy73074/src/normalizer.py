"""
数据清洗与标准化模块
处理维修照片字段名前后不一致的问题，统一字段并保留来源和处理状态
"""
import csv
import os
import hashlib
from datetime import datetime

FIELD_MAPPING = {
    "photo_id": ["照片编号", "photo_id", "图片ID", "图片编号"],
    "cabinet_id": ["设备编号", "cabinet_code", "配电柜编号", "cabinet_id"],
    "shoot_time": ["拍摄时间", "shoot_ts", "采集时间", "timestamp"],
    "part_name": ["异常部位", "part_name", "部位名称", "问题部位"],
    "temperature": ["温度读数", "temp_value", "温度", "temperature", "temp"],
    "operator": ["拍摄人", "operator", "操作人", "巡检人"],
    "suggestion": ["处理意见", "suggestion", "处理建议", "建议"],
    "source": ["数据来源", "source", "来源系统", "采集来源"]
}

STANDARD_FIELDS = ["photo_id", "cabinet_id", "shoot_time", "part_name",
                   "temperature", "operator", "suggestion", "source",
                   "process_status", "normalized_from", "row_hash"]

def _detect_field(row_keys, target_aliases):
    """从行键中探测匹配的字段名"""
    key_lower_map = {k.lower().strip(): k for k in row_keys}
    for alias in target_aliases:
        if alias.lower() in key_lower_map:
            return key_lower_map[alias.lower()]
    for k in row_keys:
        for alias in target_aliases:
            if alias.lower() in k.lower():
                return k
    return None

def _normalize_temp(val):
    """把 '95℃' / '95 °C' 之类格式转成数值"""
    if val is None:
        return ""
    s = str(val).strip().replace("℃", "").replace("°C", "").replace("C", "").strip()
    try:
        return str(float(s))
    except ValueError:
        return str(val)

HASH_KEY_FIELDS = ["photo_id", "cabinet_id", "shoot_time", "part_name",
                   "temperature", "operator", "suggestion", "source"]

def _normalize_value(v):
    """统一值格式：去首尾空格、None转空串、数字统一精度"""
    if v is None:
        return ""
    s = str(v).strip()
    return s

def _row_hash(row):
    """
    跨进程稳定的内容哈希：用 hashlib.sha256
    输入是排序后的关键字段规范化值，避免字段顺序/空白/轻微格式差异导致误判
    """
    parts = []
    for f in HASH_KEY_FIELDS:
        val = _normalize_value(row.get(f, ""))
        parts.append(f"{f}={val}")
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def load_csv(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def normalize_photos(raw_rows, source_tag_hint=None):
    """
    把任意字段名的维修照片行标准化到统一结构。
    保留 '数据来源/来源' 到 source，process_status 初始化为待处理
    """
    normalized = []
    for idx, raw in enumerate(raw_rows):
        keys = list(raw.keys())
        std = {}
        matched_any = False
        for std_field, aliases in FIELD_MAPPING.items():
            found = _detect_field(keys, aliases)
            if found:
                val = raw[found]
                if std_field == "temperature":
                    val = _normalize_temp(val)
                std[std_field] = val
                matched_any = True
            else:
                std[std_field] = ""
        
        if not matched_any:
            continue
        
        if not std.get("source") and source_tag_hint:
            std["source"] = source_tag_hint
        
        src_fields = ",".join(sorted(k for k in keys if k and k not in list(FIELD_MAPPING.keys())))
        std["normalized_from"] = src_fields or "direct_match"
        std["process_status"] = "pending"
        std["row_hash"] = _row_hash(std)
        normalized.append(std)
    return normalized

def write_csv(path, rows, fieldnames=None):
    if not rows:
        return
    fn = fieldnames or list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fn)
        w.writeheader()
        w.writerows(rows)

if __name__ == "__main__":
    b1 = load_csv("data/repair_photos_batch1.csv")
    b2 = load_csv("data/repair_photos_batch2.csv")
    n1 = normalize_photos(b1)
    n2 = normalize_photos(b2)
    merged = n1 + n2
    os.makedirs("output", exist_ok=True)
    write_csv("output/normalized_photos.csv", merged, STANDARD_FIELDS)
    print(f"标准化完成: 批次1={len(n1)} 批次2={len(n2)} 合计={len(merged)}")
