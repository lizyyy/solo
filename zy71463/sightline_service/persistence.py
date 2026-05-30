import json
import os
from datetime import datetime
from models import Seat, Stage, Obstruction, ObstructionType, SightlineScoreRecord, RecordStatus, PriceTier
from store import RecordStore


SEAT_MAP: dict[str, Seat] = {}
STAGE_MAP: dict[str, Stage] = {}
OBSTRUCTION_MAP: dict[str, Obstruction] = {}


def _init_seat_map():
    rows = 10
    cols = 20
    for r in range(1, rows + 1):
        for c in range(1, cols + 1):
            sid = f"R{r:02d}C{c:02d}"
            SEAT_MAP[sid] = Seat(
                seat_id=sid,
                row=r,
                col=c,
                x=(c - 10.5) * 1.2,
                y=r * 2.5 + 5,
                elevation=r * 0.4,
                section="A区" if c <= 7 else ("B区" if c <= 14 else "C区"),
            )


def _init_stage_map():
    STAGE_MAP["STG-001"] = Stage(
        stage_id="STG-001",
        width=16.0,
        depth=10.0,
        height=1.2,
        center_x=0.0,
        center_y=0.0,
    )


def _init_obstruction_map():
    OBSTRUCTION_MAP["OBS-001"] = Obstruction(
        obstruction_id="OBS-001",
        obs_type=ObstructionType.PILLAR,
        x=-4.0,
        y=8.0,
        radius=0.6,
        height=3.5,
        description="左侧承重柱",
    )
    OBSTRUCTION_MAP["OBS-002"] = Obstruction(
        obstruction_id="OBS-002",
        obs_type=ObstructionType.PILLAR,
        x=4.0,
        y=8.0,
        radius=0.6,
        height=3.5,
        description="右侧承重柱",
    )
    OBSTRUCTION_MAP["OBS-003"] = Obstruction(
        obstruction_id="OBS-003",
        obs_type=ObstructionType.RAILING,
        x=0.0,
        y=6.0,
        radius=0.3,
        height=1.0,
        description="二层护栏",
    )
    OBSTRUCTION_MAP["OBS-004"] = Obstruction(
        obstruction_id="OBS-004",
        obs_type=ObstructionType.EQUIPMENT,
        x=2.0,
        y=3.0,
        radius=0.8,
        height=2.0,
        description="音响设备",
    )


DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RECORDS_FILE = os.path.join(DATA_DIR, "records.json")
SEATS_FILE = os.path.join(DATA_DIR, "seats.json")
STAGES_FILE = os.path.join(DATA_DIR, "stages.json")
OBSTRUCTIONS_FILE = os.path.join(DATA_DIR, "obstructions.json")


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def save_store(store: RecordStore):
    _ensure_data_dir()
    records_data = {}
    for rid, rec in store.records.items():
        records_data[rid] = rec.model_dump(mode="json")
    with open(RECORDS_FILE, "w", encoding="utf-8") as f:
        json.dump(records_data, f, ensure_ascii=False, indent=2, default=str)


def load_store() -> RecordStore:
    _init_seat_map()
    _init_stage_map()
    _init_obstruction_map()

    store = RecordStore()

    if os.path.exists(RECORDS_FILE):
        with open(RECORDS_FILE, "r", encoding="utf-8") as f:
            records_data = json.load(f)
        for rid, data in records_data.items():
            data["created_at"] = datetime.fromisoformat(data["created_at"]) if isinstance(data["created_at"], str) else data["created_at"]
            data["updated_at"] = datetime.fromisoformat(data["updated_at"]) if isinstance(data["updated_at"], str) else data["updated_at"]
            record = SightlineScoreRecord(**data)
            store.records[rid] = record
            key = f"{record.stage_id}:{record.seat_id}"
            store.seat_index[key] = rid
        max_num = 0
        for rid in store.records:
            try:
                num = int(rid.split("-")[1])
                if num > max_num:
                    max_num = num
            except (IndexError, ValueError):
                pass
        store._counter = max_num

    return store


