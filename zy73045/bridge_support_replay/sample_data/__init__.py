"""示例数据生成器 — 让接手同事 `bsr demo-init` 后立刻能看到三种状态。"""

from __future__ import annotations

from ..models import (
    WorkOrder,
    PhotoRecord,
    now_iso,
    WorkOrderStatus,
)
from ..storage import (
    save_workorder,
    create_workorder_from_raw,
    add_cleaned_spare_part,
)
from ..timeline import record_alarm, record_manual_note, record_supplement


def _generate_handled() -> WorkOrder:
    """S001: 已处理 — 干净闭环。"""
    raw = {
        "来源系统": "养护管理系统",
        "养护类别": "桥梁支座更换",
        "旧说法": "原来写的'支座磨损'，后经拆解确认是'橡胶老化'",
    }
    wo = create_workorder_from_raw(
        "WO-2025-S001",
        title="青岩桥1#墩4#支座更换",
        bridge_name="青岩大桥",
        support_position="1#墩4号盆式支座GPZ(Ⅱ)5DX",
        raw_snapshot=raw,
        raw_source="养护系统API 2025-10-11导出",
        created_by="系统导入",
    )
    add_cleaned_spare_part(
        wo, "SP-001",
        raw_entry={"物料名称": "盆式支座", "型号": "", "数量": "1个", "规格写的": "很乱"},
        source="老唐微信2025-10-12转发Excel",
        cleaned_name="盆式支座",
        cleaned_spec="GPZ(Ⅱ)5DX",
        cleaned_quantity=1.0,
        cleaned_unit="个",
        cleaning_note="原始型号空，根据养护工单图纸确认为GPZ(Ⅱ)5DX",
        actor="张三",
    )
    add_cleaned_spare_part(
        wo, "SP-002",
        raw_entry={"物料名称": "锚固螺栓", "型号": "M24", "数量": "4", "单位": "套"},
        source="同批Excel第2行",
        cleaned_name="锚固螺栓",
        cleaned_spec="M24×120 8.8级",
        cleaned_quantity=4.0,
        cleaned_unit="套",
        cleaning_note="补全长度/强度等级按现场交底",
        actor="张三",
    )

    # 照片：各时间一致
    wo.photos.append(PhotoRecord(
        photo_id="P-S001-1",
        file_path="./photos/S001-1.jpg",
        exif_time="2025-10-12T09:30:00+08:00",
        claimed_time="2025-10-12T09:30:00+08:00",
        site_time="2025-10-12T09:35:00+08:00",
        upload_time="2025-10-12T14:20:00+08:00",
        description="旧支座拆除前",
        uploaded_by="张三",
        camera_tz="Asia/Shanghai",
    ))
    wo.photos.append(PhotoRecord(
        photo_id="P-S001-2",
        file_path="./photos/S001-2.jpg",
        exif_time="2025-10-12T11:10:00+08:00",
        claimed_time="2025-10-12T11:10:00+08:00",
        site_time="2025-10-12T11:12:00+08:00",
        upload_time="2025-10-12T14:22:00+08:00",
        description="新支座安装后",
        uploaded_by="张三",
        camera_tz="Asia/Shanghai",
    ))

    record_manual_note(wo, actor="老唐", note="现场监理旁站，支座型号与设计一致")
    record_supplement(
        wo, actor="李四",
        note="养护单位提交了质保书",
        evidence={"质保书编号": "ZB-2025-1012"},
        new_conclusion="支座更换完成，验收合格，质保资料齐全",
    )
    wo.status = WorkOrderStatus.HANDLED
    save_workorder(wo)
    return wo


def _generate_pending() -> WorkOrder:
    """S002: 待补证据 — 材料不齐全但没有硬阻塞。"""
    raw = {
        "来源系统": "巡检APP",
        "发现问题": "支座有裂纹",
    }
    wo = create_workorder_from_raw(
        "WO-2025-S002",
        title="枫林桥3#墩2#支座裂纹排查",
        bridge_name="枫林高架桥",
        support_position="3#墩2号球型钢支座",
        raw_snapshot=raw,
        raw_source="巡检APP离线工单 2025-10-15 16:20",
        created_by="王五",
    )
    # 备件清单不齐整 — 只录入了一条，且字段不完整
    add_cleaned_spare_part(
        wo, "SP-101",
        raw_entry={"name": "修补胶", "数量": "1"},
        source="王五口述",
        cleaned_name="修补胶",
        # 缺 spec / unit
        cleaning_note="规格待供应商确认",
        actor="王五",
    )

    wo.photos.append(PhotoRecord(
        photo_id="P-S002-1",
        file_path="./photos/S002-1.jpg",
        exif_time="2025-10-15T10:05:00+08:00",
        site_time="2025-10-15T10:00:00+08:00",
        upload_time="2025-10-15T18:10:00+08:00",
        description="裂纹位置远景",
        uploaded_by="王五",
        camera_tz="Asia/Shanghai",
    ))

    record_manual_note(wo, actor="王五", note="测量裂纹宽度约1.2mm")
    wo.status = WorkOrderStatus.PENDING_EVIDENCE
    save_workorder(wo)
    return wo


