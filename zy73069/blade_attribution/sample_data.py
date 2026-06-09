"""示例数据：构造现场会收到的一包材料（含正常、预警、严重、边界、备件替换、到货延迟）"""
from typing import List, Tuple

from .models import Measurement, SparePart


def sample_measurements() -> List[Measurement]:
    return [
        Measurement(
            timestamp="2026-06-09 08:30:00",
            turbine_id="WT-0117",
            blade_no=1,
            vibration_velocity=3.2,
            temperature=48.0,
            ambient_temp=22.0,
            pitch_angle=2.1,
            pitch_reference=0.0,
            source="SCADA实时采集"
        ),
        Measurement(
            timestamp="2026-06-09 09:15:00",
            turbine_id="WT-0117",
            blade_no=2,
            vibration_velocity=4.55,
            vibration_unit="mm/s",
            temperature=52.0,
            ambient_temp=22.0,
            pitch_angle=2.05,
            pitch_reference=0.0,
            source="班组交接记录+SCADA"
        ),
        Measurement(
            timestamp="2026-06-09 09:45:00",
            turbine_id="WT-0203",
            blade_no=3,
            vibration_velocity=7.15,
            temperature=65.0,
            ambient_temp=23.0,
            pitch_angle=5.1,
            pitch_reference=0.0,
            source="SCADA实时采集"
        ),
        Measurement(
            timestamp="2026-06-09 10:20:00",
            turbine_id="WT-0089",
            blade_no=1,
            vibration_velocity=4.52,
            vibration_unit="mm/s",
            temperature=47.4,
            ambient_temp=22.0,
            pitch_angle=2.02,
            pitch_reference=0.0,
            source="班组交接记录"
        ),
        Measurement(
            timestamp="2026-06-09 11:00:00",
            turbine_id="WT-0089",
            blade_no=2,
            vibration_velocity=4.6,
            vibration_unit="m/s",
            temperature=50.0,
            ambient_temp=23.0,
            pitch_angle=2.0,
            pitch_reference=0.0,
            source="手持点检仪(人工录入)"
        ),
        Measurement(
            timestamp="2026-06-09 14:00:00",
            turbine_id="WT-0341",
            blade_no=2,
            vibration_velocity=8.0,
            temperature=70.0,
            ambient_temp=24.0,
            pitch_angle=6.0,
            pitch_reference=0.0,
            source="SCADA实时采集"
        )
    ]


def sample_spare_parts() -> List[Tuple[str, List[SparePart], str]]:
    """返回 [(风机编号, 备件清单, 停机窗口结束日期), ...]"""
    return [
        ("WT-0117", [
            SparePart(part_code="BOLT-M16-12.9", part_name="叶片根螺栓(高强度替换件)",
                      required_date="2026-06-10", arrival_date="2026-06-11", quantity=36),
            SparePart(part_code="GREASE-HT-400G", part_name="高温润滑脂",
                      required_date="2026-06-10", arrival_date="2026-06-09", quantity=2),
            SparePart(part_code="SEAL-BLADE-001", part_name="叶片根部密封圈",
                      required_date="2026-06-10", arrival_date="2026-06-10", quantity=3),
        ], "2026-06-10"),
        ("WT-0203", [
            SparePart(part_code="PITCH-MOTOR-V2", part_name="变桨电机(升级款)",
                      original_code="PITCH-MOTOR-V1",
                      required_date="2026-06-11", arrival_date="2026-06-13", quantity=1),
            SparePart(part_code="ENCODER-ABS-17bit", part_name="绝对值编码器",
                      required_date="2026-06-11", arrival_date="2026-06-10", quantity=1),
        ], "2026-06-12"),
        ("WT-0089", [
            SparePart(part_code="BOLT-M16-12.9", part_name="叶片根螺栓(高强度替换件)",
                      required_date="2026-06-11", arrival_date="2026-06-15", quantity=18),
        ], "2026-06-12"),
        ("WT-0341", [
            SparePart(part_code="BLADE-REPAIR-KIT", part_name="叶片修补包",
                      required_date="2026-06-10", arrival_date="2026-06-10", quantity=1),
            SparePart(part_code="VIBRATION-SENSOR-3AXIS", part_name="三轴振动传感器",
                      required_date="2026-06-10", arrival_date="2026-06-16", quantity=1),
        ], "2026-06-10"),
    ]


def sample_handover_notes() -> dict:
    return {
        "WT-0089-B1": "B1班组6月8日夜班记录：听到异响，怀疑叶根螺栓松动，已安排白班复核。",
        "WT-0117-B2": "班组交接：B2叶尖出现雷击裂纹痕迹，待进一步内窥检测确认。"
    }
