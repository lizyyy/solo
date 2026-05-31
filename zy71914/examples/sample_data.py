"""示例数据 - 广告口播表和原始音轨"""

AD_SPOTS = [
    {
        "name": "片头广告口播",
        "start_time": "00:00:00.000",
        "end_time": "00:00:15.500",
        "content": "欢迎收听本期课程，本节目由XX品牌独家冠名播出。",
        "speaker": "主持人A",
        "notes": "第5次录制版本"
    },
    {
        "name": "课程介绍",
        "start_time": "00:00:15.500",
        "end_time": "00:00:45.200",
        "content": "今天我们来学习Python编程的高级技巧，包括装饰器、生成器和上下文管理器。",
        "speaker": "讲师B",
        "notes": ""
    },
    {
        "name": "知识点1：装饰器",
        "start_time": "00:00:45.200",
        "end_time": "00:03:20.800",
        "content": "装饰器是Python中非常重要的概念，它允许我们在不修改原函数代码的情况下扩展函数的功能...",
        "speaker": "讲师B",
        "notes": "核心知识点，需重点标记"
    },
    {
        "name": "中场广告",
        "start_time": "00:03:20.800",
        "end_time": "00:03:35.000",
        "content": "感谢XX品牌对本节目的支持，现在购买可享受8折优惠。",
        "speaker": "主持人A",
        "notes": "必须保留，客户要求"
    },
    {
        "name": "知识点2：生成器",
        "start_time": "00:03:35.000",
        "end_time": "00:06:10.500",
        "content": "生成器是一种特殊的迭代器，使用yield关键字来返回值...",
        "speaker": "讲师B",
        "notes": ""
    },
    {
        "name": "知识点3：上下文管理器",
        "start_time": "00:06:10.500",
        "end_time": "00:08:45.300",
        "content": "上下文管理器用于资源管理，最常见的是with语句...",
        "speaker": "讲师B",
        "notes": "补充示例代码"
    },
    {
        "name": "片尾广告",
        "start_time": "00:08:45.300",
        "end_time": "00:09:00.000",
        "content": "感谢收听本期课程，下期再见！XX品牌，品质保证。",
        "speaker": "主持人A",
        "notes": "标准片尾"
    }
]

RAW_TRACKS = [
    {
        "name": "音轨_001_片头",
        "start_time": "00:00:00.000",
        "end_time": "00:00:15.500",
        "content": "欢迎收听本期课程，本节目由XX品牌独家冠名播出。",
        "transcript": "欢迎收听本期课程，本节目由XX品牌独家冠名播出。",
        "speaker": "主持人A",
        "is_silence": False,
        "silence_confidence": 0.0,
        "notes": "对应广告口播表第1条"
    },
    {
        "name": "音轨_002_课程介绍",
        "start_time": "00:00:15.500",
        "end_time": "00:00:45.200",
        "content": "今天我们来学习Python编程的高级技巧",
        "transcript": "今天我们来学习Python编程的高级技巧，包括装饰器、生成器和上下文管理器。",
        "speaker": "讲师B",
        "is_silence": False,
        "silence_confidence": 0.0,
        "notes": ""
    },
    {
        "name": "音轨_003_静音段1",
        "start_time": "00:00:45.200",
        "end_time": "00:00:47.500",
        "content": "",
        "transcript": "",
        "speaker": "",
        "is_silence": True,
        "silence_confidence": 0.95,
        "notes": "疑似剪辑错误，可能误删了内容"
    },
    {
        "name": "音轨_004_装饰器",
        "start_time": "00:00:47.500",
        "end_time": "00:03:23.100",
        "content": "装饰器是Python中非常重要的概念",
        "transcript": "装饰器是Python中非常重要的概念，它允许我们在不修改原函数代码的情况下扩展函数的功能...",
        "speaker": "讲师B",
        "is_silence": False,
        "silence_confidence": 0.0,
        "notes": "与广告口播表时间有偏差，漂移约2.3秒"
    },
    {
        "name": "音轨_005_中场广告",
        "start_time": "00:03:23.100",
        "end_time": "00:03:37.300",
        "content": "感谢XX品牌对本节目的支持",
        "transcript": "感谢XX品牌对本节目的支持，现在购买可享受8折优惠。",
        "speaker": "主持人A",
        "is_silence": False,
        "silence_confidence": 0.0,
        "notes": ""
    },
    {
        "name": "音轨_006_静音段2",
        "start_time": "00:03:37.300",
        "end_time": "00:03:39.000",
        "content": "",
        "transcript": "",
        "speaker": "",
        "is_silence": True,
        "silence_confidence": 0.88,
        "notes": "正常呼吸停顿，可保留"
    },
    {
        "name": "音轨_007_生成器",
        "start_time": "00:03:39.000",
        "end_time": "00:06:14.500",
        "content": "生成器是一种特殊的迭代器",
        "transcript": "生成器是一种特殊的迭代器，使用yield关键字来返回值...",
        "speaker": "讲师B",
        "is_silence": False,
        "silence_confidence": 0.0,
        "notes": ""
    },
    {
        "name": "音轨_008_静音段3",
        "start_time": "00:06:14.500",
        "end_time": "00:06:16.800",
        "content": "",
        "transcript": "",
        "speaker": "",
        "is_silence": True,
        "silence_confidence": 0.92,
        "notes": "可能误删了过渡语"
    },
    {
        "name": "音轨_009_上下文管理器",
        "start_time": "00:06:16.800",
        "end_time": "00:08:51.600",
        "content": "上下文管理器用于资源管理",
        "transcript": "上下文管理器用于资源管理，最常见的是with语句...",
        "speaker": "讲师B",
        "is_silence": False,
        "silence_confidence": 0.0,
        "notes": ""
    },
    {
        "name": "音轨_010_片尾",
        "start_time": "00:08:51.600",
        "end_time": "00:09:06.300",
        "content": "感谢收听本期课程",
        "transcript": "感谢收听本期课程，下期再见！XX品牌，品质保证。",
        "speaker": "主持人A",
        "is_silence": False,
        "silence_confidence": 0.0,
        "notes": ""
    }
]