def load_sample_data(store: RecordStore):
    from scoring import compute_sightline_score, compute_price_tier, compute_price_range
    from models import SightlineScoreCreate

    _normal_seats = ["R01C10", "R01C11", "R03C05", "R05C10", "R07C15", "R10C10"]
    for sid in _normal_seats:
        seat = SEAT_MAP.get(sid)
        stage = STAGE_MAP["STG-001"]
        obstructions = list(OBSTRUCTION_MAP.values())
        if not seat:
            continue
        score = compute_sightline_score(seat, stage, obstructions)
        tier = compute_price_tier(score)
        pmin, pmax = compute_price_range(tier)
        obs_ids = []
        for obs in obstructions:
            from scoring import is_obstruction_blocking
            if is_obstruction_blocking(seat, stage, obs):
                obs_ids.append(obs.obstruction_id)

        data = SightlineScoreCreate(
            seat_id=sid,
            stage_id="STG-001",
            score=score,
            price_tier=tier,
            price_min=pmin,
            price_max=pmax,
            obstruction_ids=obs_ids,
        )
        store.create_record(data, SEAT_MAP, STAGE_MAP, OBSTRUCTION_MAP)

    _missing_field_seat = "R02C03"
    data = SightlineScoreCreate(
        seat_id=_missing_field_seat,
        stage_id="STG-001",
        score=None,
        price_tier=PriceTier.B,
        price_min=None,
        price_max=580.0,
        obstruction_ids=["OBS-001"],
        notes="提交时缺少score和price_min",
    )
    store.create_record(data, SEAT_MAP, STAGE_MAP, OBSTRUCTION_MAP)

    _wrong_price_seat = "R04C08"
    data = SightlineScoreCreate(
        seat_id=_wrong_price_seat,
        stage_id="STG-001",
        score=45.0,
        price_tier=PriceTier.VIP,
        price_min=50.0,
        price_max=200.0,
        obstruction_ids=[],
        notes="票价区间与VIP等级不匹配",
    )
    store.create_record(data, SEAT_MAP, STAGE_MAP, OBSTRUCTION_MAP)

    _dup_seat = "R05C10"
    data = SightlineScoreCreate(
        seat_id=_dup_seat,
        stage_id="STG-001",
        score=60.0,
        price_tier=PriceTier.B,
        price_min=380.0,
        price_max=580.0,
        obstruction_ids=[],
        notes="重复提交的座位",
    )
    store.create_record(data, SEAT_MAP, STAGE_MAP, OBSTRUCTION_MAP)

    _supplement_seat = "R06C12"
    data_supplement = SightlineScoreCreate(
        seat_id=_supplement_seat,
        stage_id="STG-001",
        score=72.0,
        price_tier=PriceTier.A,
        price_min=580.0,
        price_max=880.0,
        obstruction_ids=["OBS-002"],
        notes="补录记录，现场复核后补充",
        is_supplement=True,
        supplement_for=None,
    )
    store.create_record(data_supplement, SEAT_MAP, STAGE_MAP, OBSTRUCTION_MAP)

    _withdraw_seat = "R08C06"
    data = SightlineScoreCreate(
        seat_id=_withdraw_seat,
        stage_id="STG-001",
        score=55.0,
        price_tier=PriceTier.B,
        price_min=380.0,
        price_max=580.0,
        obstruction_ids=["OBS-003"],
    )
    rec = store.create_record(data, SEAT_MAP, STAGE_MAP, OBSTRUCTION_MAP)
    store.withdraw_record(rec.record_id, reason="座位已被拆除，需重新测量")

    _modified_notes_seat = "R03C05"
    existing = store.seat_index.get(f"STG-001:{_modified_notes_seat}")
    if existing:
        from models import SightlineScoreUpdate
        store.update_record(
            existing,
            SightlineScoreUpdate(notes="首次录入后修改备注：观众反映该座位左侧有柱子部分遮挡"),
        )

    return store


def get_seat_map() -> dict[str, Seat]:
    if not SEAT_MAP:
        _init_seat_map()
    return SEAT_MAP


def get_stage_map() -> dict[str, Stage]:
    if not STAGE_MAP:
        _init_stage_map()
    return STAGE_MAP


def get_obstruction_map() -> dict[str, Obstruction]:
    if not OBSTRUCTION_MAP:
        _init_obstruction_map()
    return OBSTRUCTION_MAP
