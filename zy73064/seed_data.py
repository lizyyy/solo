from typing import Dict, Any
from models import PartStatus
from service import PipelineAnomalyService
from database import SparePartRepo, AlarmRepo, ManualNoteRepo, AnomalyAttributionRepo


DEMO_SEED_FLAG = "demo_seeded"


def _is_seeded() -> bool:
    parts = SparePartRepo.list_all()
    seeded_nos = {"SP-API-0001", "SP-API-0002", "SP-API-0003"}
    return any(p.part_no in seeded_nos for p in parts)


def ensure_seed_data(service: PipelineAnomalyService) -> Dict[str, Any]:
    if _is_seeded():
        return {
            "seeded": True,
            "message": "样例数据已存在（SQLite 持久化），服务重启后仍可读回，无需重复写入。"
        }

    p_normal = service.add_spare_part(
        part_no="SP-API-0001", part_name="球阀",
        part_model="Q41F-16P", expected_model="Q41F-16P",
        quantity=2, pipeline_id="PL-A01", status=PartStatus.NORMAL
    )

    p_replace = service.add_spare_part(
        part_no="SP-API-0002", part_name="截止阀",
        part_model="J41W-25P", expected_model="J41W-16P",
        quantity=1, pipeline_id="PL-A02", status=PartStatus.NORMAL
    )

    p_missing = service.add_spare_part(
        part_no="SP-API-0003", part_name="压力表",
        part_model="Y-100", expected_model="Y-100",
        quantity=0, pipeline_id="PL-A03", status=PartStatus.MISSING
    )

    a_normal = service.add_alarm(
        pipeline_id="PL-A01", alarm_type="压力波动",
        alarm_desc="PL-A01段压力短时升高后恢复",
        related_part_no=p_normal.part_no
    )
    a_replace = service.add_alarm(
        pipeline_id="PL-A02", alarm_type="阀门内漏",
        alarm_desc="截止阀疑似内漏",
        related_part_no=p_replace.part_no
    )
    a_missing = service.add_alarm(
        pipeline_id="PL-A03", alarm_type="仪表无读数",
        alarm_desc="压力表无任何读数",
        related_part_no=p_missing.part_no
    )

    n_normal = service.add_manual_note(
        pipeline_id="PL-A01",
        content="现场检查正常，压力波动为工艺调整，阀门及备件均无误",
        operator="老唐",
        related_alarm_no=a_normal.alarm_no,
        related_part_no=p_normal.part_no
    )
    n_replace = service.add_manual_note(
        pipeline_id="PL-A02",
        content="库房暂无J41W-16P，临时用J41W-25P替代，压力等级更高应无问题，但需确认",
        operator="老唐",
        related_alarm_no=a_replace.alarm_no,
        related_part_no=p_replace.part_no
    )
    n_mismatch = service.add_manual_note(
        pipeline_id="PL-A99",
        content="这条备注故意关联到错的管线号，用于验证关联不匹配分支",
        operator="老唐",
        related_alarm_no=a_missing.alarm_no,
        related_part_no=p_missing.part_no
    )

    return {
        "seeded": True,
        "message": "已写入样例备件/报警/人工备注，数据落盘 SQLite，服务重启后仍可读。",
        "parts": [
            {"part_no": p_normal.part_no, "status": p_normal.status.value,
             "model": p_normal.part_model, "expected": p_normal.expected_model},
            {"part_no": p_replace.part_no, "status": p_replace.status.value,
             "model": p_replace.part_model, "expected": p_replace.expected_model},
            {"part_no": p_missing.part_no, "status": p_missing.status.value,
             "model": p_missing.part_model, "expected": p_missing.expected_model},
        ],
        "alarms": [a_normal.alarm_no, a_replace.alarm_no, a_missing.alarm_no],
        "notes": [n_normal.note_no, n_replace.note_no, n_mismatch.note_no],
    }
