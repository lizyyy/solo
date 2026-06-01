"""单位换算模块 - 处理练习时长、难度系数等单位转换"""

from typing import Dict, Tuple
import warnings


class UnitConverter:
    """单位转换器 - 支持练习时长、难度系数的单位换算"""

    DURATION_UNITS = {
        "minutes": 1.0,
        "hours": 60.0,
        "seconds": 1 / 60.0,
    }

    DIFFICULTY_SCALES = {
        "1-10": {"min": 1, "max": 10, "target_min": 1, "target_max": 10},
        "1-5": {"min": 1, "max": 5, "target_min": 1, "target_max": 10},
        "0-100": {"min": 0, "max": 100, "target_min": 1, "target_max": 10},
        "A-G": {"mapping": {"A": 10, "B": 8.5, "C": 7, "D": 5.5, "E": 4, "F": 2.5, "G": 1}},
    }

    @classmethod
    def convert_duration(
        cls, value: float, from_unit: str, to_unit: str = "minutes", record_id: str = ""
    ) -> Tuple[float, list]:
        """
        转换练习时长单位

        Args:
            value: 数值
            from_unit: 原单位
            to_unit: 目标单位（默认分钟）
            record_id: 记录ID，用于追溯

        Returns:
            (转换后的值, 提醒信息列表)
        """
        alerts = []

        if from_unit not in cls.DURATION_UNITS:
            alerts.append(
                f"[单位换算提醒] 记录{record_id}: 未知时长单位 '{from_unit}', 已按分钟处理"
            )
            return value, alerts

        if to_unit not in cls.DURATION_UNITS:
            alerts.append(
                f"[单位换算提醒] 记录{record_id}: 未知目标单位 '{to_unit}', 已按分钟处理"
            )
            to_unit = "minutes"

        if from_unit == to_unit:
            return value, alerts

        # 先转成分钟，再转目标单位
        minutes = value * cls.DURATION_UNITS[from_unit]
        result = minutes / cls.DURATION_UNITS[to_unit]

        # 中文单位名称映射
        unit_names = {
            "minutes": "分钟",
            "hours": "小时",
            "seconds": "秒",
        }
        from_unit_cn = unit_names.get(from_unit, from_unit)
        to_unit_cn = unit_names.get(to_unit, to_unit)
        
        alerts.append(
            f"[单位换算] 记录{record_id}: {value}{from_unit_cn} → {result:.2f}{to_unit_cn} "
            f"(换算系数: {cls.DURATION_UNITS[from_unit] / cls.DURATION_UNITS[to_unit]:.4f})"
        )

        return result, alerts

    @classmethod
    def convert_difficulty(
        cls, value, from_scale: str, to_scale: str = "1-10", record_id: str = ""
    ) -> Tuple[float, list]:
        """
        转换难度系数到标准1-10分制

        Args:
            value: 难度值
            from_scale: 原难度体系
            to_scale: 目标难度体系
            record_id: 记录ID

        Returns:
            (转换后的值, 提醒信息列表)
        """
        alerts = []

        if from_scale == to_scale:
            try:
                return float(value), alerts
            except (ValueError, TypeError):
                alerts.append(
                    f"[单位换算提醒] 记录{record_id}: 难度值 '{value}' 无法转换为数字"
                )
                return 0.0, alerts

        if from_scale not in cls.DIFFICULTY_SCALES:
            alerts.append(
                f"[单位换算提醒] 记录{record_id}: 未知难度体系 '{from_scale}', 已按1-10处理"
            )
            try:
                return float(value), alerts
            except (ValueError, TypeError):
                return 0.0, alerts

        scale_config = cls.DIFFICULTY_SCALES[from_scale]

        # 字母等级映射
        if "mapping" in scale_config:
            str_value = str(value).strip().upper()
            if str_value in scale_config["mapping"]:
                converted = scale_config["mapping"][str_value]
                alerts.append(
                    f"[单位换算] 记录{record_id}: 难度等级 {value}({from_scale}) → {converted}分({to_scale})"
                )
                return converted, alerts
            else:
                alerts.append(
                    f"[单位换算提醒] 记录{record_id}: 未知难度等级 '{value}', 已设为中间值5.0"
                )
                return 5.0, alerts

        # 数值范围映射
        try:
            num_value = float(value)
        except (ValueError, TypeError):
            alerts.append(
                f"[单位换算提醒] 记录{record_id}: 难度值 '{value}' 无法转换为数字, 已设为5.0"
            )
            return 5.0, alerts

        src_min, src_max = scale_config["min"], scale_config["max"]
        tgt_min, tgt_max = scale_config["target_min"], scale_config["target_max"]

        # 边界检查
        if num_value < src_min:
            alerts.append(
                f"[边界提醒] 记录{record_id}: 难度值 {num_value} 低于{from_scale}下限 {src_min}, 已修正"
            )
            num_value = src_min
        elif num_value > src_max:
            alerts.append(
                f"[边界提醒] 记录{record_id}: 难度值 {num_value} 高于{from_scale}上限 {src_max}, 已修正"
            )
            num_value = src_max

        # 线性映射
        normalized = (num_value - src_min) / (src_max - src_min)
        converted = tgt_min + normalized * (tgt_max - tgt_min)

        alerts.append(
            f"[单位换算] 记录{record_id}: 难度 {value}({from_scale}) → {converted:.2f}分({to_scale})"
        )

        return converted, alerts
