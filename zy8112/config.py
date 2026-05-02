"""微震事件复核工具配置参数"""

# STA/LTA 算法参数
DEFAULT_STA_WINDOW = 0.05  # STA 窗口长度（秒）
DEFAULT_LTA_WINDOW = 0.5   # LTA 窗口长度（秒）
DEFAULT_STA_LTA_THRESHOLD = 3.0  # STA/LTA 触发阈值

# 阈值拾取参数
DEFAULT_THRESHOLD_MULTIPLIER = 3.0  # 相对于噪声水平的倍数

# 定位算法参数
MIN_STATIONS_FOR_LOCATION = 3  # 定位所需最少台站数
DEFAULT_VELOCITY_P = 5000.0    # 默认 P 波速度 (m/s)
DEFAULT_DEPTH_PENALTY = 1.0     # 深度惩罚因子

# 数据校验参数
MIN_VALID_SAMPLING_RATE = 100.0  # 最小有效采样率 (Hz)
MAX_VALID_SAMPLING_RATE = 10000.0  # 最大有效采样率 (Hz)
MIN_COORDINATE_RANGE = -10000.0  # 坐标最小值 (m)
MAX_COORDINATE_RANGE = 10000.0   # 坐标最大值 (m)

# 界面配置
DEFAULT_TIME_ZOOM_BEFORE = 0.1   # 拾取前显示时间 (秒)
DEFAULT_TIME_ZOOM_AFTER = 0.3     # 拾取后显示时间 (秒)

# 导出配置
DEFAULT_OUTPUT_DIR = "output"
EVENTS_CSV_FILENAME = "events.csv"
REPORT_FILENAME = "review_report.md"
