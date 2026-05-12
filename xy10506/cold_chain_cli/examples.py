from datetime import datetime, timedelta

from .models import (
    ProjectState,
    Sample,
    Box,
    HandoverRecord,
    TemperatureRecord,
    TemperatureUnit,
)


def load_normal_example(state: ProjectState) -> None:
    """
    样例 1: 合格运输
    - 所有数据完整
    - 温度记录连续且在正常范围内
    - 交接记录完整且有签字
    """
    base_time = datetime(2026, 5, 12, 8, 0, 0)

    box = Box(
        box_id="BOX-001",
        box_type="医用冷链箱",
        created_at=base_time,
    )
    state.boxes[box.box_id] = box

    for i in range(5):
        sample = Sample(
            sample_id=f"SAMPLE-{i+1:03d}",
            box_id=box.box_id,
            sample_type=["血液样本", "核酸样本", "血清样本", "咽拭子", "尿液样本"][i],
            collection_time=base_time - timedelta(minutes=30 + i * 5),
            expected_temperature_min=-20.0,
            expected_temperature_max=8.0,
        )
        state.samples[sample.sample_id] = sample

    for i in range(5):
        handover_time = base_time + timedelta(hours=i)
        from_person = ["张采集", "李运输", "王分拣", "赵复核", "孙接收"][i]
        to_person = ["李运输", "王分拣", "赵复核", "孙接收", "陈实验室"][i]
        location = ["采集点A", "运输中", "中转站B", "实验室入口", "检测中心"][i]

        record = HandoverRecord(
            box_id=box.box_id,
            from_person=from_person,
            to_person=to_person,
            handover_time=handover_time,
            location=location,
            signed=True,
            notes="交接正常",
        )
        state.handover_records.append(record)

    for i in range(25):
        timestamp = base_time + timedelta(minutes=i * 10)
        temp = 2.0 + (i * 0.1) % 4 - 2.0
        record = TemperatureRecord(
            box_id=box.box_id,
            timestamp=timestamp,
            temperature=temp,
            unit=TemperatureUnit.CELSIUS,
            device_id="TEMP-001",
            source_file="normal_temp.json",
        )
        state.temperature_records.append(record)


def load_short_overtemp_example(state: ProjectState) -> None:
    """
    样例 2: 短时超温
    - 数据完整
    - 有两段短时超温（各约 10 分钟）
    - 需要人工评估后决定
    """
    base_time = datetime(2026, 5, 12, 9, 0, 0)

    box = Box(
        box_id="BOX-002",
        box_type="生物安全运输箱",
        created_at=base_time,
    )
    state.boxes[box.box_id] = box

    for i in range(3):
        sample = Sample(
            sample_id=f"SAMPLE-10{i+1}",
            box_id=box.box_id,
            sample_type=["病毒样本", "抗体样本", "脑脊液"][i],
            collection_time=base_time - timedelta(hours=1 + i),
            expected_temperature_min=2.0,
            expected_temperature_max=8.0,
        )
        state.samples[sample.sample_id] = sample

    handover1 = HandoverRecord(
        box_id=box.box_id,
        from_person="周采集",
        to_person="吴运输",
        handover_time=base_time,
        location="医院采集点",
        signed=True,
    )
    handover2 = HandoverRecord(
        box_id=box.box_id,
        from_person="吴运输",
        to_person="郑接收",
        handover_time=base_time + timedelta(hours=3),
        location="检验中心",
        signed=True,
    )
    state.handover_records.extend([handover1, handover2])

    for i in range(20):
        timestamp = base_time + timedelta(minutes=i * 10)

        if 6 <= i <= 7:
            temp = 12.5 + (i - 6) * 0.5
        elif 12 <= i <= 13:
            temp = 14.0
        else:
            temp = 4.0 + (i * 0.05)

        record = TemperatureRecord(
            box_id=box.box_id,
            timestamp=timestamp,
            temperature=temp,
            unit=TemperatureUnit.CELSIUS,
            device_id="TEMP-002",
            source_file="short_overtemp.json",
        )
        state.temperature_records.append(record)


