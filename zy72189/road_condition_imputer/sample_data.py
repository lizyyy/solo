SMOOTH_SAMPLES = [
    {
        "record_id": "RC-001",
        "timestamp": "2025-06-01T08:00:00",
        "road_segment": "G15-段A",
        "congestion_level": 3.5,
        "weather": "晴",
        "temperature": 28.0,
        "surface_condition": "干燥",
        "traffic_volume": 1200,
        "source": "传感器自动采集",
    },
    {
        "record_id": "RC-002",
        "timestamp": "2025-06-01T09:00:00",
        "road_segment": "G15-段A",
        "congestion_level": None,
        "weather": "晴",
        "temperature": 29.0,
        "surface_condition": "干燥",
        "traffic_volume": 1350,
        "source": "传感器自动采集",
    },
    {
        "record_id": "RC-003",
        "timestamp": "2025-06-01T10:00:00",
        "road_segment": "G15-段A",
        "congestion_level": 4.2,
        "weather": "晴",
        "temperature": 30.5,
        "surface_condition": "干燥",
        "traffic_volume": 1500,
        "source": "传感器自动采集",
    },
]

REWORK_SAMPLES = [
    {
        "record_id": "RC-004",
        "timestamp": "2025-06-01T11:00:00",
        "road_segment": "G15-段B",
        "congestion_level": None,
        "weather": None,
        "temperature": None,
        "surface_condition": None,
        "traffic_volume": None,
        "source": "人工上报",
    },
    {
        "record_id": "RC-005",
        "timestamp": "2025-06-01T12:00:00",
        "road_segment": "G15-段B",
        "congestion_level": 6.8,
        "weather": "雨",
        "temperature": 22.0,
        "surface_condition": "湿滑",
        "traffic_volume": 800,
        "source": "传感器自动采集",
    },
]

DIRTY_SAMPLES = [
    {
        "record_id": "",
        "timestamp": "2025-06-01T13:00:00",
        "road_segment": "G15-段C",
        "congestion_level": 2.0,
        "weather": "阴",
        "temperature": 25.0,
        "surface_condition": "干燥",
        "traffic_volume": 900,
        "source": "第三方导入",
    },
    {
        "record_id": "RC-003",
        "timestamp": "2025-06-01T10:00:00",
        "road_segment": "G15-段A",
        "congestion_level": 4.2,
        "weather": "晴",
        "temperature": 30.5,
        "surface_condition": "干燥",
        "traffic_volume": 1500,
        "source": "传感器自动采集",
    },
    {
        "record_id": "RC-006",
        "timestamp": None,
        "road_segment": None,
        "congestion_level": None,
        "weather": None,
        "temperature": None,
        "surface_condition": None,
        "traffic_volume": None,
        "source": "异常数据源",
    },
    {
        "record_id": "RC-007",
        "timestamp": "2025-06-01T14:00:00",
        "road_segment": "G15-段A",
        "congestion_level": 15.0,
        "weather": "晴",
        "temperature": 27.0,
        "surface_condition": "干燥",
        "traffic_volume": -100,
        "source": "传感器故障",
    },
]


def get_all_sample_data():
    return SMOOTH_SAMPLES + REWORK_SAMPLES + DIRTY_SAMPLES


def get_rerun_sample_data():
    return SMOOTH_SAMPLES + [
        {
            "record_id": "RC-004",
            "timestamp": "2025-06-01T11:00:00",
            "road_segment": "G15-段B",
            "congestion_level": 5.5,
            "weather": "阴",
            "temperature": 24.0,
            "surface_condition": "潮湿",
            "traffic_volume": 950,
            "source": "人工上报(修正后)",
        },
        {
            "record_id": "RC-005",
            "timestamp": "2025-06-01T12:00:00",
            "road_segment": "G15-段B",
            "congestion_level": 6.8,
            "weather": "雨",
            "temperature": 22.0,
            "surface_condition": "湿滑",
            "traffic_volume": 800,
            "source": "传感器自动采集",
        },
    ]
