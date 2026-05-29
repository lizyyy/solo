import re
from typing import Tuple, Optional, List, Dict, Any
from .models import ColorSpec, ColorFormat, ErrorRecord
from .storage import StorageManager


COLOR_NAME_MAP = {
    "大红": ("#DC143C", (220, 20, 60)),
    "正红": ("#FF0000", (255, 0, 0)),
    "中国红": ("#CE0000", (206, 0, 0)),
    "酒红": ("#722F37", (114, 47, 55)),
    "玫红": ("#DE3163", (222, 49, 99)),
    "枣红": ("#9B1B30", (155, 27, 48)),
    "深红": ("#8B0000", (139, 0, 0)),
    "浅红": ("#FF6B6B", (255, 107, 107)),
    "深蓝": ("#00008B", (0, 0, 139)),
    "藏蓝": ("#003366", (0, 51, 102)),
    "宝蓝": ("#191970", (25, 25, 112)),
    "天蓝": ("#87CEEB", (135, 206, 235)),
    "湖蓝": ("#4682B4", (70, 130, 180)),
    "浅蓝": ("#ADD8E6", (173, 216, 230)),
    "墨绿": ("#1B4D3E", (27, 77, 62)),
    "军绿": ("#4B5320", (75, 83, 32)),
    "草绿": ("#7CFC00", (124, 252, 0)),
    "浅绿": ("#90EE90", (144, 238, 144)),
    "深绿": ("#006400", (0, 100, 0)),
    "正黄": ("#FFD700", (255, 215, 0)),
    "鹅黄": ("#FFF8DC", (255, 248, 220)),
    "金黄": ("#FFD700", (255, 215, 0)),
    "米白": ("#F5F5DC", (245, 245, 220)),
    "象牙白": ("#FFFFF0", (255, 255, 240)),
    "本白": ("#FAF0E6", (250, 240, 230)),
    "纯白": ("#FFFFFF", (255, 255, 255)),
    "黑色": ("#000000", (0, 0, 0)),
    "碳黑": ("#36454F", (54, 69, 79)),
    "灰色": ("#808080", (128, 128, 128)),
    "深灰": ("#404040", (64, 64, 64)),
    "浅灰": ("#D3D3D3", (211, 211, 211)),
    "驼色": ("#C19A6B", (193, 154, 107)),
    "卡其": ("#C3B091", (195, 176, 145)),
    "咖啡色": ("#6F4E37", (111, 78, 55)),
    "棕色": ("#8B4513", (139, 69, 19)),
    "粉色": ("#FFC0CB", (255, 192, 203)),
    "藕粉": ("#EDC9AF", (237, 201, 175)),
    "紫色": ("#800080", (128, 0, 128)),
    "香芋紫": ("#B19CD9", (177, 156, 217)),
}


