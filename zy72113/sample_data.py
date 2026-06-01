from datetime import datetime, timedelta
from typing import List

from data_models import AirExchangeRecord, Direction, DataSource


def create_normal_records() -> List[AirExchangeRecord]:
    base_time = datetime(2026, 6, 1, 9, 0)
    return [
        AirExchangeRecord(
            record_id="EXP-2026-001",
            measure_time=base_time + timedelta(minutes=0),
            location="洁净室A区-送风口",
            direction=Direction.SUPPLY,
            air_volume=3500.0,
            unit="m³/h",
            time_interval_min=30,
            source=DataSource.EXPERIMENT_TABLE,
            photo_desc="照片编号IMG_001：送风口风速仪读数稳定",
            working_condition="系统正常运行，初中效压差正常",
            wechat_notes=None,
            raw_wechat_content=None,
        ),
        AirExchangeRecord(
            record_id="EXP-2026-002",
            measure_time=base_time + timedelta(minutes=30),
            location="洁净室A区-送风口",
            direction=Direction.SUPPLY,
            air_volume=3620.0,
            unit="m³/h",
            time_interval_min=30,
            source=DataSource.EXPERIMENT_TABLE,
            photo_desc="照片编号IMG_002：读数3620",
            working_condition="运行工况稳定",
        ),
        AirExchangeRecord(
            record_id="EXP-2026-003",
            measure_time=base_time + timedelta(minutes=60),
            location="洁净室A区-送风口",
            direction=Direction.SUPPLY,
            air_volume=3480.0,
            unit="m³/h",
            time_interval_min=30,
            source=DataSource.EXPERIMENT_TABLE,
            photo_desc="照片编号IMG_003",
            working_condition="正常",
        ),
    ]


def create_smooth_record() -> AirExchangeRecord:
    return AirExchangeRecord(
        record_id="EXP-2026-001",
        measure_time=datetime(2026, 6, 1, 9, 0),
        location="洁净室A区-送风口",
        direction=Direction.SUPPLY,
        air_volume=3500.0,
        unit="m³/h",
        time_interval_min=30,
        source=DataSource.EXPERIMENT_TABLE,
        photo_desc="照片编号IMG_001：送风口风速仪读数稳定，3500m³/h",
        working_condition="系统正常运行，初中效压差200Pa/150Pa，在正常范围",
        wechat_notes=None,
        raw_wechat_content=None,
    )


def create_manual_check_record() -> AirExchangeRecord:
    return AirExchangeRecord(
        record_id="EXP-2026-004",
        measure_time=datetime(2026, 6, 1, 10, 30),
        location="洁净室B区-排风口",
        direction=Direction.EXHAUST,
        air_volume=1200.0,
        unit="m3/h",
        time_interval_min=45,
        source=DataSource.PHOTO_NOTE,
        photo_desc="照片模糊，数字疑似1200，也可能是1700",
        working_condition=None,
        wechat_notes="林老师备注：这个点当时风速仪好像没电了，读数可能不准",
        raw_wechat_content=None,
    )


def create_wechat_supplement_record() -> AirExchangeRecord:
    return AirExchangeRecord(
        record_id="WX-2026-001",
        measure_time=datetime(2026, 5, 28, 14, 15),
        location="洁净室C区-回风",
        direction=Direction.RECIRCULATE,
        air_volume=2800.0,
        unit="m³/h",
        time_interval_min=60,
        source=DataSource.WECHAT_GROUP,
        photo_desc="从微信群下载的照片，拍摄角度偏斜",
        working_condition="5月28日下午2点左右C区回风机故障重启后测量",
        wechat_notes="旧口径：当时按老方法算的是2800，新算法要重新算一遍；那天老王说好像有问题但没记下来",
        raw_wechat_content="[2026-05-28 14:32] 张工：C区回风刚才测了一下大概2800左右\n[2026-05-28 14:35] 李师傅：不对吧，我看风机转速不对啊\n[2026-05-28 14:36] 张工：那怎么办，反正先记下来，回头林老师复盘再说\n[2026-05-28 14:38] 林老师：好的先存着，这个点可能有问题，下次复测",
    )


def create_low_extreme_record() -> AirExchangeRecord:
    return AirExchangeRecord(
        record_id="EXP-2026-LOW",
        measure_time=datetime(2026, 6, 1, 11, 0),
        location="洁净室A区-送风口",
        direction=Direction.SUPPLY,
        air_volume=800.0,
        unit="m³/h",
        time_interval_min=30,
        source=DataSource.EXPERIMENT_TABLE,
        photo_desc="照片编号IMG_004：读数突然掉到800",
        working_condition="11点左右送风机异响后恢复，怀疑是变频器波动",
    )


def create_high_extreme_record() -> AirExchangeRecord:
    return AirExchangeRecord(
        record_id="EXP-2026-HIGH",
        measure_time=datetime(2026, 6, 1, 11, 30),
        location="洁净室A区-送风口",
        direction=Direction.SUPPLY,
        air_volume=6000.0,
        unit="m³/h",
        time_interval_min=30,
        source=DataSource.EXPERIMENT_TABLE,
        photo_desc="照片编号IMG_005：读数跳到6000后回落",
        working_condition="风机调试中，人为调大风量测试",
    )


def create_empty_value_record() -> AirExchangeRecord:
    return AirExchangeRecord(
        record_id="EXP-2026-EMPTY",
        measure_time=datetime(2026, 6, 1, 12, 0),
        location="洁净室D区",
        direction=Direction.UNKNOWN,
        air_volume=None,
        unit="",
        time_interval_min=None,
        source=DataSource.MANUAL_SUPPLEMENT,
        photo_desc=None,
        working_condition=None,
        wechat_notes="D区的记录没找到，只记得测过",
        raw_wechat_content=None,
    )


