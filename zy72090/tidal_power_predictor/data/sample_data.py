from datetime import datetime, timedelta
from ..core.calculator import TidalPredictionInput


def create_sample_dataset() -> list:
    base_time = datetime(2024, 6, 15, 8, 0, 0)
    
    samples = []

    samples.append(TidalPredictionInput(
        record_id="TIDAL-2024-001",
        timestamp=base_time,
        station_name="象山港潮汐电站",
        tidal_range=5.2,
        tidal_range_unit="m",
        flow_rate=850,
        flow_rate_unit="m³/s",
        turbine_efficiency=0.82,
        data_source="manual",
        notes="大潮期，数据采集完整"
    ))

    samples.append(TidalPredictionInput(
        record_id="TIDAL-2024-002",
        timestamp=base_time + timedelta(hours=6),
        station_name="象山港潮汐电站",
        tidal_range=0.3,
        tidal_range_unit="m",
        flow_rate=850,
        flow_rate_unit="m³/s",
        turbine_efficiency=0.82,
        data_source="manual",
        notes="小潮期，潮差接近下限，需要确认"
    ))

    samples.append(TidalPredictionInput(
        record_id="TIDAL-2024-003",
        timestamp=base_time + timedelta(hours=12),
        station_name="三门湾潮汐电站",
        tidal_range=18.5,
        tidal_range_unit="英尺",
        flow_rate=3000000,
        flow_rate_unit="l/min",
        turbine_efficiency=0.85,
        data_source="old_portal",
        notes="从老板旧汇总页导出，单位混用，口径需要核对"
    ))

    samples.append(TidalPredictionInput(
        record_id="TIDAL-2024-004",
        timestamp=base_time + timedelta(hours=18),
        station_name="",
        tidal_range=None,
        flow_rate=None,
        data_source="manual",
        notes="这条记录缺了好多数据"
    ))

    samples.append(TidalPredictionInput(
        record_id="TIDAL-2024-005",
        timestamp=base_time + timedelta(days=1),
        station_name="乐清湾潮汐电站",
        tidal_range=6.8,
        tidal_range_unit="m",
        flow_rate=None,
        water_velocity=2.5,
        water_velocity_unit="m/s",
        cross_sectional_area=450,
        cross_sectional_area_unit="m²",
        turbine_efficiency=0.78,
        data_source="manual",
        notes="只有流速和面积数据，用动能法算"
    ))

    samples.append(TidalPredictionInput(
        record_id="TIDAL-2024-006",
        timestamp=base_time + timedelta(days=1, hours=6),
        station_name="象山港潮汐电站",
        tidal_range=5.2,
        tidal_range_unit="m",
        flow_rate=850,
        flow_rate_unit="m³/s",
        turbine_efficiency=0.82,
        data_source="manual",
        notes="这条和TIDAL-2024-001几乎一样，疑似重复录入"
    ))

    samples.append(TidalPredictionInput(
        record_id="TIDAL-2024-007",
        timestamp=base_time + timedelta(days=2),
        station_name="温州湾潮汐电站",
        tidal_range=750,
        tidal_range_unit="cm",
        flow_rate=1200,
        flow_rate_unit="m³/s",
        turbine_efficiency=1.2,
        data_source="manual",
        notes="效率值看起来有问题，潮差单位是厘米"
    ))

    samples.append(TidalPredictionInput(
        record_id="TIDAL-2024-008",
        timestamp=base_time + timedelta(days=2, hours=6),
        station_name="舟山潮汐试验站",
        tidal_range=-2.5,
        tidal_range_unit="m",
        flow_rate=500,
        flow_rate_unit="m³/s",
        turbine_efficiency=0.8,
        data_source="manual",
        notes="潮差是负数？数据采集可能有bug"
    ))

    return samples


def get_sample_data_summary() -> str:
    summary = """
=== 潮汐发电功率预测 - 样例数据说明 ===

本次准备了 8 条测试记录，覆盖以下场景：

【顺利通过组】
1. TIDAL-2024-001 - 完美数据，大潮期，一切正常
2. TIDAL-2024-005 - 用流速+面积计算，动能法

【需要人工确认组】
3. TIDAL-2024-002 - 潮差偏小（0.3m），接近经济下限
4. TIDAL-2024-007 - 效率120%明显不对，潮差单位是厘米
5. TIDAL-2024-006 - 和第1条几乎一样，可能重复

【旧口径/旧系统数据组】
6. TIDAL-2024-003 - 从老板旧汇总页导出，英尺+升/分钟单位混用

【计算失败组】
7. TIDAL-2024-004 - 测站名称空，数据都缺
8. TIDAL-2024-008 - 潮差是负数，肯定有问题

每条记录算不出来的都会标清楚原因，
不会悄悄从统计表里消失的，请放心！
"""
    return summary
