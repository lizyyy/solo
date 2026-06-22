from typing import List
from core.models import Parameter
from core.draft_manager import DraftManager


def generate_sample_data(draft_manager: DraftManager) -> List[str]:
    record_ids = []

    rid = draft_manager.add_draft(
        problem_id="speed_001",
        problem_title="小明跑步速度计算",
        parameters=[
            Parameter(name="距离", value=100.0, unit="m", source="题目已知"),
            Parameter(name="时间", value=12.5, unit="s", source="题目已知"),
        ],
        created_by="学生草稿-张三",
        remark="第一次试跑，用课堂例题数据",
    )
    record_ids.append(rid.record_id)

    rid = draft_manager.add_draft(
        problem_id="speed_001",
        problem_title="小明跑步速度计算",
        parameters=[
            Parameter(name="距离", value=0.1, unit="km", source="题目已知"),
            Parameter(name="时间", value=12.5, unit="s", source="题目已知"),
        ],
        created_by="学生草稿-张三",
        remark="第二次试跑，距离换了单位",
    )
    record_ids.append(rid.record_id)

    rid = draft_manager.add_draft(
        problem_id="speed_002",
        problem_title="高铁运行速度",
        parameters=[
            Parameter(name="距离", value=300.0, unit="km", source="题目已知"),
            Parameter(name="时间", value=1.5, unit="h", source="题目已知"),
        ],
        created_by="学生草稿-李四",
        remark="单位换算题，注意km/h转m/s",
    )
    record_ids.append(rid.record_id)

    rid = draft_manager.add_draft(
        problem_id="speed_003",
        problem_title="缺失单位的速度题",
        parameters=[
            Parameter(name="距离", value=500.0, unit="", source="题目已知"),
            Parameter(name="时间", value=25.0, unit="s", source="题目已知"),
        ],
        created_by="学生草稿-王五",
        is_boundary=False,
        remark="漏抄了距离的单位，待补充",
    )
    record_ids.append(rid.record_id)

    rid = draft_manager.add_draft(
        problem_id="density_001",
        problem_title="铁块密度计算",
        parameters=[
            Parameter(name="质量", value=7.8, unit="kg", source="题目已知"),
            Parameter(name="体积", value=0.001, unit="m3", source="题目已知"),
        ],
        created_by="学生草稿-张三",
        remark="标准密度题",
    )
    record_ids.append(rid.record_id)

    rid = draft_manager.add_draft(
        problem_id="density_002",
        problem_title="木块密度（单位混合）",
        parameters=[
            Parameter(name="质量", value=500.0, unit="g", source="题目已知"),
            Parameter(name="体积", value=1000.0, unit="cm3", source="题目已知"),
        ],
        created_by="学生草稿-李四",
        remark="注意g和cm3的单位换算",
    )
    record_ids.append(rid.record_id)

    rid = draft_manager.add_draft(
        problem_id="area_001",
        problem_title="教室面积计算",
        parameters=[
            Parameter(name="长度", value=12.0, unit="m", source="题目已知"),
            Parameter(name="宽度", value=8.0, unit="m", source="题目已知"),
        ],
        created_by="学生草稿-王五",
        remark="基础面积题",
    )
    record_ids.append(rid.record_id)

    rid = draft_manager.add_draft(
        problem_id="area_002",
        problem_title="操场面积（边界卡点）",
        parameters=[
            Parameter(name="长度", value=1000.5, unit="m", source="题目已知"),
            Parameter(name="宽度", value=1000.0, unit="m", source="题目已知"),
        ],
        created_by="学生草稿-赵六",
        is_boundary=True,
        remark="边界卡点：长度1000.5m × 宽度1000m = 1000500.0m²，超出面积阈值1000000.0m²，需复核是否参数录入错误或阈值需调整",
    )
    record_ids.append(rid.record_id)

    rid = draft_manager.add_draft(
        problem_id="kinetic_001",
        problem_title="汽车动能计算",
        parameters=[
            Parameter(name="质量", value=1500.0, unit="kg", source="题目已知"),
            Parameter(name="速度", value=20.0, unit="m/s", source="题目已知"),
        ],
        created_by="学生草稿-张三",
        remark="动能公式练习",
    )
    record_ids.append(rid.record_id)

    rid = draft_manager.add_draft(
        problem_id="speed_004",
        problem_title="超高速（阈值校验）",
        parameters=[
            Parameter(name="距离", value=1000.0, unit="m", source="题目已知"),
            Parameter(name="时间", value=0.1, unit="s", source="题目已知"),
        ],
        created_by="学生草稿-测试",
        remark="故意设置超阈值，验证阈值检查逻辑",
    )
    record_ids.append(rid.record_id)

    return record_ids
