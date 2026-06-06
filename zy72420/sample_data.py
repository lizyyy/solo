from datetime import datetime, timedelta
from models import (
    DepositRefundOrder, SignInPhoto, TicketExportRecord,
    RefundStatus, DataSource
)


def create_normal_scenario() -> DepositRefundOrder:
    """场景一：正常顺利记录 - 所有数据一致，授权地区完整"""
    order = DepositRefundOrder(
        refund_id="REF-2026-001",
        student_name="张小明",
        instrument_type="钢琴",
        deposit_amount=5000.0,
        authorized_cities=["北京", "上海", "广州", "深圳"],
        status=RefundStatus.PENDING_REVIEW,
        current_step=0
    )

    order.sign_in_photos = [
        SignInPhoto(
            photo_id="PHO-001",
            lesson_id="LES-001",
            student_name="张小明",
            sign_time=datetime(2026, 5, 10, 14, 30),
            authorized_city="北京",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 10, 14, 35)
        ),
        SignInPhoto(
            photo_id="PHO-002",
            lesson_id="LES-002",
            student_name="张小明",
            sign_time=datetime(2026, 5, 17, 14, 30),
            authorized_city="北京",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 17, 14, 33)
        ),
        SignInPhoto(
            photo_id="PHO-003",
            lesson_id="LES-003",
            student_name="张小明",
            sign_time=datetime(2026, 5, 24, 14, 30),
            authorized_city="上海",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 24, 14, 32)
        )
    ]

    order.ticket_records = [
        TicketExportRecord(
            ticket_id="TKT-001",
            lesson_id="LES-001",
            student_name="张小明",
            class_date=datetime(2026, 5, 10),
            city="北京",
            ticket_status="已使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        ),
        TicketExportRecord(
            ticket_id="TKT-002",
            lesson_id="LES-002",
            student_name="张小明",
            class_date=datetime(2026, 5, 17),
            city="北京",
            ticket_status="已使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        ),
        TicketExportRecord(
            ticket_id="TKT-003",
            lesson_id="LES-003",
            student_name="张小明",
            class_date=datetime(2026, 5, 24),
            city="上海",
            ticket_status="已使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        )
    ]

    order.add_history(
        operator="系统",
        action="创建退款单",
        detail="押金退款申请已提交，金额5000元",
        data_source=None
    )

    return order


def create_area_mismatch_scenario() -> DepositRefundOrder:
    """场景二：授权地区少写了一个城市 - 签到照片中有深圳，但授权城市列表漏掉了"""
    order = DepositRefundOrder(
        refund_id="REF-2026-002",
        student_name="李小红",
        instrument_type="小提琴",
        deposit_amount=3000.0,
        authorized_cities=["北京", "上海", "广州"],
        status=RefundStatus.PENDING_REVIEW,
        current_step=0
    )

    order.sign_in_photos = [
        SignInPhoto(
            photo_id="PHO-004",
            lesson_id="LES-004",
            student_name="李小红",
            sign_time=datetime(2026, 5, 8, 10, 0),
            authorized_city="北京",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 8, 10, 5)
        ),
        SignInPhoto(
            photo_id="PHO-005",
            lesson_id="LES-005",
            student_name="李小红",
            sign_time=datetime(2026, 5, 15, 10, 0),
            authorized_city="深圳",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 15, 10, 3)
        ),
        SignInPhoto(
            photo_id="PHO-006",
            lesson_id="LES-006",
            student_name="李小红",
            sign_time=datetime(2026, 5, 22, 10, 0),
            authorized_city="上海",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 22, 10, 4)
        )
    ]

    order.ticket_records = [
        TicketExportRecord(
            ticket_id="TKT-004",
            lesson_id="LES-004",
            student_name="李小红",
            class_date=datetime(2026, 5, 8),
            city="北京",
            ticket_status="已使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        ),
        TicketExportRecord(
            ticket_id="TKT-005",
            lesson_id="LES-005",
            student_name="李小红",
            class_date=datetime(2026, 5, 15),
            city="深圳",
            ticket_status="已使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        ),
        TicketExportRecord(
            ticket_id="TKT-006",
            lesson_id="LES-006",
            student_name="李小红",
            class_date=datetime(2026, 5, 22),
            city="上海",
            ticket_status="已使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        )
    ]

    order.add_history(
        operator="系统",
        action="创建退款单",
        detail="押金退款申请已提交，金额3000元",
        data_source=None
    )

    return order


def create_old_caliber_scenario() -> DepositRefundOrder:
    """场景三：从票务导出表补来的旧口径 - 票务记录中有旧口径的历史数据"""
    order = DepositRefundOrder(
        refund_id="REF-2026-003",
        student_name="王小强",
        instrument_type="吉他",
        deposit_amount=2000.0,
        authorized_cities=["北京", "成都", "杭州"],
        status=RefundStatus.PENDING_REVIEW,
        current_step=0
    )

    order.sign_in_photos = [
        SignInPhoto(
            photo_id="PHO-007",
            lesson_id="LES-007",
            student_name="王小强",
            sign_time=datetime(2026, 5, 5, 16, 0),
            authorized_city="北京",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 5, 16, 6)
        ),
        SignInPhoto(
            photo_id="PHO-008",
            lesson_id="LES-008",
            student_name="王小强",
            sign_time=datetime(2026, 5, 12, 16, 0),
            authorized_city="成都",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 12, 16, 4)
        )
    ]

    order.ticket_records = [
        TicketExportRecord(
            ticket_id="TKT-007",
            lesson_id="LES-007",
            student_name="王小强",
            class_date=datetime(2026, 5, 5),
            city="北京",
            ticket_status="已使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        ),
        TicketExportRecord(
            ticket_id="TKT-008",
            lesson_id="LES-008",
            student_name="王小强",
            class_date=datetime(2026, 5, 12),
            city="成都",
            ticket_status="已使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        ),
        TicketExportRecord(
            ticket_id="TKT-009-OLD",
            lesson_id="LES-009",
            student_name="王小强",
            class_date=datetime(2026, 4, 28),
            city="杭州",
            ticket_status="已使用",
            export_version="v1.0",
            export_time=datetime(2026, 5, 1, 8, 0),
            is_old_caliber=True
        ),
        TicketExportRecord(
            ticket_id="TKT-010-OLD",
            lesson_id="LES-010",
            student_name="王小强",
            class_date=datetime(2026, 4, 21),
            city="杭州",
            ticket_status="已使用",
            export_version="v1.0",
            export_time=datetime(2026, 5, 1, 8, 0),
            is_old_caliber=True
        )
    ]

    order.add_history(
        operator="系统",
        action="创建退款单",
        detail="押金退款申请已提交，金额2000元",
        data_source=None
    )

    return order


def create_conflict_scenario() -> DepositRefundOrder:
    """场景四：签到照片和票务导出表互相矛盾 - 用于测试冲突检测"""
    order = DepositRefundOrder(
        refund_id="REF-2026-004",
        student_name="赵小刚",
        instrument_type="古筝",
        deposit_amount=4000.0,
        authorized_cities=["北京", "南京"],
        status=RefundStatus.PENDING_REVIEW,
        current_step=0
    )

    order.sign_in_photos = [
        SignInPhoto(
            photo_id="PHO-009",
            lesson_id="LES-011",
            student_name="赵小刚",
            sign_time=datetime(2026, 5, 10, 9, 0),
            authorized_city="北京",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 10, 9, 8)
        ),
        SignInPhoto(
            photo_id="PHO-010",
            lesson_id="LES-012",
            student_name="赵小刚",
            sign_time=datetime(2026, 5, 17, 9, 0),
            authorized_city="北京",
            check_in_status="已签到",
            upload_time=datetime(2026, 5, 17, 9, 5)
        )
    ]

    order.ticket_records = [
        TicketExportRecord(
            ticket_id="TKT-011",
            lesson_id="LES-011",
            student_name="赵小刚",
            class_date=datetime(2026, 5, 10),
            city="南京",
            ticket_status="未使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        ),
        TicketExportRecord(
            ticket_id="TKT-012",
            lesson_id="LES-012",
            student_name="赵小刚",
            class_date=datetime(2026, 5, 18),
            city="北京",
            ticket_status="已使用",
            export_version="v2.0",
            export_time=datetime(2026, 5, 31, 10, 0),
            is_old_caliber=False
        )
    ]

    order.add_history(
        operator="系统",
        action="创建退款单",
        detail="押金退款申请已提交，金额4000元",
        data_source=None
    )

    return order


def get_all_scenarios():
    return {
        "场景一：正常顺利记录": create_normal_scenario(),
        "场景二：授权地区少写了一个城市": create_area_mismatch_scenario(),
        "场景三：票务导出表补来的旧口径": create_old_caliber_scenario(),
        "场景四：签到照片与票务表矛盾": create_conflict_scenario()
    }
