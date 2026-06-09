from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class PetRecord:
    record_id: str
    pet_alias: str
    pet_id: Optional[str] = None
    species: str = ""
    breed: str = ""
    gender: str = ""
    birth_date: Optional[str] = None
    owner_name: str = ""
    owner_phone: str = ""


@dataclass
class VaccinePhoto:
    photo_id: str
    record_id: str
    upload_time: str
    photo_path: str
    ocr_text: str = ""
    vaccine_name: str = ""
    vaccine_date: Optional[str] = None
    next_due_date: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: str = "kg"
    vet_signature: str = ""
    hospital_stamp: bool = False
    manual_remark: str = ""


@dataclass
class MedicationReminder:
    reminder_id: str
    record_id: str
    drug_name: str
    dosage: str
    frequency: str
    start_date: str
    duration_days: int
    note: str = ""
    need_human_remind: bool = True
    check_needed: bool = True


@dataclass
class WeightCheckItem:
    item_id: str
    record_id: str
    check_date: str
    current_weight: float
    target_weight: float
    weight_unit: str = "kg"
    bcs_score: Optional[int] = None
    diet_adjusted: bool = False
    exercise_plan: bool = False
    vet_confirmation: bool = False
    recheck_scheduled: Optional[str] = None


@dataclass
class ReviewHistory:
    history_id: str
    record_id: str
    version: int
    action: str
    operator: str
    timestamp: str
    old_snapshot: dict = field(default_factory=dict)
    new_snapshot: dict = field(default_factory=dict)
    change_reason: str = ""
    attached_evidence: list = field(default_factory=list)


def _ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


SAMPLE_PETS: list[PetRecord] = [
    PetRecord(
        record_id="PET-2025-0612-001",
        pet_alias="豆豆",
        pet_id="P2025061201",
        species="犬",
        breed="柯基",
        gender="公",
        birth_date="2022-03-15",
        owner_name="李建国",
        owner_phone="138****5678",
    ),
    PetRecord(
        record_id="PET-2025-0612-002",
        pet_alias="豆豆",
        pet_id=None,
        species="犬",
        breed="金毛",
        gender="母",
        birth_date=None,
        owner_name="王小梅",
        owner_phone="139****1234",
    ),
    PetRecord(
        record_id="PET-2025-0612-003",
        pet_alias="肥仔",
        pet_id="P2025061203",
        species="猫",
        breed="英短蓝猫",
        gender="公",
        birth_date="2021-09-01",
        owner_name="张伟",
        owner_phone="137****9090",
    ),
    PetRecord(
        record_id="PET-2025-0612-004",
        pet_alias="Lucky",
        pet_id="P2025061204",
        species="犬",
        breed="柴犬",
        gender="母",
        birth_date="2023-01-18",
        owner_name="陈思雨",
        owner_phone="136****4321",
    ),
]

SAMPLE_VACCINE_PHOTOS: list[VaccinePhoto] = [
    VaccinePhoto(
        photo_id="PH-001",
        record_id="PET-2025-0612-001",
        upload_time="2025-05-20 10:15:32",
        photo_path="/vaccine/doudou_corgi_0520.jpg",
        ocr_text="狂犬疫苗 2025-05-20 下次2026-05-20 体重:12.8kg 医院章:有",
        vaccine_name="狂犬疫苗",
        vaccine_date="2025-05-20",
        next_due_date="2026-05-20",
        weight=12.8,
        vet_signature="王兽医",
        hospital_stamp=True,
    ),
    VaccinePhoto(
        photo_id="PH-002",
        record_id="PET-2025-0612-001",
        upload_time="2025-06-02 14:22:08",
        photo_path="/vaccine/doudou_corgi_0602.jpg",
        ocr_text="体重:11.5kg 减重记录-1.3kg 兽医签字:刘医生",
        vaccine_name="",
        vaccine_date=None,
        next_due_date=None,
        weight=11.5,
        vet_signature="刘医生",
        hospital_stamp=False,
    ),
    VaccinePhoto(
        photo_id="PH-003",
        record_id="PET-2025-0612-002",
        upload_time="2025-05-28 09:05:11",
        photo_path="/vaccine/doudou_golden_0528.jpg",
        ocr_text="六联疫苗 2025-05-28 体重:28.5kg",
        vaccine_name="六联疫苗",
        vaccine_date="2025-05-28",
        next_due_date="2026-05-28",
        weight=28.5,
        vet_signature="",
        hospital_stamp=False,
    ),
    VaccinePhoto(
        photo_id="PH-004",
        record_id="PET-2025-0612-003",
        upload_time="2025-04-10 16:40:55",
        photo_path="/vaccine/feizai_0410.jpg",
        ocr_text="猫三联 2025-04-10 下次2026-04-10 体重:7.2kg BCS=8",
        vaccine_name="猫三联",
        vaccine_date="2025-04-10",
        next_due_date="2026-04-10",
        weight=7.2,
        vet_signature="赵兽医",
        hospital_stamp=True,
    ),
    VaccinePhoto(
        photo_id="PH-005",
        record_id="PET-2025-0612-003",
        upload_time="2025-06-05 11:28:00",
        photo_path="/vaccine/feizai_0605.jpg",
        ocr_text="体重:6.4kg BCS=7 减重复诊",
        vaccine_name="",
        vaccine_date=None,
        next_due_date=None,
        weight=6.4,
        vet_signature="",
        hospital_stamp=False,
    ),
    VaccinePhoto(
        photo_id="PH-006",
        record_id="PET-2025-0612-004",
        upload_time="2025-05-15 13:12:30",
        photo_path="/vaccine/lucky_0515.jpg",
        ocr_text="狂犬疫苗 2025-05-15 体重:9.8kg 医院章:有",
        vaccine_name="狂犬疫苗",
        vaccine_date="2025-05-15",
        next_due_date="2026-05-15",
        weight=9.8,
        vet_signature="王兽医",
        hospital_stamp=True,
    ),
]

