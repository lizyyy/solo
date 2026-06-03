import numpy as np
from typing import Dict, Any, List, Tuple
from fourier_noise.models import (
    Record,
    RecordType,
    ReviewStatus,
    TeacherAnnotation,
    SamplingEntry,
)


def generate_demo_signal() -> np.ndarray:
    np.random.seed(42)
    t = np.linspace(0, 4 * np.pi, 12)
    periodic = 5.0 * np.sin(t) + 2.0 * np.cos(2 * t)
    noise = np.random.normal(0, 0.3, len(t))
    return periodic + noise


def get_demo_records() -> List[Record]:
    signal = generate_demo_signal()

    return [
        Record(
            id="REC-001",
            timestamp=0.0,
            value=round(float(signal[0]), 4),
            old_table_value=round(float(signal[0]), 4),
            record_type=RecordType.NORMAL,
            review_status=ReviewStatus.CONFIRMED,
        ),
        Record(
            id="REC-002",
            timestamp=1.0,
            value=round(float(signal[1]), 4),
            old_table_value=round(float(signal[1]), 4),
            record_type=RecordType.NORMAL,
            review_status=ReviewStatus.CONFIRMED,
        ),
        Record(
            id="REC-003",
            timestamp=2.0,
            value=-3.2156,
            old_table_value=None,
            record_type=RecordType.NEGATIVE_AS_MISSING,
            review_status=ReviewStatus.PENDING,
        ),
        Record(
            id="REC-004",
            timestamp=3.0,
            value=round(float(signal[3]), 4),
            old_table_value=round(float(signal[3]), 4),
            record_type=RecordType.NORMAL,
            review_status=ReviewStatus.CONFIRMED,
        ),
        Record(
            id="REC-005",
            timestamp=4.0,
            value=-1.8734,
            old_table_value=None,
            record_type=RecordType.NEGATIVE_AS_MISSING,
            review_status=ReviewStatus.PENDING,
        ),
        Record(
            id="REC-006",
            timestamp=5.0,
            value=round(float(signal[5]), 4),
            old_table_value=None,
            record_type=RecordType.NORMAL,
            review_status=ReviewStatus.PENDING,
        ),
        Record(
            id="REC-007",
            timestamp=6.0,
            value=round(float(signal[6]), 4),
            old_table_value=round(float(signal[6]), 4),
            record_type=RecordType.NORMAL,
            review_status=ReviewStatus.CONFIRMED,
        ),
        Record(
            id="REC-008",
            timestamp=7.0,
            value=round(float(signal[7]), 4),
            old_table_value=None,
            record_type=RecordType.NORMAL,
            review_status=ReviewStatus.PENDING,
        ),
        Record(
            id="REC-009",
            timestamp=8.0,
            value=round(float(signal[8]), 4),
            old_table_value=round(float(signal[8]), 4),
            record_type=RecordType.NORMAL,
            review_status=ReviewStatus.CONFIRMED,
        ),
        Record(
            id="REC-010",
            timestamp=9.0,
            value=-0.5123,
            old_table_value=None,
            record_type=RecordType.NEGATIVE_AS_MISSING,
            review_status=ReviewStatus.PENDING,
        ),
        Record(
            id="REC-011",
            timestamp=10.0,
            value=round(float(signal[10]), 4),
            old_table_value=round(float(signal[10]), 4),
            record_type=RecordType.NORMAL,
            review_status=ReviewStatus.CONFIRMED,
        ),
        Record(
            id="REC-012",
            timestamp=11.0,
            value=round(float(signal[11]), 4),
            old_table_value=round(float(signal[11]), 4),
            record_type=RecordType.NORMAL,
            review_status=ReviewStatus.CONFIRMED,
        ),
    ]


def get_demo_teacher_annotations() -> List[TeacherAnnotation]:
    return [
        TeacherAnnotation(
            record_id="REC-001",
            annotation="基准信号，周期特征明显，无需修正",
            annotated_by="王老师",
            timestamp="2026-05-28T09:15:00",
        ),
        TeacherAnnotation(
            record_id="REC-003",
            annotation="负值是真值，非缺失，旧表误标——留待学生助教复核，不要归正常",
            annotated_by="王老师",
            timestamp="2026-05-28T09:22:00",
        ),
        TeacherAnnotation(
            record_id="REC-005",
            annotation="此点偏移，需与抽样名单对齐后再判",
            annotated_by="王老师",
            timestamp="2026-05-28T09:25:00",
        ),
        TeacherAnnotation(
            record_id="REC-006",
            annotation="旧口径值来自抽样名单-A，确认后可补录",
            annotated_by="王老师",
            timestamp="2026-05-28T09:30:00",
        ),
        TeacherAnnotation(
            record_id="REC-010",
            annotation="轻微负偏，建议等抽样名单再定",
            annotated_by="王老师",
            timestamp="2026-05-28T09:35:00",
        ),
    ]


def get_demo_sampling_list() -> List[Dict[str, Any]]:
    return [
        {
            "record_id": "REC-005",
            "old_caliber_value": -1.85,
            "source": "抽样名单-A",
            "notes": "旧口径记录，负值在抽样名单中有据可查",
        },
        {
            "record_id": "REC-006",
            "old_caliber_value": 3.72,
            "source": "抽样名单-A",
            "notes": "旧口径原始值",
        },
        {
            "record_id": "REC-008",
            "old_caliber_value": 1.45,
            "source": "抽样名单-B",
            "notes": "旧口径原始值，与当前值偏差约0.3",
        },
        {
            "record_id": "REC-010",
            "old_caliber_value": -0.50,
            "source": "抽样名单-C",
            "notes": "轻微负偏，抽样名单确认为真值",
        },
    ]


def get_demo_manual_correction() -> Dict[str, Any]:
    return {
        "record_id": "REC-003",
        "corrected_value": -3.22,
        "corrected_by": "小祁",
        "timestamp": "2026-05-28T14:10:00",
        "note": "人工修正：根据王老师批注和原始采样记录，确认-3.22为真值，不归正常，标记为已复核",
    }


def get_demo_rerun_config() -> Dict[str, Any]:
    return {
        "rerun_by": "小祁",
        "timestamp": "2026-05-28T14:30:00",
        "trigger": "补录抽样名单 + 人工修正后重跑",
        "applied_corrections": ["REC-003"],
        "applied_sampling": ["REC-005", "REC-006", "REC-008", "REC-010"],
    }
