"""
岩土实验室三轴试验复核工具配置
"""
import os

# 项目根目录
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# 数据目录
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
SAMPLES_DIR = os.path.join(DATA_DIR, "samples")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
EXPORTED_DIR = os.path.join(DATA_DIR, "exported")

# 试验参数配置
TEST_CONFIG = {
    # 孔压异常检测阈值（kPa）
    "pore_pressure_anomaly_threshold": 50.0,
    # 残余强度判断：峰值后稳定段的最小点数
    "residual_min_points": 10,
    # 破坏应变阈值（%）
    "failure_strain_threshold": 15.0,
    # 校准有效期（天）
    "calibration_validity_days": 365,
    # 饱和度判定阈值（B值）
    "saturation_b_value_threshold": 0.95,
}

# 输出格式配置
OUTPUT_CONFIG = {
    "markdown_table_format": "grid",
    "decimal_places": 2,
}
