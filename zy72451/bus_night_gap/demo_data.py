from .models import ConstructionNotice, RampRecord, Role, WorkflowState, RecordStatus
from .store import store
from .scoring import calculate_score
from .suggestions import generate_suggestion, update_workflow_after_supplement


def load_demo_data():
    """
    加载演示数据，包含完整流程：
    1. 施工告示第一次导入
    2. 初步评分和整改建议
    3. 社区书记周姐补看无障碍坡道记录
    4. 重跑评分（演示评分未变化的情况）
    5. 整改建议更新
    """
    store.__init__()

    notice = ConstructionNotice(
        id="demo-notice-001",
        road_name="幸福路与夜班公交12号线交叉口",
        construction_type="人行道改造",
        start_date="2026-05-15",
        end_date="2026-06-30",
        notes="人行道改造，涉及公交站点",
        raw_notes="周姐备注：这个路口是夜班12号线的必经站，晚上11点后还有很多下晚班的人走，特别是几个坐轮椅的老住户，坡道一定要弄好。上次李叔反映说夜班下车后站台那边的坡道太陡了，这次改造刚好一起弄。施工队说会留临时通道，但要盯紧点别把无障碍通道给堵了。",
        source="demo",
    )
    store.add_notice(notice)

    workflow = WorkflowState(
        notice_id=notice.id,
        step=0,
        step_description="施工告示已导入",
        status=RecordStatus.PENDING_REVIEW,
        current_assignee=Role.COMMUNITY_SECRETARY,
    )
    workflow.history.append({
        "step": 0,
        "action": "import_notice",
        "description": "施工告示第一次导入系统",
        "by": Role.SYSTEM.value,
    })
    store.set_workflow(workflow)

    calculate_score(notice.id)
    generate_suggestion(notice.id)

    ramp_initial = RampRecord(
        id="demo-ramp-001",
        notice_id=notice.id,
        location="幸福路公交站台东侧",
        has_ramp=True,
        ramp_condition=None,
        width_cm=None,
        notes="初步核查有坡道",
        raw_notes="",
        recorded_by=Role.SYSTEM,
        is_supplement=False,
    )
    store.add_ramp_record(ramp_initial)

    workflow = store.get_workflow(notice.id)
    workflow.step = 1
    workflow.step_description = "初步坡道记录已录入"
    workflow.history.append({
        "step": 1,
        "action": "initial_ramp_record",
        "description": "系统录入初步坡道记录",
        "by": Role.SYSTEM.value,
    })
    store.set_workflow(workflow)

    calculate_score(notice.id)
    generate_suggestion(notice.id)

    return notice.id


def demo_step2_supplement_ramp(notice_id: str):
    """
    步骤2：社区书记周姐补看无障碍坡道记录
    注意：这里故意补录一个不影响评分的记录，演示评分不变的情况
    """
    ramp_supplement = RampRecord(
        id="demo-ramp-002",
        notice_id=notice_id,
        location="幸福路公交站台西侧",
        has_ramp=False,
        ramp_condition=None,
        width_cm=None,
        notes="西侧没有坡道，需要新增",
        raw_notes="周姐现场补记：西侧那边原来就没有坡道，之前只看了东侧。夜班公交下车的人有时候会从西边过来，特别是拎东西的，这个点也得加上。上次跟张师傅聊过，他说晚上视线不好，没坡道容易摔跤。施工方说可以加，但得打报告。对了，东侧那个坡道我量了下，好像宽度不够，只有80公分，标准要90，这个也要改。",
        recorded_by=Role.COMMUNITY_SECRETARY,
        is_supplement=True,
    )
    store.add_ramp_record(ramp_supplement)

    calculate_score(notice_id)
    update_workflow_after_supplement(notice_id)
    generate_suggestion(notice_id)

    return True


def demo_step3_manual_correction(notice_id: str):
    """
    步骤3：一次人工修正 - 补充完整的坡道信息
    """
    ramp_correction = RampRecord(
        id="demo-ramp-003",
        notice_id=notice_id,
        location="幸福路公交站台东侧",
        has_ramp=True,
        ramp_condition="fair",
        width_cm=80,
        notes="人工修正：坡道存在但状况一般，宽度不够",
        raw_notes="交通协管复核：东侧坡道确实只有80cm宽，不符合90cm的标准，坡道表面有些破损，需要修复并拓宽。",
        recorded_by=Role.TRAFFIC_COORDINATOR,
        is_supplement=True,
    )
    store.add_ramp_record(ramp_correction)

    calculate_score(notice_id)
    generate_suggestion(notice_id)

    workflow = store.get_workflow(notice_id)
    workflow.step = 3
    workflow.step_description = "交通协管复核完成，补充完整信息"
    workflow.status = RecordStatus.READY_FOR_COORDINATOR
    workflow.current_assignee = Role.TRAFFIC_COORDINATOR
    workflow.history.append({
        "step": 3,
        "action": "traffic_coordinator_review",
        "description": "交通协管复核评分未变化项，补充了完整数据",
        "by": Role.TRAFFIC_COORDINATOR.value,
    })
    store.set_workflow(workflow)

    return True


def demo_step4_rerun(notice_id: str):
    """
    步骤4：一次重跑，生成最终报告
    """
    workflow = store.get_workflow(notice_id)
    workflow.step = 4
    workflow.step_description = "重跑完成，最终报告生成"
    workflow.status = RecordStatus.RESOLVED
    workflow.history.append({
        "step": 4,
        "action": "final_rerun",
        "description": "所有信息补全后重跑，生成最终整改建议",
        "by": Role.SYSTEM.value,
    })
    store.set_workflow(workflow)

    calculate_score(notice_id)
    suggestion = generate_suggestion(notice_id)

    return suggestion
