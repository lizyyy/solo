import hashlib
import json
import re
from typing import Any, Dict, Tuple


def compute_idempotency_hash(payload: Dict[str, Any]) -> str:
    """计算请求内容的哈希，用于幂等判重。
    只看业务关键字段，忽略提交时间等无关噪声。
    """
    canonical = {
        "plan_code": payload.get("plan_code", ""),
        "plan_name": payload.get("plan_name", ""),
        "building_address": payload.get("building_address", ""),
        "submitter": payload.get("submitter", ""),
        "survey_method": payload.get("survey_method", ""),
        "total_stations": payload.get("total_stations", 0),
        "remark": payload.get("remark", ""),
        "layers": sorted(
            [
                {
                    "layer_name": l.get("layer_name", ""),
                    "entity_count": l.get("entity_count", 0),
                }
                for l in payload.get("layers", [])
            ],
            key=lambda x: x["layer_name"],
        ),
        "collision_points": sorted(
            [
                {
                    "point_code": p.get("point_code", ""),
                    "layer_a": p.get("layer_a", ""),
                    "layer_b": p.get("layer_b", ""),
                    "anchor_x": round(p.get("anchor_x", 0.0), 3),
                    "anchor_y": round(p.get("anchor_y", 0.0), 3),
                    "anchor_z": round(p.get("anchor_z", 0.0), 3),
                }
                for p in payload.get("collision_points", [])
            ],
            key=lambda x: x["point_code"],
        ),
        "manual_judgments": sorted(
            [
                {
                    "judgment_code": j.get("judgment_code", ""),
                    "point_code": j.get("point_code", ""),
                    "final_result": j.get("final_result", ""),
                }
                for j in payload.get("manual_judgments", [])
            ],
            key=lambda x: x["judgment_code"],
        ),
    }
    raw = json.dumps(canonical, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


LAYER_RULES = [
    (re.compile(r"^(结构|STRUCTURE|STR)[_\-]?.*$", re.I), "structure", "结构层"),
    (re.compile(r"^(墙|WALL|WL)[_\-]?.*$", re.I), "wall", "墙体层"),
    (re.compile(r"^(管|PIPE|PL|水|给排水)[_\-]?.*$", re.I), "pipe", "管道层"),
    (re.compile(r"^(电|ELEC|EL|强电|弱电|消防电)[_\-]?.*$", re.I), "electrical", "电气层"),
]

STOPWORDS = {"新建", "最终版", "final", "new", "副本", "copy", " ", "\t", "\n"}
CHAOS_PATTERNS = [
    (re.compile(r"[，。！？、；：""''（）]"), "含中文标点"),
    (re.compile(r"[!@#$%^&*()]"), "含特殊符号(!@#等)"),
    (re.compile(r"^[0-9]+$"), "纯数字无语义"),
    (re.compile(r"^(无标题|未命名|untitled|layer\d+)$", re.I), "默认/无名图层"),
    (re.compile(r"_{2,}|-{2,}|\s{2,}"), "连续分隔符冗余"),
    (re.compile(r"[\u4e00-\u9fa5][A-Za-z]|[A-Za-z][\u4e00-\u9fa5]"), "中英文无分隔混拼"),
]


def normalize_layer_name(raw: str) -> str:
    name = raw.strip()
    for sw in STOPWORDS:
        name = name.replace(sw, "")
    name = re.sub(r"[_\-\s]+", "_", name)
    return name.strip("_")


def validate_layer_name(raw: str) -> Tuple[bool, str, str]:
    """返回 (是否规范, 图层类型, 拦截原因)"""
    if not raw or not raw.strip():
        return False, "unknown", "图层名称为空，无法匹配任何专业类别"

    normalized = normalize_layer_name(raw)
    if not normalized:
        return False, "unknown", f"图层名'{raw}'清理后为空字符串"

    matched_type = "unknown"
    for regex, ltype, _ in LAYER_RULES:
        if regex.match(normalized):
            matched_type = ltype
            break

    for regex, desc in CHAOS_PATTERNS:
        if regex.search(raw):
            if matched_type == "unknown":
                return (
                    False,
                    "unknown",
                    f"命名混乱：{desc}；且无法匹配结构/墙/管/电任一类，建议按'类别_部位_楼层'重命名（例：WALL_主体_3F）",
                )
            return (
                False,
                matched_type,
                f"虽识别为{matched_type}层，但命名存在问题：{desc}；社区公示前建议统一命名格式（例：{matched_type.upper()}_部位_楼层）",
            )

    if matched_type == "unknown":
        return (
            False,
            "unknown",
            f"名称'{raw}'未命中结构/墙/管/电任一规则字典，按标准应使用WALL/PIPE/ELEC/STR前缀",
        )

    return True, matched_type, ""
