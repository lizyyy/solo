from processor import (
    create_reminder,
    parse_jielong,
    import_jielong,
    parse_contract_screenshot,
    upload_contract,
    resolve_conflict,
    ticket_review,
    calculate_split,
    ConfirmAction,
)
from models import ProcessingStatus


def scenario_1_smooth() -> dict:
    """场景一：顺利记录 - 接龙与合同一致，正常流程走完"""
    result = {"name": "场景一：顺利记录（正常流程）", "scenario_key": "smooth", "steps": []}

    reminder = create_reminder("张三", "2026-06-10", "天鹅湖")
    result["steps"].append({"step": "1. 创建版权到期提醒", "record_id": reminder.record_id})

    jielong = parse_jielong(
        raw_content="1. 张三 天鹅湖 2026-06-10\n版权到期日：2026-12-31\n备注：正常排期",
        performer_name="张三",
        performance_date="2026-06-10",
        program_name="天鹅湖",
    )
    import_jielong(reminder, jielong, operator="排练群管理员")
    result["steps"].append({"step": "2. 导入排练群接龙", "status": reminder.status.value})

    contract = parse_contract_screenshot(
        record_id=reminder.record_id,
        contract_no="HT-2025-0088",
        valid_until="2026-12-31",
        copyright_owner="某文化传播公司",
        old_caliber=False,
        raw_ref="screenshot_20260607_001.png",
    )
    status, conflicts = upload_contract(reminder, contract, operator="版权运营小鹿")
    result["steps"].append({
        "step": "3. 上传合同页截图",
        "status": status.value,
        "conflicts_count": len(conflicts),
    })

    split = calculate_split(
        reminder,
        amount=5000.0,
        split_ratio="7:3",
        payee="某文化传播公司",
    )
    result["steps"].append({
        "step": "4. 生成分账明细",
        "amount": split.amount,
        "ratio": split.split_ratio,
        "status": reminder.status.value,
    })

    result["final_status"] = reminder.status.value
    result["history_count"] = len(reminder.history)
    result["reminder"] = reminder
    return result


def scenario_2_temp_substitute() -> dict:
    """场景二：临时替补只在群里说了一句，需票务复核"""
    result = {"name": "场景二：临时替补（待票务复核）", "scenario_key": "temp", "steps": []}

    reminder = create_reminder("李四（临时替补）", "2026-06-12", "红色娘子军")
    result["steps"].append({"step": "1. 创建版权到期提醒", "record_id": reminder.record_id})

    jielong = parse_jielong(
        raw_content="2. 李四 红色娘子军 2026-06-12\n版权到期日：2026-09-30\n备注：临时替补，不是罕见边角料",
        performer_name="李四",
        performance_date="2026-06-12",
        program_name="红色娘子军",
    )
    import_jielong(reminder, jielong, operator="排练群管理员")
    result["steps"].append({
        "step": "2. 导入排练群接龙",
        "status": reminder.status.value,
        "review_note": reminder.review_note,
    })

    contract = parse_contract_screenshot(
        record_id=reminder.record_id,
        contract_no="HT-2025-0120",
        valid_until="2026-09-30",
        copyright_owner="某艺术团",
        old_caliber=False,
        raw_ref="screenshot_20260607_002.png",
    )
    status, conflicts = upload_contract(reminder, contract, operator="版权运营小鹿")
    result["steps"].append({
        "step": "3. 上传合同页截图",
        "status": status.value,
        "note": "临时替补仍需票务复核，不自动归正常",
    })

    ticket_review(reminder, passed=True, operator="票务同事小王", review_note="核对替补流程合规")
    result["steps"].append({
        "step": "4. 票务同事复核",
        "result": "通过",
        "status": reminder.status.value,
    })

    split = calculate_split(
        reminder,
        amount=3500.0,
        split_ratio="6:4",
        payee="某艺术团",
    )
    result["steps"].append({
        "step": "5. 生成分账明细",
        "amount": split.amount,
        "ratio": split.split_ratio,
        "status": reminder.status.value,
    })

    result["final_status"] = reminder.status.value
    result["history_count"] = len(reminder.history)
    result["reminder"] = reminder
    return result