class ColorValidator:
    def __init__(self, storage: StorageManager):
        self.storage = storage
        self.color_tolerance = 30
        self.confusing_pairs = [
            (["大红", "正红", "中国红"], 50),
            (["深蓝", "藏蓝", "宝蓝"], 60),
            (["米白", "象牙白", "本白"], 30),
            (["墨绿", "军绿"], 40),
        ]

    def detect_format(self, color_code: str) -> ColorFormat:
        code = color_code.strip().upper()
        if re.match(r'^#([0-9A-F]{6}|[0-9A-F]{3})$', code):
            return ColorFormat.HEX
        if re.match(r'^RGB\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$', code):
            return ColorFormat.RGB
        if re.match(r'^\d+\s*,\s*\d+\s*,\s*\d+$', code):
            return ColorFormat.RGB
        if re.match(r'^PANTONE\s+', code, re.IGNORECASE) or re.match(r'^\d+\s*[C/U]$', code):
            return ColorFormat.PANTONE
        if re.match(r'^CMYK\s*\(', code, re.IGNORECASE):
            return ColorFormat.CMYK
        if color_code.strip() in COLOR_NAME_MAP:
            return ColorFormat.NAME
        if re.match(r'^[\u4e00-\u9fa5]+$', color_code.strip()):
            return ColorFormat.NAME
        return ColorFormat.UNKNOWN

    def parse_color(self, color_code: str) -> Tuple[Optional[str], Optional[tuple], float, List[str]]:
        code = color_code.strip()
        format_detected = self.detect_format(code)
        calculation_trace = []
        hex_val = None
        rgb_val = None
        confidence = 0.0

        calculation_trace.append(f"原始色号: {code}")
        calculation_trace.append(f"检测格式: {format_detected.value}")

        if format_detected == ColorFormat.HEX:
            hex_val = code.upper()
            if len(hex_val) == 4:
                hex_val = '#' + ''.join(c * 2 for c in hex_val[1:])
            r = int(hex_val[1:3], 16)
            g = int(hex_val[3:5], 16)
            b = int(hex_val[5:7], 16)
            rgb_val = (r, g, b)
            confidence = 0.95
            calculation_trace.append(f"HEX转RGB: R={r}, G={g}, B={b}")

        elif format_detected == ColorFormat.RGB:
            match = re.search(r'(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', code)
            if match:
                r, g, b = int(match.group(1)), int(match.group(2)), int(match.group(3))
                rgb_val = (r, g, b)
                hex_val = f"#{r:02X}{g:02X}{b:02X}"
                confidence = 0.9
                calculation_trace.append(f"RGB转HEX: {hex_val}")

        elif format_detected == ColorFormat.NAME:
            if code in COLOR_NAME_MAP:
                hex_val, rgb_val = COLOR_NAME_MAP[code]
                confidence = 0.85
                calculation_trace.append(f"颜色名称映射: {code} -> {hex_val}")
            else:
                confidence = 0.3
                calculation_trace.append(f"警告: 未知颜色名称 '{code}'，无法精确映射")

        elif format_detected == ColorFormat.PANTONE:
            pantone_clean = re.sub(r'PANTONE\s+', '', code, flags=re.IGNORECASE).strip()
            confidence = 0.7
            calculation_trace.append(f"潘通色号: {pantone_clean} (需人工校验对应RGB)")
            if pantone_clean == "186 C":
                rgb_val = (206, 17, 38)
                hex_val = "#CE1126"
                calculation_trace.append(f"潘通186 C映射: {hex_val}")
            elif pantone_clean == "286 C":
                rgb_val = (0, 51, 160)
                hex_val = "#0033A0"
                calculation_trace.append(f"潘通286 C映射: {hex_val}")

        confusing_list = self._detect_confusing(hex_val, rgb_val, code)
        if confusing_list:
            calculation_trace.append(f"色号混淆风险: 可能与 {', '.join(confusing_list)} 混淆")

        return hex_val, rgb_val, confidence, confusing_list

    def _detect_confusing(self, hex_val: Optional[str], rgb_val: Optional[tuple], original_code: str) -> List[str]:
        confusing = []
        if not rgb_val:
            return confusing

        for color_name, (name_hex, name_rgb) in COLOR_NAME_MAP.items():
            if color_name == original_code:
                continue
            distance = self._color_distance(rgb_val, name_rgb)
            if distance < self.color_tolerance:
                confusing.append(f"{color_name}({name_hex}, 色差={distance:.1f})")

        for group, threshold in self.confusing_pairs:
            if original_code in group:
                for other in group:
                    if other != original_code and other not in confusing:
                        confusing.append(f"{other}(同色系易混, 阈值={threshold})")

        return confusing[:5]

    def _color_distance(self, rgb1: tuple, rgb2: tuple) -> float:
        r1, g1, b1 = rgb1
        r2, g2, b2 = rgb2
        rmean = (r1 + r2) / 2
        r = r1 - r2
        g = g1 - g2
        b = b1 - b2
        return (
            (2 + rmean / 256) * r * r +
            4 * g * g +
            (2 + (255 - rmean) / 256) * b * b
        ) ** 0.5

    def validate_color_spec(self, color_code: str, color_name: Optional[str] = None, entity_id: Optional[str] = None, entity_type: str = "sample") -> ColorSpec:
        calc_trace = []
        hex_val, rgb_val, confidence, confusing = self.parse_color(color_code)
        format_detected = self.detect_format(color_code)

        calc_trace.append(f"色号校验 - 目标: {color_code}")
        calc_trace.append(f"置信度计算: {confidence:.2f} (阈值: 0.6)")

        is_confusing = len(confusing) > 0
        if is_confusing:
            calc_trace.append(f"混淆检测: 发现 {len(confusing)} 个易混色号")

        pantone_code = None
        if format_detected == ColorFormat.PANTONE:
            pantone_code = color_code.strip()

        if confidence < 0.6:
            error = self.storage.create_error_record(
                error_type="色号校验",
                error_code="COLOR-001",
                message=f"色号 '{color_code}' 识别置信度过低 ({confidence:.2f})，可能存在格式错误或需要人工确认",
                sample_id=entity_id if entity_type == "sample" else None,
                garment_id=entity_id if entity_type == "garment" else None,
                severity="warning",
                calculation_detail={
                    "color_code": color_code,
                    "confidence": confidence,
                    "threshold": 0.6,
                    "format_detected": format_detected.value,
                    "trace": calc_trace
                }
            )
            calc_trace.append(f"错误记录: {error.error_id} - 置信度低于阈值")

        if is_confusing:
            error = self.storage.create_error_record(
                error_type="色号校验",
                error_code="COLOR-002",
                message=f"色号 '{color_code}' 存在混淆风险: {', '.join(confusing)}",
                sample_id=entity_id if entity_type == "sample" else None,
                garment_id=entity_id if entity_type == "garment" else None,
                severity="warning",
                calculation_detail={
                    "color_code": color_code,
                    "confusing_with": confusing,
                    "tolerance": self.color_tolerance,
                    "trace": calc_trace
                }
            )
            calc_trace.append(f"错误记录: {error.error_id} - 存在色号混淆风险")

        if color_name and color_name in COLOR_NAME_MAP:
            expected_hex, expected_rgb = COLOR_NAME_MAP[color_name]
            if rgb_val and expected_rgb:
                distance = self._color_distance(rgb_val, expected_rgb)
                calc_trace.append(f"颜色名称一致性校验: '{color_name}' 期望 {expected_hex}")
                calc_trace.append(f"色差值: {distance:.1f} (阈值: 50)")
                if distance > 50:
                    error = self.storage.create_error_record(
                        error_type="色号校验",
                        error_code="COLOR-003",
                        message=f"颜色名称 '{color_name}' 与色号值不一致，色差={distance:.1f}",
                        sample_id=entity_id if entity_type == "sample" else None,
                        garment_id=entity_id if entity_type == "garment" else None,
                        severity="error",
                        calculation_detail={
                            "color_code": color_code,
                            "color_name": color_name,
                            "expected_hex": expected_hex,
                            "actual_hex": hex_val,
                            "color_distance": distance,
                            "threshold": 50,
                            "trace": calc_trace
                        }
                    )

        return ColorSpec(
            color_code=color_code,
            color_name=color_name,
            format_detected=format_detected,
            normalized_hex=hex_val,
            normalized_rgb=rgb_val,
            pantone_code=pantone_code,
            color_confidence=confidence,
            is_confusing=is_confusing,
            confusing_with=confusing if confusing else None
        )

    def compare_colors(self, spec1: ColorSpec, spec2: ColorSpec) -> Tuple[float, List[str], Dict[str, Any]]:
        calc_trace = []
        calc_detail = {}

        calc_trace.append("颜色比对开始")
        calc_trace.append(f"色号1: {spec1.color_code} -> {spec1.normalized_hex}")
        calc_trace.append(f"色号2: {spec2.color_code} -> {spec2.normalized_hex}")

        if not spec1.normalized_rgb or not spec2.normalized_rgb:
            calc_trace.append("警告: 缺少标准化RGB值，无法精确比对")
            return 0.3, calc_trace, {"error": "missing_rgb"}

        distance = self._color_distance(spec1.normalized_rgb, spec2.normalized_rgb)
        calc_trace.append(f"计算色差 (Redmean公式): {distance:.2f}")

        match_score = max(0.0, 1.0 - distance / 255.0)
        calc_trace.append(f"匹配度 = 1 - 色差/255 = 1 - {distance:.2f}/255 = {match_score:.4f}")

        calc_detail = {
            "rgb1": spec1.normalized_rgb,
            "rgb2": spec2.normalized_rgb,
            "color_distance": distance,
            "match_score": match_score,
            "formula": "Redmean",
            "thresholds": {
                "exact": 10,
                "similar": 40,
                "different": 100
            },
            "trace": calc_trace
        }

        if distance < 10:
            calc_trace.append("判定: 精确匹配")
        elif distance < 40:
            calc_trace.append("判定: 相似颜色")
        elif distance < 100:
            calc_trace.append("判定: 可接受差异")
        else:
            calc_trace.append("判定: 差异较大")

        return match_score, calc_trace, calc_detail