def _generate_stuck() -> WorkOrder:
    """S003: 卡壳 — 照片时间错位 + 报警对不上 + 备件有版本冲突。

    这一条用来演示老唐最担心的那种情况：
    - 照片 EXIF 比打卡早2小时（疑似时区错设UTC）
    - 自动报了警，但人工备注完全没提
    - 备件同一个 part_id 数量前后不一致且没写清洗说明
    - 还有一条补录导致结论从"合格"被改判为"需重新检测"
    """
    raw = {
        "来源系统": "养护系统",
        "旧结论": "第一次检测误判为合格",
        "报警信息": "系统自动检测到支座转角超限报警ID=ALM-8821",
    }
    wo = create_workorder_from_raw(
        "WO-2025-S003",
        title="银滩桥5#墩1#支座检测（问题工单）",
        bridge_name="银滩跨海大桥",
        support_position="5#墩1号支座",
        raw_snapshot=raw,
        raw_source="养护系统API 2025-11-01",
        created_by="系统导入",
    )

    # 第一次录入（数量=2 — 后来又录了 v2 数量=4 且没写说明）
    add_cleaned_spare_part(
        wo, "SP-202",
        raw_entry={"name": "不锈钢板", "spec": "20mm", "qty": "2", "u": "块"},
        source="第一次领料单",
        cleaned_name="不锈钢滑板",
        cleaned_spec="20mm×300×300",
        cleaned_quantity=2.0,
        cleaned_unit="块",
        cleaning_note="按实际尺寸补全",
        actor="赵六",
    )
    # 补录 v2：数量改到 4 — 忘了写清洗说明 → 版本冲突！
    add_cleaned_spare_part(
        wo, "SP-202",
        raw_entry={"name": "不锈钢板", "spec": "20mm", "qty": "4", "u": "块"},
        source="第二次领料单（但未说明原因）",
        cleaned_name="不锈钢滑板",
        cleaned_spec="20mm×300×300",
        cleaned_quantity=4.0,
        cleaned_unit="块",
        cleaning_note=None,  # 故意空 → 触发版本冲突检测
        actor="赵六",
    )

    # 照片 EXIF 是 UTC 的 01:30 → 等于北京时间 09:30，
    # 但现场打卡写成 07:30，人工备注 claimed_time 写成 08:00
    # → 多组时间差 ~2小时，触发 high 级别
    wo.photos.append(PhotoRecord(
        photo_id="P-S003-1",
        file_path="./photos/S003-1.jpg",
        exif_time="2025-11-02T01:30:00+00:00",   # 相机时区误设 UTC
        claimed_time="2025-11-02T08:00:00+08:00",  # 备注写的
        site_time="2025-11-02T07:30:00+08:00",      # 现场打卡
        upload_time="2025-11-02T20:15:00+08:00",
        description="支座顶面照",
        uploaded_by="赵六",
        camera_tz="UTC",   # 相机时区设错
    ))
    # 另一张：差30小时 → critical
    wo.photos.append(PhotoRecord(
        photo_id="P-S003-2",
        file_path="./photos/S003-2.jpg",
        exif_time="2025-11-01T02:10:00+08:00",  # 前一天 02:10（可能传错了旧照片）
        claimed_time="2025-11-02T09:00:00+08:00",
        site_time="2025-11-02T09:00:00+08:00",
        upload_time="2025-11-02T20:16:00+08:00",
        description="支座位移测值",
        uploaded_by="赵六",
        camera_tz="Asia/Shanghai",
    ))

    # 第一次结论：合格（后来改判）
    record_supplement(
        wo, actor="赵六",
        note="现场初查未见明显异常",
        evidence={"初查人": "赵六"},
        new_conclusion="支座状态合格",
    )

    # 系统自动报警：转角超限 — 但人工备注还没回应
    record_alarm(
        wo, actor="自动巡检AI",
        alarm_text="支座转角超限报警 (ALM-8821)：转角 0.032rad > 限值 0.02rad",
        details={"alarm_id": "ALM-8821", "转角值": 0.032, "限值": 0.02},
    )

    # 另一条人工备注 — 完全没提报警的事 → 触发报警/备注不一致
    record_manual_note(wo, actor="赵六", note="现场清理完毕，工具已归还")

    # 第二次补录 — 改判！结论从合格→需重新检测
    record_supplement(
        wo, actor="老唐",
        note="同事复核发现照片时间有疑点，且转角记录超阈值",
        evidence={"复核人": "老唐", "复核日期": "2025-11-03"},
        new_conclusion="支座需重新检测",
        reversal_reason="检测照片时间存疑，自动报警转角超限未在原始备注中回应",
    )
    wo.status = WorkOrderStatus.PENDING_EVIDENCE  # 硬标待补，但分类器会判成 STUCK
    save_workorder(wo)
    return wo


def generate_demo_workorders() -> int:
    """生成 3 条示例工单，返回生成数量。"""
    _generate_handled()
    _generate_pending()
    _generate_stuck()
    return 3
