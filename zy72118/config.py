UNITS = {
    'distance': {
        'mm': 1.0,
        'cm': 10.0,
        'm': 1000.0,
        'um': 0.001
    },
    'time': {
        'ms': 1.0,
        's': 1000.0,
        'us': 0.001
    }
}

VALID_DIRECTIONS = ['正向', '反向', '正', '反', '+', '-']

COLUMN_MAPPINGS = {
    'timestamp': ['时间', 'timestamp', 'time', '时刻', '测量时间'],
    'distance_raw': ['原始值', 'raw', '测量值', 'distance', '测距值'],
    'distance_reference': ['标准值', 'reference', '基准值', '真值', '参考值'],
    'direction': ['方向', 'direction', '移动方向'],
    'temperature': ['温度', 'temperature', 'temp'],
    'humidity': ['湿度', 'humidity', 'hum'],
    'device_id': ['设备号', '设备ID', 'device', 'device_id'],
    'operator': ['操作人员', '操作员', 'operator'],
    'remark': ['备注', 'remark', '说明']
}

WARNING_MESSAGES = {
    'unit_mismatch': '⚠️ 单位不一致：检测到多种距离单位，请确认转换是否正确',
    'direction_ambiguous': '⚠️ 方向符号不明确：存在无法识别的方向标记',
    'time_gap': '⚠️ 时间间隔异常：记录之间存在过大的时间间隔',
    'time_out_of_order': '⚠️ 时间顺序异常：记录未按时间先后排列',
    'empty_value': '⚠️ 空值检测：存在缺失数据',
    'duplicate_record': '⚠️ 重复记录：存在完全相同的数据行',
    'boundary_value': '⚠️ 边界值警告：数值接近设备量程边界',
    'conflict_wechat': '⚖️ 数据冲突：导入数据与微信群记录存在差异'
}