def create_duplicate_record() -> AirExchangeRecord:
    return AirExchangeRecord(
        record_id="EXP-2026-001-DUP",
        measure_time=datetime(2026, 6, 1, 9, 0),
        location="洁净室A区-送风口",
        direction=Direction.SUPPLY,
        air_volume=3510.0,
        unit="m³/h",
        time_interval_min=30,
        source=DataSource.EXPERIMENT_TABLE,
        photo_desc="另一张照片，同一时间点的读数",
        working_condition="同一时间另一人测量",
    )


def create_boundary_record() -> AirExchangeRecord:
    return AirExchangeRecord(
        record_id="EXP-2026-BOUNDARY",
        measure_time=datetime(2026, 6, 1, 12, 30),
        location="洁净室E区-排风口",
        direction=Direction.EXHAUST,
        air_volume=45000.0,
        unit="m³/h",
        time_interval_min=5,
        source=DataSource.WORKING_CONDITION,
        photo_desc="量程上限附近的读数",
        working_condition="大风量测试，时间间隔5分钟",
        wechat_notes="这个值接近量程上限，时间间隔也是最小的5分钟",
        raw_wechat_content="[2026-06-01 12:35] 王工：E区排风最大测到45000，仪器到头了\n[2026-06-01 12:36] 林老师：先记下来，注意这是边界值",
    )


def create_all_sample_records() -> List[AirExchangeRecord]:
    return [
        create_smooth_record(),
        create_normal_records()[1],
        create_normal_records()[2],
        create_low_extreme_record(),
        create_high_extreme_record(),
        create_manual_check_record(),
        create_wechat_supplement_record(),
        create_empty_value_record(),
        create_duplicate_record(),
        create_boundary_record(),
    ]


def create_demo_analysis_set() -> List[AirExchangeRecord]:
    base_time = datetime(2026, 6, 1, 9, 0)
    return [
        AirExchangeRecord(
            record_id="DEMO-001",
            measure_time=base_time,
            location="洁净室A-送风",
            direction=Direction.SUPPLY,
            air_volume=3500.0,
            unit="m³/h",
            time_interval_min=30,
            source=DataSource.EXPERIMENT_TABLE,
            photo_desc="IMG_001: 读数3500，仪器显示正常",
            working_condition="系统运行平稳，压差210Pa",
        ),
        AirExchangeRecord(
            record_id="DEMO-002",
            measure_time=base_time + timedelta(minutes=30),
            location="洁净室A-送风",
            direction=Direction.SUPPLY,
            air_volume=3600.0,
            unit="m³/h",
            time_interval_min=30,
            source=DataSource.EXPERIMENT_TABLE,
            photo_desc="IMG_002: 读数3600",
            working_condition="正常运行",
        ),
        AirExchangeRecord(
            record_id="DEMO-003",
            measure_time=base_time + timedelta(minutes=60),
            location="洁净室A-送风",
            direction=Direction.SUPPLY,
            air_volume=900.0,
            unit="m³/h",
            time_interval_min=30,
            source=DataSource.EXPERIMENT_TABLE,
            photo_desc="IMG_003: 读数掉到900，风机有异响",
            working_condition="10:00左右风机变频器报警，自动重启",
        ),
        AirExchangeRecord(
            record_id="DEMO-004",
            measure_time=base_time + timedelta(minutes=90),
            location="洁净室A-送风",
            direction=Direction.SUPPLY,
            air_volume=3550.0,
            unit="m³/h",
            time_interval_min=30,
            source=DataSource.EXPERIMENT_TABLE,
            photo_desc="IMG_004: 恢复正常",
            working_condition="重启后恢复正常运行",
        ),
        AirExchangeRecord(
            record_id="DEMO-005",
            measure_time=base_time + timedelta(minutes=120),
            location="洁净室A-送风",
            direction=Direction.SUPPLY,
            air_volume=3480.0,
            unit="m³/h",
            time_interval_min=30,
            source=DataSource.EXPERIMENT_TABLE,
            photo_desc="IMG_005",
            working_condition="稳定运行",
        ),
        AirExchangeRecord(
            record_id="DEMO-006",
            measure_time=base_time + timedelta(minutes=150),
            location="洁净室A-送风",
            direction=Direction.SUPPLY,
            air_volume=3520.0,
            unit="m³/h",
            time_interval_min=30,
            source=DataSource.PHOTO_NOTE,
            photo_desc="照片有点糊，大概3520左右",
            working_condition=None,
            wechat_notes="林老师说这个点要再确认一下照片",
        ),
        AirExchangeRecord(
            record_id="DEMO-007",
            measure_time=datetime(2026, 5, 28, 14, 0),
            location="洁净室A-送风",
            direction=Direction.RECIRCULATE,
            air_volume=2800.0,
            unit="m³/h",
            time_interval_min=60,
            source=DataSource.WECHAT_GROUP,
            photo_desc="微信群下载的照片，5月28日测的",
            working_condition="5月28日回风机故障重启后",
            wechat_notes="旧口径：上次按2800算的，这次用新方法重新算。当时张工说好像不对",
            raw_wechat_content="[2026-05-28 14:32] 张工：A区回风刚才测了一下大概2800左右\n[2026-05-28 14:35] 李师傅：不对吧，我听风机声音不对\n[2026-05-28 14:36] 张工：那先记2800，回头林老师再说\n[2026-05-28 14:38] 林老师：好的先存着，这个点标出来下次复测",
        ),
    ]


ROOM_VOLUME = 180.0
