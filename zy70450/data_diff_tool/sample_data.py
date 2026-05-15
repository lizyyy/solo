import json
import random
from datetime import datetime, timedelta


def generate_sample_data(output_file: str):
    orders = []
    
    base_date = datetime(2024, 5, 10)
    
    buildings = ["A栋", "B栋", "C栋", "D栋"]
    repair_types = ["水电", "空调", "电梯", "门窗", "消防"]
    statuses = ["待处理", "处理中", "已完成", "已取消"]
    source_systems = ["物业系统A", "物业系统B", "报修小程序", "人工录入"]
    
    for i in range(1, 11):
        report_date = base_date + timedelta(days=random.randint(0, 2))
        created_at = report_date + timedelta(hours=random.randint(8, 20), minutes=random.randint(0, 59))
        
        order = {
            "order_id": f"WO{2024051000 + i}",
            "source_system": random.choice(source_systems),
            "report_date": report_date.strftime("%Y-%m-%d"),
            "created_at": created_at.isoformat(),
            "repair_type": random.choice(repair_types),
            "building": random.choice(buildings),
            "room": f"{random.randint(1, 20)}{random.randint(101, 999)}",
            "description": f"{random.choice(['卫生间漏水', '空调不制冷', '电梯异响', '门锁损坏', '灯管烧坏'])}",
            "status": random.choice(statuses),
            "assignee": random.choice(["张师傅", "李师傅", "王师傅", None]),
            "_meta": {
                "order_id": {"source": "物业系统A", "source_type": "auto_increment", "rule": "WO+日期+序号"},
                "description": {"source": "用户报修", "source_type": "user_input"},
                "status": {"source": "工单系统", "source_type": "workflow"}
            }
        }
        
        if order["status"] == "已完成":
            order["completed_at"] = (created_at + timedelta(hours=random.randint(1, 48))).isoformat()
        
        orders.append(order)
    
    mixed_source_order = {
        "order_id": "WO2024051011",
        "source_system": "混合来源",
        "report_date": "2024-05-11",
        "created_at": "2024-05-11T14:30:00",
        "repair_type": "水电",
        "building": "A栋",
        "room": "1205",
        "description": "厨房水管漏水，需要紧急处理",
        "status": "处理中",
        "assignee": "赵师傅",
        "_meta": {
            "order_id": {"source": "物业系统A", "source_type": "auto_increment"},
            "description": {"source": "电话报修", "source_type": "人工转录"},
            "assignee": {"source": "调度系统B", "source_type": "自动分配"},
            "status": {"source": "移动端APP", "source_type": "师傅更新"}
        }
    }
    orders.append(mixed_source_order)
    
    boundary_order_missing_field = {
        "order_id": "WO2024051012",
        "source_system": "物业系统C",
        "description": "边界测试-缺少report_date字段",
        "status": "待处理",
        "building": "B栋",
        "room": "301",
        "_meta": {
            "description": {"source": "测试数据", "source_type": "manual"}
        }
    }
    orders.append(boundary_order_missing_field)
    
    boundary_order_invalid_date = {
        "order_id": "WO12",
        "source_system": "物业系统D",
        "report_date": "2024/05/11",
        "created_at": "2024-05-11T10:00:00",
        "repair_type": "空调",
        "building": "C栋",
        "room": "502",
        "description": "边界测试-日期格式错误+order_id太短",
        "status": "待处理",
        "_meta": {
            "report_date": {"source": "Excel导入", "source_type": "import", "rule": "格式转换失败"},
            "order_id": {"source": "手动编号", "source_type": "manual"}
        }
    }
    orders.append(boundary_order_invalid_date)
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)
    
    print(f"样例数据已生成: {output_file}")
    print(f"  - 正常记录: 10条")
    print(f"  - 来源混杂记录: 1条 (WO2024051011)")
    print(f"  - 边界失败记录: 2条")
    print(f"    * 缺少字段: WO2024051012")
    print(f"    * 格式错误+短ID: WO12")


if __name__ == "__main__":
    generate_sample_data("./sample_repair_orders.json")
