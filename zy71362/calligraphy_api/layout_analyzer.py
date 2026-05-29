import numpy as np
from PIL import Image
from image_processor import (
    load_image,
    detect_text_regions,
    detect_chars_in_row,
    detect_signature_region,
)
from config import CHAR_SPACING_IDEAL, LINE_SPACING_IDEAL


def measure_layout(image_path: str) -> dict:
    image = load_image(image_path)
    text_rows = detect_text_regions(image)
    char_positions_per_row = []
    char_distances = []
    line_distances = []
    total_chars = 0

    for row_start, row_end in text_rows:
        chars = detect_chars_in_row(image, row_start, row_end)
        char_positions_per_row.append(chars)
        total_chars += len(chars)
        for i in range(len(chars) - 1):
            dist = chars[i + 1][0] - chars[i][1]
            char_distances.append(dist)

    for i in range(len(text_rows) - 1):
        dist = text_rows[i + 1][0] - text_rows[i][1]
        line_distances.append(dist)

    signature_info = detect_signature_region(image, text_rows)

    avg_char_spacing = float(np.mean(char_distances)) if char_distances else 0.0
    avg_line_spacing = float(np.mean(line_distances)) if line_distances else 0.0
    char_spacing_variance = float(np.var(char_distances)) if len(char_distances) > 1 else 0.0
    line_spacing_variance = float(np.var(line_distances)) if len(line_distances) > 1 else 0.0

    return {
        "text_rows": text_rows,
        "char_positions_per_row": char_positions_per_row,
        "char_distances": [float(d) for d in char_distances],
        "line_distances": [float(d) for d in line_distances],
        "avg_char_spacing": avg_char_spacing,
        "avg_line_spacing": avg_line_spacing,
        "char_spacing_variance": char_spacing_variance,
        "line_spacing_variance": line_spacing_variance,
        "signature_detected": signature_info["detected"],
        "signature_region": signature_info.get("region"),
        "row_count": len(text_rows),
        "char_count": total_chars,
    }


def check_spacing_issues(measurement: dict) -> list:
    issues = []
    char_dists = measurement.get("char_distances", [])
    line_dists = measurement.get("line_distances", [])

    if char_dists:
        char_arr = np.array(char_dists)
        cv = float(np.std(char_arr) / (np.mean(char_arr) + 1e-6))
        if cv > 0.5:
            issues.append({
                "issue_type": "char_spacing_irregular",
                "severity": "high" if cv > 0.8 else "medium",
                "description": f"字距变异系数 {cv:.2f} 过大，字距不均匀",
                "suggested_action": "建议学生注意字间距的均匀性，保持一致的间距",
            })
        elif cv > 0.3:
            issues.append({
                "issue_type": "char_spacing_irregular",
                "severity": "low",
                "description": f"字距变异系数 {cv:.2f} 略有偏大，字距不够均匀",
                "suggested_action": "字距基本均匀，可进一步微调",
            })

    if line_dists:
        line_arr = np.array(line_dists)
        cv = float(np.std(line_arr) / (np.mean(line_arr) + 1e-6))
        if cv > 0.5:
            issues.append({
                "issue_type": "line_spacing_misjudgment",
                "severity": "high" if cv > 0.8 else "medium",
                "description": f"行距变异系数 {cv:.2f} 过大，行距不一致",
                "suggested_action": "行距误判可能：请核实行距检测是否准确，必要时手动调整测量数据",
            })
        elif cv > 0.3:
            issues.append({
                "issue_type": "line_spacing_misjudgment",
                "severity": "low",
                "description": f"行距变异系数 {cv:.2f} 略有偏大",
                "suggested_action": "行距基本均匀，轻微偏差可忽略或手动调整",
            })

    if not measurement.get("signature_detected", False):
        issues.append({
            "issue_type": "signature_missed",
            "severity": "medium",
            "description": "未检测到落款区域，可能是落款位置异常或漏写",
            "suggested_action": "请检查原图是否存在落款；若存在，请手动标注落款区域",
        })

    return issues
