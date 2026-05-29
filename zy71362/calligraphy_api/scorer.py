import numpy as np
from config import CHAR_SPACING_IDEAL, LINE_SPACING_IDEAL


def calculate_scores(measurement: dict) -> dict:
    avg_char = measurement.get("avg_char_spacing", 0.0)
    avg_line = measurement.get("avg_line_spacing", 0.0)
    char_var = measurement.get("char_spacing_variance", 0.0)
    line_var = measurement.get("line_spacing_variance", 0.0)
    sig_detected = measurement.get("signature_detected", False)
    sig_region = measurement.get("signature_region")

    char_spacing_score = _score_spacing(avg_char, char_var, CHAR_SPACING_IDEAL)
    line_spacing_score = _score_spacing(avg_line, line_var, LINE_SPACING_IDEAL)
    signature_position_score = _score_signature(sig_detected, sig_region)

    total_score = round(
        char_spacing_score * 0.35
        + line_spacing_score * 0.35
        + signature_position_score * 0.30,
        2,
    )

    return {
        "char_spacing_score": round(char_spacing_score, 2),
        "line_spacing_score": round(line_spacing_score, 2),
        "signature_position_score": round(signature_position_score, 2),
        "total_score": total_score,
    }


def _score_spacing(avg_spacing: float, variance: float, ideal_ratio: float) -> float:
    if avg_spacing <= 0:
        return 20.0

    char_height_est = avg_spacing / ideal_ratio if ideal_ratio > 0 else avg_spacing
    ratio = avg_spacing / (char_height_est + 1e-6)
    ratio_score = max(0, 100 - abs(ratio - ideal_ratio) / ideal_ratio * 100)

    if variance > 0 and avg_spacing > 0:
        cv = float(np.sqrt(variance)) / avg_spacing
        uniformity_score = max(0, 100 - cv * 150)
    else:
        uniformity_score = 100.0

    return ratio_score * 0.4 + uniformity_score * 0.6


def _score_signature(detected: bool, region: dict) -> float:
    if not detected:
        return 20.0

    if not region:
        return 50.0

    ink_ratio = region.get("ink_ratio", 0)
    pos_score = 70.0

    if ink_ratio > 0.02:
        pos_score += 10
    elif ink_ratio > 0.01:
        pos_score += 5

    x_ratio = region.get("x", 0) / max(region.get("width", 1) + region.get("x", 1), 1)
    y_ratio = region.get("y", 0) / max(region.get("height", 1) + region.get("y", 1), 1)

    if x_ratio > 0.5:
        pos_score += 10
    if y_ratio > 0.5:
        pos_score += 10

    return min(pos_score, 100.0)


def recalculate_scores_from_adjustment(
    base_scores: dict,
    adjustments: dict,
) -> dict:
    result = {
        "char_spacing_score": adjustments.get("avg_char_spacing") is not None
        and base_scores.get("char_spacing_score", 0)
        or base_scores.get("char_spacing_score", 0),
        "line_spacing_score": base_scores.get("line_spacing_score", 0),
        "signature_position_score": base_scores.get("signature_position_score", 0),
    }

    if adjustments.get("avg_char_spacing") is not None:
        variance = adjustments.get("char_spacing_variance", 0)
        result["char_spacing_score"] = round(
            _score_spacing(adjustments["avg_char_spacing"], variance, CHAR_SPACING_IDEAL), 2
        )

    if adjustments.get("avg_line_spacing") is not None:
        variance = adjustments.get("line_spacing_variance", 0)
        result["line_spacing_score"] = round(
            _score_spacing(adjustments["avg_line_spacing"], variance, LINE_SPACING_IDEAL), 2
        )

    if adjustments.get("signature_detected") is not None or adjustments.get("signature_region") is not None:
        sig_detected = adjustments.get("signature_detected", base_scores.get("signature_position_score", 0) > 20)
        sig_region = adjustments.get("signature_region")
        result["signature_position_score"] = round(_score_signature(sig_detected, sig_region), 2)

    result["total_score"] = round(
        result["char_spacing_score"] * 0.35
        + result["line_spacing_score"] * 0.35
        + result["signature_position_score"] * 0.30,
        2,
    )
    return result
