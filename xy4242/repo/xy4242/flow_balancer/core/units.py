"""单位换算模块 - 处理微流控实验中常见的单位转换"""

from dataclasses import dataclass
from typing import Dict, Callable, Optional


@dataclass
class UnitConversion:
    """单位换算定义"""
    dimension: str
    display_name: str
    to_base: Callable[[float], float]
    from_base: Callable[[float], float]


class UnitConverter:
    """单位转换器 - 支持微流控实验中所有常用单位"""

    # 维度定义和单位换算
    DIMENSIONS: Dict[str, Dict[str, UnitConversion]] = {}

    @classmethod
    def _init_dimensions(cls):
        """初始化所有维度的单位换算"""
        if cls.DIMENSIONS:
            return

        # 长度维度 (基单位: 米, m)
        cls.DIMENSIONS["length"] = {
            "m": UnitConversion(
                dimension="length",
                display_name="米",
                to_base=lambda x: x,
                from_base=lambda x: x,
            ),
            "cm": UnitConversion(
                dimension="length",
                display_name="厘米",
                to_base=lambda x: x * 0.01,
                from_base=lambda x: x / 0.01,
            ),
            "mm": UnitConversion(
                dimension="length",
                display_name="毫米",
                to_base=lambda x: x * 0.001,
                from_base=lambda x: x / 0.001,
            ),
            "um": UnitConversion(
                dimension="length",
                display_name="微米",
                to_base=lambda x: x * 1e-6,
                from_base=lambda x: x / 1e-6,
            ),
            "μm": UnitConversion(
                dimension="length",
                display_name="微米",
                to_base=lambda x: x * 1e-6,
                from_base=lambda x: x / 1e-6,
            ),
            "nm": UnitConversion(
                dimension="length",
                display_name="纳米",
                to_base=lambda x: x * 1e-9,
                from_base=lambda x: x / 1e-9,
            ),
        }

        # 体积维度 (基单位: 立方米, m³)
        cls.DIMENSIONS["volume"] = {
            "m3": UnitConversion(
                dimension="volume",
                display_name="立方米",
                to_base=lambda x: x,
                from_base=lambda x: x,
            ),
            "m³": UnitConversion(
                dimension="volume",
                display_name="立方米",
                to_base=lambda x: x,
                from_base=lambda x: x,
            ),
            "L": UnitConversion(
                dimension="volume",
                display_name="升",
                to_base=lambda x: x * 0.001,
                from_base=lambda x: x / 0.001,
            ),
            "l": UnitConversion(
                dimension="volume",
                display_name="升",
                to_base=lambda x: x * 0.001,
                from_base=lambda x: x / 0.001,
            ),
            "mL": UnitConversion(
                dimension="volume",
                display_name="毫升",
                to_base=lambda x: x * 1e-6,
                from_base=lambda x: x / 1e-6,
            ),
            "ml": UnitConversion(
                dimension="volume",
                display_name="毫升",
                to_base=lambda x: x * 1e-6,
                from_base=lambda x: x / 1e-6,
            ),
            "uL": UnitConversion(
                dimension="volume",
                display_name="微升",
                to_base=lambda x: x * 1e-9,
                from_base=lambda x: x / 1e-9,
            ),
            "μL": UnitConversion(
                dimension="volume",
                display_name="微升",
                to_base=lambda x: x * 1e-9,
                from_base=lambda x: x / 1e-9,
            ),
            "nL": UnitConversion(
                dimension="volume",
                display_name="纳升",
                to_base=lambda x: x * 1e-12,
                from_base=lambda x: x / 1e-12,
            ),
            "pL": UnitConversion(
                dimension="volume",
                display_name="皮升",
                to_base=lambda x: x * 1e-15,
                from_base=lambda x: x / 1e-15,
            ),
        }

        # 时间维度 (基单位: 秒, s)
        cls.DIMENSIONS["time"] = {
            "s": UnitConversion(
                dimension="time",
                display_name="秒",
                to_base=lambda x: x,
                from_base=lambda x: x,
            ),
            "sec": UnitConversion(
                dimension="time",
                display_name="秒",
                to_base=lambda x: x,
                from_base=lambda x: x,
            ),
            "min": UnitConversion(
                dimension="time",
                display_name="分钟",
                to_base=lambda x: x * 60,
                from_base=lambda x: x / 60,
            ),
            "h": UnitConversion(
                dimension="time",
                display_name="小时",
                to_base=lambda x: x * 3600,
                from_base=lambda x: x / 3600,
            ),
            "hr": UnitConversion(
                dimension="time",
                display_name="小时",
                to_base=lambda x: x * 3600,
                from_base=lambda x: x / 3600,
            ),
        }

        # 流量维度 (基单位: 立方米每秒, m³/s)
        # 流量 = 体积 / 时间，先转换为体积和时间再计算
        cls.DIMENSIONS["flow_rate"] = {}

        # 压力维度 (基单位: 帕斯卡, Pa)
        cls.DIMENSIONS["pressure"] = {
            "Pa": UnitConversion(
                dimension="pressure",
                display_name="帕斯卡",
                to_base=lambda x: x,
                from_base=lambda x: x,
            ),
            "kPa": UnitConversion(
                dimension="pressure",
                display_name="千帕",
                to_base=lambda x: x * 1000,
                from_base=lambda x: x / 1000,
            ),
            "MPa": UnitConversion(
                dimension="pressure",
                display_name="兆帕",
                to_base=lambda x: x * 1e6,
                from_base=lambda x: x / 1e6,
            ),
            "bar": UnitConversion(
                dimension="pressure",
                display_name="巴",
                to_base=lambda x: x * 1e5,
                from_base=lambda x: x / 1e5,
            ),
            "mbar": UnitConversion(
                dimension="pressure",
                display_name="毫巴",
                to_base=lambda x: x * 100,
                from_base=lambda x: x / 100,
            ),
            "psi": UnitConversion(
                dimension="pressure",
                display_name="磅力每平方英寸",
                to_base=lambda x: x * 6894.75729,
                from_base=lambda x: x / 6894.75729,
            ),
            "atm": UnitConversion(
                dimension="pressure",
                display_name="标准大气压",
                to_base=lambda x: x * 101325,
                from_base=lambda x: x / 101325,
            ),
            "mmHg": UnitConversion(
                dimension="pressure",
                display_name="毫米汞柱",
                to_base=lambda x: x * 133.322368,
                from_base=lambda x: x / 133.322368,
            ),
            "cmH2O": UnitConversion(
                dimension="pressure",
                display_name="厘米水柱",
                to_base=lambda x: x * 98.0665,
                from_base=lambda x: x / 98.0665,
            ),
        }

        # 黏度维度 (基单位: 帕斯卡秒, Pa·s)
        cls.DIMENSIONS["viscosity"] = {
            "Pa·s": UnitConversion(
                dimension="viscosity",
                display_name="帕斯卡秒",
                to_base=lambda x: x,
                from_base=lambda x: x,
            ),
            "Pa.s": UnitConversion(
                dimension="viscosity",
                display_name="帕斯卡秒",
                to_base=lambda x: x,
                from_base=lambda x: x,
            ),
            "mPa·s": UnitConversion(
                dimension="viscosity",
                display_name="毫帕斯卡秒",
                to_base=lambda x: x * 0.001,
                from_base=lambda x: x / 0.001,
            ),
            "mPa.s": UnitConversion(
                dimension="viscosity",
                display_name="毫帕斯卡秒",
                to_base=lambda x: x * 0.001,
                from_base=lambda x: x / 0.001,
            ),
            "cP": UnitConversion(
                dimension="viscosity",
                display_name="厘泊",
                to_base=lambda x: x * 0.001,
                from_base=lambda x: x / 0.001,
            ),
            "P": UnitConversion(
                dimension="viscosity",
                display_name="泊",
                to_base=lambda x: x * 0.1,
                from_base=lambda x: x / 0.1,
            ),
        }

    def __init__(self):
        self._init_dimensions()

    @classmethod
    def get_dimensions(cls) -> Dict[str, str]:
        """获取所有支持的维度"""
        cls._init_dimensions()
        return {
            "length": "长度",
            "volume": "体积",
            "time": "时间",
            "flow_rate": "流量",
            "pressure": "压力",
            "viscosity": "黏度",
        }

    @classmethod
    def get_units(cls, dimension: str) -> Dict[str, str]:
        """获取指定维度的所有单位"""
        cls._init_dimensions()
        if dimension not in cls.DIMENSIONS:
            return {}
        return {unit: conv.display_name for unit, conv in cls.DIMENSIONS[dimension].items()}

    @classmethod
    def parse_flow_rate(cls, value: float, unit: str) -> float:
        """
        解析流量率，转换为立方米每秒 (m³/s)
        
        支持的格式:
        - 体积单位/时间单位，如: μL/min, mL/h, nL/s
        """
        cls._init_dimensions()
        
        # 常见的流量单位组合
        flow_patterns = {
            # 微升每分钟
            "μL/min": ("μL", "min"),
            "uL/min": ("uL", "min"),
            "µL/min": ("μL", "min"),
            # 微升每秒
            "μL/s": ("μL", "s"),
            "uL/s": ("uL", "s"),
            # 微升每小时
            "μL/h": ("μL", "h"),
            "uL/h": ("uL", "h"),
            # 毫升每分钟
            "mL/min": ("mL", "min"),
            "ml/min": ("ml", "min"),
            # 毫升每秒
            "mL/s": ("mL", "s"),
            "ml/s": ("ml", "s"),
            # 毫升每小时
            "mL/h": ("mL", "h"),
            "ml/h": ("ml", "h"),
            # 纳升每分钟
            "nL/min": ("nL", "min"),
            # 纳升每秒
            "nL/s": ("nL", "s"),
            # 纳升每小时
            "nL/h": ("nL", "h"),
            # 立方米每秒 (SI单位)
            "m3/s": ("m3", "s"),
            "m³/s": ("m³", "s"),
        }
        
        if unit in flow_patterns:
            vol_unit, time_unit = flow_patterns[unit]
            # 转换体积到立方米
            vol_m3 = cls.convert(value, vol_unit, "m3", "volume")
            # 转换时间到秒
            time_s = cls.convert(1, time_unit, "s", "time")
            return vol_m3 / time_s
        
        raise ValueError(f"不支持的流量单位: {unit}")

    @classmethod
    def format_flow_rate(cls, value_m3s: float, target_unit: str) -> float:
        """
        将立方米每秒转换为目标流量单位
        """
        cls._init_dimensions()
        
        flow_patterns = {
            "μL/min": ("μL", "min"),
            "uL/min": ("uL", "min"),
            "mL/min": ("mL", "min"),
            "ml/min": ("ml", "min"),
            "μL/s": ("μL", "s"),
            "uL/s": ("uL", "s"),
            "mL/s": ("mL", "s"),
            "ml/s": ("ml", "s"),
            "μL/h": ("μL", "h"),
            "uL/h": ("uL", "h"),
            "mL/h": ("mL", "h"),
            "ml/h": ("ml", "h"),
            "nL/min": ("nL", "min"),
            "nL/s": ("nL", "s"),
            "nL/h": ("nL", "h"),
            "m3/s": ("m3", "s"),
            "m³/s": ("m³", "s"),
        }
        
        if target_unit in flow_patterns:
            vol_unit, time_unit = flow_patterns[target_unit]
            # 1秒的流量体积
            vol_per_sec = value_m3s
            # 转换到目标体积单位
            vol_target = cls.convert(vol_per_sec, "m3", vol_unit, "volume")
            # 转换到目标时间单位
            time_factor = cls.convert(1, time_unit, "s", "time")
            return vol_target * time_factor
        
        raise ValueError(f"不支持的流量单位: {target_unit}")

    @classmethod
    def convert(
        cls,
        value: float,
        from_unit: str,
        to_unit: str,
        dimension: Optional[str] = None,
    ) -> float:
        """
        转换单位值
        
        Args:
            value: 数值
            from_unit: 源单位
            to_unit: 目标单位
            dimension: 可选的维度指定 (用于歧义单位)
        
        Returns:
            转换后的值
        """
        cls._init_dimensions()
        
        # 相同单位直接返回
        if from_unit == to_unit:
            return value
        
        # 处理流量率的特殊情况
        if "/" in from_unit or "/" in to_unit:
            if from_unit == to_unit:
                return value
            # 转换到基单位 (m³/s) 再转换出来
            if "/" in from_unit:
                base_value = cls.parse_flow_rate(value, from_unit)
            else:
                # from_unit 已经是 m³/s
                base_value = value
            
            if "/" in to_unit:
                return cls.format_flow_rate(base_value, to_unit)
            else:
                # to_unit 是 m³/s
                return base_value
        
        # 查找源单位的维度
        from_conv = None
        from_dim = None
        
        if dimension:
            if dimension in cls.DIMENSIONS and from_unit in cls.DIMENSIONS[dimension]:
                from_conv = cls.DIMENSIONS[dimension][from_unit]
                from_dim = dimension
        else:
            # 自动查找维度
            for dim_name, units in cls.DIMENSIONS.items():
                if from_unit in units:
                    from_conv = units[from_unit]
                    from_dim = dim_name
                    break
        
        if from_conv is None:
            raise ValueError(f"不支持的源单位: {from_unit}")
        
        # 查找目标单位
        to_conv = None
        if to_unit in cls.DIMENSIONS[from_dim]:
            to_conv = cls.DIMENSIONS[from_dim][to_unit]
        
        if to_conv is None:
            raise ValueError(f"不支持的目标单位: {to_unit} (维度: {from_dim})")
        
        # 转换: 先转成基单位，再转成目标单位
        base_value = from_conv.to_base(value)
        result = to_conv.from_base(base_value)
        
        return result

    @classmethod
    def is_valid_unit(cls, unit: str, dimension: Optional[str] = None) -> bool:
        """检查单位是否有效"""
        cls._init_dimensions()
        
        # 处理流量单位
        if "/" in unit:
            try:
                cls.parse_flow_rate(1.0, unit)
                return True
            except ValueError:
                return False
        
        if dimension:
            return dimension in cls.DIMENSIONS and unit in cls.DIMENSIONS[dimension]
        
        # 检查所有维度
        for units in cls.DIMENSIONS.values():
            if unit in units:
                return True
        return False


# 便捷函数
def convert(
    value: float,
    from_unit: str,
    to_unit: str,
    dimension: Optional[str] = None,
) -> float:
    return UnitConverter.convert(value, from_unit, to_unit, dimension)


def is_valid_unit(unit: str, dimension: Optional[str] = None) -> bool:
    return UnitConverter.is_valid_unit(unit, dimension)


def get_available_units(dimension: str) -> Dict[str, str]:
    return UnitConverter.get_units(dimension)
