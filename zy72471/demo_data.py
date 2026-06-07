from models import BuildingSetbackRecord


def get_demo_records():
    """
    三条演示数据：
    1. 顺利记录 - 正常评分，无需补录
    2. 坡道补录后评分没变化 - 需要交通协管复核
    3. 红线图备注旧口径 - 历史遗留问题按旧口径处理
    """
    record1 = BuildingSetbackRecord(
        record_id="TX-2026-001",
        building_name="阳光花园A栋",
        address="朝阳区建国路88号",
        bus_card_time="早高峰 07:30-09:00",
        initial_score=92.0
    )

    record2 = BuildingSetbackRecord(
        record_id="TX-2026-002",
        building_name="幸福里商业楼",
        address="海淀区中关村大街15号",
        bus_card_time="晚高峰 17:00-19:00",
        initial_score=72.0
    )

    record3 = BuildingSetbackRecord(
        record_id="TX-2026-003",
        building_name="老城区供销社大楼",
        address="西城区前门大街120号",
        bus_card_time="平峰 10:00-12:00",
        initial_score=78.0
    )

    return [record1, record2, record3]


def get_supplement_content():
    """坡道补录内容"""
    return {
        "TX-2026-002": "无障碍坡道位于建筑北侧入口，占用退线空间约0.5米，不影响行人通行"
    }


def get_redline_notes():
    """红线图备注"""
    return {
        "TX-2026-003": "该建筑为2005年以前建成，按旧口径核算退线距离，不适用2018版新标准"
    }


def get_test_cases():
    """
    测试用材料：
    - normal: 正常材料
    - wrong_standard: 错口径材料（把旧口径当新口径用）
    - supplement: 补录材料（先跑有问题的，再补录）
    """
    return {
        "normal": {
            "description": "正常材料 - 按标准流程处理",
            "records": ["TX-2026-001"],
            "expected_status": "正常"
        },
        "wrong_standard": {
            "description": "错口径材料 - 旧建筑误用新标准",
            "records": ["TX-2026-003"],
            "expected_status": "旧口径"
        },
        "supplement": {
            "description": "补录材料 - 需要坡道补录和复核",
            "records": ["TX-2026-002"],
            "expected_status": "待复核"
        }
    }
