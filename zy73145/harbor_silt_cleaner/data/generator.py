import random
import uuid
from datetime import datetime, timedelta
from models.records import SiltRecord

STATIONS = ["北防波堤", "南航道", "东锚地", "西码头", "中转池"]
BASE_DEPTHS = {
    "北防波堤": 2.1,
    "南航道": 3.5,
    "东锚地": 1.8,
    "西码头": 2.8,
    "中转池": 4.2,
}


def _random_time(base_date, day_offset_range=(-15, 0)):
    days = random.randint(*day_offset_range)
    hours = random.randint(6, 20)
    minutes = random.randint(0, 59)
    t = base_date + timedelta(days=days, hours=hours, minutes=minutes)
    return t.strftime("%Y-%m-%d %H:%M")


def generate_raw_records(count=60, seed=42):
    random.seed(seed)
    base_date = datetime(2026, 6, 18)
    records = []

    for _ in range(count):
        station = random.choice(STATIONS)
        base = BASE_DEPTHS[station]
        silt_depth = round(base + random.uniform(-0.3, 0.5), 2)
        source = random.choice(["sensor_a", "sensor_b", "lab_result"])
        rec = SiltRecord(
            id=str(uuid.uuid4())[:8],
            station=station,
            measure_time=_random_time(base_date),
            silt_depth=silt_depth,
            source=source,
        )
        records.append(rec)

    for _ in range(4):
        station = random.choice(STATIONS)
        base = BASE_DEPTHS[station]
        silt_depth = round(base + random.uniform(-0.8, -0.4), 2)
        rec = SiltRecord(
            id=str(uuid.uuid4())[:8],
            station=station,
            measure_time=_random_time(base_date, (-30, -16)),
            silt_depth=silt_depth,
            source="lab_result_old",
        )
        records.append(rec)

    drift_count = 3
    drift_stations = random.sample(STATIONS, drift_count)
    for st in drift_stations:
        base = BASE_DEPTHS[st]
        drift_val = round(base + random.uniform(1.2, 1.8), 2)
        rec = SiltRecord(
            id=str(uuid.uuid4())[:8],
            station=st,
            measure_time=_random_time(base_date, (-5, -1)),
            silt_depth=drift_val,
            source=random.choice(["sensor_a", "sensor_b"]),
            drift_reason="传感器零点漂移",
            raw_value=drift_val,
        )
        records.append(rec)

    manual_count = 2
    for _ in range(manual_count):
        station = random.choice(STATIONS)
        base = BASE_DEPTHS[station]
        original = round(base + random.uniform(-0.2, 0.3), 2)
        override_val = round(original + random.choice([-0.5, 0.6]), 2)
        rec = SiltRecord(
            id=str(uuid.uuid4())[:8],
            station=station,
            measure_time=_random_time(base_date, (-3, -1)),
            silt_depth=override_val,
            source="manual_override",
            is_override=True,
            override_note="现场复核后修正，原淤积量偏差较大",
            raw_value=original,
        )
        records.append(rec)

    verbal_notes = [
        "老何口头说上周暴雨后北防波堤可能涨了0.2米",
        "调度室电话通知西码头疏浚后数据待核",
    ]
    for note in verbal_notes:
        station = random.choice(STATIONS)
        rec = SiltRecord(
            id=str(uuid.uuid4())[:8],
            station=station,
            measure_time=_random_time(base_date, (-2, 0)),
            silt_depth=BASE_DEPTHS[station] + 0.15,
            source="verbal_note",
            override_note=note,
        )
        records.append(rec)

    return records


if __name__ == "__main__":
    recs = generate_raw_records()
    for r in recs[:5]:
        print(r.to_dict())