def scenario_3_old_caliber() -> dict:
    """场景三：合同页截图补来的旧口径"""
    result = {"name": "场景三：旧口径补录（合同截图补录）", "scenario_key": "old", "steps": []}

    reminder = create_reminder("王五", "2026-06-15", "二泉映月")
    result["steps"].append({"step": "1. 创建版权到期提醒", "record_id": reminder.record_id})

    jielong = parse_jielong(
        raw_content="3. 王五 二泉映月 2026-06-15\n版权到期日：2026-08-15\n备注：正常排期",
        performer_name="王五",
        performance_date="2026-06-15",
        program_name="二泉映月",
    )
    import_jielong(reminder, jielong, operator="排练群管理员")
    result["steps"].append({"step": "2. 导入排练群接龙", "status": reminder.status.value})

    contract = parse_contract_screenshot(
        record_id=reminder.record_id,
        contract_no="HT-2023-0056",
        valid_until="2026-08-15",
        copyright_owner="某人工作室",
        old_caliber=True,
        raw_ref="screenshot_20260607_003_old.png",
    )
    status, conflicts = upload_contract(reminder, contract, operator="版权运营小鹿")
    result["steps"].append({
        "step": "3. 上传旧口径合同截图",
        "status": status.value,
        "conflicts": [c.description for c in conflicts],
    })

    resolve_conflict(reminder, ConfirmAction.CONFIRM, operator="版权运营小鹿", resolve_note="历史合同按旧口径执行")
    result["steps"].append({
        "step": "4. 版权运营确认冲突处理",
        "action": "确认适用旧口径",
        "status": reminder.status.value,
    })

    split = calculate_split(
        reminder,
        amount=2800.0,
        split_ratio="5:5",
        payee="某人工作室",
    )
    result["steps"].append({
        "step": "5. 按旧口径生成分账",
        "amount": split.amount,
        "ratio": split.split_ratio,
        "caliber": "旧口径",
        "status": reminder.status.value,
    })

    result["final_status"] = reminder.status.value
    result["history_count"] = len(reminder.history)
    result["reminder"] = reminder
    return result


def scenario_4_conflict_demo() -> dict:
    """场景四：接龙与截图矛盾，列出冲突证据待确认"""
    result = {"name": "场景四：信息冲突（待版权运营确认）", "scenario_key": "conflict", "steps": []}

    reminder = create_reminder("赵六", "2026-06-18", "黄河大合唱")
    result["steps"].append({"step": "1. 创建版权到期提醒", "record_id": reminder.record_id})

    jielong = parse_jielong(
        raw_content="4. 赵六 黄河大合唱 2026-06-18\n版权到期日：2026-07-01\n备注：正常排期",
        performer_name="赵六",
        performance_date="2026-06-18",
        program_name="黄河大合唱",
    )
    import_jielong(reminder, jielong, operator="排练群管理员")
    result["steps"].append({"step": "2. 导入排练群接龙", "status": reminder.status.value})

    contract = parse_contract_screenshot(
        record_id=reminder.record_id,
        contract_no="HT-2025-0200",
        valid_until="2026-10-01",
        copyright_owner="某乐团",
        old_caliber=False,
        raw_ref="screenshot_20260607_004.png",
    )
    status, conflicts = upload_contract(reminder, contract, operator="版权运营小鹿")
    result["steps"].append({
        "step": "3. 上传合同页截图 - 发现冲突",
        "status": status.value,
        "conflicts": [
            {
                "字段": c.field_name,
                "接龙值": c.jielong_value,
                "截图值": c.screenshot_value,
                "描述": c.description,
            }
            for c in conflicts
        ],
        "note": "不自动拍板，由版权运营小鹿选择确认或驳回",
    })

    result["final_status"] = reminder.status.value
    result["history_count"] = len(reminder.history)
    result["reminder"] = reminder
    return result


def run_all_scenarios() -> list:
    return [
        scenario_1_smooth(),
        scenario_2_temp_substitute(),
        scenario_3_old_caliber(),
        scenario_4_conflict_demo(),
    ]