SAMPLE_MEDICATIONS: list[MedicationReminder] = [
    MedicationReminder(
        reminder_id="MED-001",
        record_id="PET-2025-0612-001",
        drug_name="利拉鲁肽注射液(犬用)",
        dosage="0.1mL/次",
        frequency="每日1次 皮下注射",
        start_date="2025-06-01",
        duration_days=30,
        note="需冷藏，注射前摇匀。第二周剂量调整需复诊确认。",
    ),
    MedicationReminder(
        reminder_id="MED-002",
        record_id="PET-2025-0612-003",
        drug_name="减重处方粮 Royal Canin Satiety",
        dosage="每日40g/餐 × 2餐",
        frequency="每日2次",
        start_date="2025-04-15",
        duration_days=90,
        note="严格控制零食，每日增加15分钟逗猫棒活动。",
    ),
    MedicationReminder(
        reminder_id="MED-003",
        record_id="PET-2025-0612-004",
        drug_name="关节保健片剂 Cosequin DS",
        dosage="1片/次",
        frequency="每日1次 饭后",
        start_date="2025-05-20",
        duration_days=60,
        note="预防性使用，与食物同服。",
    ),
]

SAMPLE_WEIGHT_CHECKS: list[WeightCheckItem] = [
    WeightCheckItem(
        item_id="WC-001",
        record_id="PET-2025-0612-001",
        check_date="2025-05-20",
        current_weight=12.8,
        target_weight=11.0,
        bcs_score=7,
        diet_adjusted=True,
        exercise_plan=False,
        vet_confirmation=True,
        recheck_scheduled="2025-06-10",
    ),
    WeightCheckItem(
        item_id="WC-002",
        record_id="PET-2025-0612-001",
        check_date="2025-06-02",
        current_weight=11.5,
        target_weight=11.0,
        bcs_score=6,
        diet_adjusted=True,
        exercise_plan=True,
        vet_confirmation=False,
        recheck_scheduled="2025-07-01",
    ),
    WeightCheckItem(
        item_id="WC-003",
        record_id="PET-2025-0612-003",
        check_date="2025-04-10",
        current_weight=7.2,
        target_weight=5.5,
        bcs_score=8,
        diet_adjusted=True,
        exercise_plan=False,
        vet_confirmation=True,
        recheck_scheduled="2025-05-15",
    ),
    WeightCheckItem(
        item_id="WC-004",
        record_id="PET-2025-0612-003",
        check_date="2025-06-05",
        current_weight=6.4,
        target_weight=5.5,
        bcs_score=7,
        diet_adjusted=True,
        exercise_plan=True,
        vet_confirmation=True,
        recheck_scheduled="2025-07-20",
    ),
    WeightCheckItem(
        item_id="WC-005",
        record_id="PET-2025-0612-004",
        check_date="2025-05-15",
        current_weight=9.8,
        target_weight=9.0,
        bcs_score=6,
        diet_adjusted=True,
        exercise_plan=True,
        vet_confirmation=True,
        recheck_scheduled="2025-06-30",
    ),
]

SAMPLE_INITIAL_HISTORY: list[ReviewHistory] = [
    ReviewHistory(
        history_id=uuid.uuid4().hex[:8],
        record_id="PET-2025-0612-001",
        version=1,
        action="首次录入",
        operator="系统",
        timestamp="2025-06-02 15:00:00",
        old_snapshot={},
        new_snapshot={
            "conclusion": "减重进行中，效果待确认",
            "flags": ["缺运动计划确认", "6月2日复诊缺医院章"],
        },
        change_reason="初检建档",
        attached_evidence=["PH-001", "PH-002", "WC-001", "WC-002"],
    ),
    ReviewHistory(
        history_id=uuid.uuid4().hex[:8],
        record_id="PET-2025-0612-003",
        version=1,
        action="首次录入",
        operator="系统",
        timestamp="2025-06-05 12:00:00",
        old_snapshot={},
        new_snapshot={
            "conclusion": "减重效果良好，持续跟踪",
            "flags": ["6月5日照片缺兽医签字"],
        },
        change_reason="初检建档",
        attached_evidence=["PH-004", "PH-005", "WC-003", "WC-004"],
    ),
]