def load_long_gap_example(state: ProjectState) -> None:
    """
    样例 3: 长时间温度记录缺失
    - 中间有约 90 分钟没有温度记录
    - 严重违规，需要拒收或严格复核
    """
    base_time = datetime(2026, 5, 12, 10, 0, 0)

    box = Box(
        box_id="BOX-003",
        box_type="干冰运输箱",
        created_at=base_time,
    )
    state.boxes[box.box_id] = box

    for i in range(4):
        sample = Sample(
            sample_id=f"SAMPLE-20{i+1}",
            box_id=box.box_id,
            sample_type=["冷冻组织", "蛋白样本", "酶制剂", "细胞冻存"][i],
            collection_time=base_time - timedelta(hours=2),
            expected_temperature_min=-80.0,
            expected_temperature_max=-20.0,
        )
        state.samples[sample.sample_id] = sample

    handover1 = HandoverRecord(
        box_id=box.box_id,
        from_person="冯研究员",
        to_person="陈运输",
        handover_time=base_time,
        location="实验室A",
        signed=True,
    )
    handover2 = HandoverRecord(
        box_id=box.box_id,
        from_person="陈运输",
        to_person="褚接收",
        handover_time=base_time + timedelta(hours=4),
        location="实验室B",
        signed=True,
    )
    state.handover_records.extend([handover1, handover2])

    for i in range(8):
        timestamp = base_time + timedelta(minutes=i * 15)
        temp = -60.0 + (i * 0.5)
        record = TemperatureRecord(
            box_id=box.box_id,
            timestamp=timestamp,
            temperature=temp,
            unit=TemperatureUnit.CELSIUS,
            device_id="TEMP-003",
            source_file="long_gap_part1.json",
        )
        state.temperature_records.append(record)

    gap_start = base_time + timedelta(minutes=8 * 15)
    for i in range(8):
        timestamp = gap_start + timedelta(minutes=90 + i * 15)
        temp = -55.0 - (i * 0.5)
        record = TemperatureRecord(
            box_id=box.box_id,
            timestamp=timestamp,
            temperature=temp,
            unit=TemperatureUnit.CELSIUS,
            device_id="TEMP-003",
            source_file="long_gap_part2.json",
        )
        state.temperature_records.append(record)


def load_manual_example(state: ProjectState) -> None:
    """
    样例 4: 需要人工说明的复杂情况
    - 温度单位混用 (部分华氏度，部分摄氏度)
    - 有一个交接人缺签
    - 有重复温度文件
    - 适合演示人工修正功能
    """
    base_time = datetime(2026, 5, 12, 11, 0, 0)

    box1 = Box(
        box_id="BOX-004",
        box_type="冷链箱",
        created_at=base_time,
    )
    box2 = Box(
        box_id="BOX-005",
        box_type="低温箱",
        created_at=base_time,
    )
    state.boxes[box1.box_id] = box1
    state.boxes[box2.box_id] = box2

    for i in range(3):
        sample = Sample(
            sample_id=f"SAMPLE-30{i+1}",
            box_id=box1.box_id,
            sample_type=["粪便样本", "唾液样本", "痰液样本"][i],
            collection_time=base_time - timedelta(hours=1),
            expected_temperature_min=2.0,
            expected_temperature_max=10.0,
        )
        state.samples[sample.sample_id] = sample

    for i in range(2):
        sample = Sample(
            sample_id=f"SAMPLE-30{i+4}",
            box_id=box2.box_id,
            sample_type=["血浆", "RNA样本"][i],
            collection_time=base_time - timedelta(hours=2),
            expected_temperature_min=-20.0,
            expected_temperature_max=0.0,
        )
        state.samples[sample.sample_id] = sample

    handover1 = HandoverRecord(
        box_id=box1.box_id,
        from_person="卫护士",
        to_person="蒋运输",
        handover_time=base_time,
        location="医院急诊",
        signed=True,
    )
    handover2 = HandoverRecord(
        box_id=box1.box_id,
        from_person="蒋运输",
        to_person="沈接收",
        handover_time=base_time + timedelta(hours=2),
        location="检验科",
        signed=False,
        notes="接收人临时不在，由同事代签确认中",
    )
    handover3 = HandoverRecord(
        box_id=box2.box_id,
        from_person="韩医生",
        to_person="杨运输",
        handover_time=base_time + timedelta(minutes=30),
        location="住院部",
        signed=True,
    )
    state.handover_records.extend([handover1, handover2, handover3])

    for i in range(15):
        timestamp = base_time + timedelta(minutes=i * 8)
        temp = 5.0 + (i * 0.2)
        record = TemperatureRecord(
            box_id=box1.box_id,
            timestamp=timestamp,
            temperature=temp,
            unit=TemperatureUnit.CELSIUS,
            device_id="TEMP-004",
            source_file="manual_box4_celsius.json",
        )
        state.temperature_records.append(record)

    for i in range(10):
        timestamp = base_time + timedelta(minutes=30 + i * 10)
        temp = 23.0 + (i * 0.5)
        record = TemperatureRecord(
            box_id=box2.box_id,
            timestamp=timestamp,
            temperature=temp,
            unit=TemperatureUnit.FAHRENHEIT,
            device_id="TEMP-005-F",
            source_file="manual_box5_fahrenheit.json",
        )
        state.temperature_records.append(record)

    for i in range(5, 10):
        timestamp = base_time + timedelta(minutes=i * 8)
        temp = 5.0 + (i * 0.2)
        record = TemperatureRecord(
            box_id=box1.box_id,
            timestamp=timestamp,
            temperature=temp,
            unit=TemperatureUnit.CELSIUS,
            device_id="TEMP-004",
            source_file="manual_box4_celsius_duplicate.json",
        )
        state.temperature_records.append(record)


def load_all_examples(state: ProjectState) -> None:
    """加载所有示例到一个项目"""
    load_normal_example(state)
    load_short_overtemp_example(state)
    load_long_gap_example(state)
    load_manual_example(state)
