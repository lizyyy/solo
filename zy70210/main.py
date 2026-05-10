import sys
import json
import os
from typing import List, Dict, Any

from manager import RouteCalibrationManager
from sample_data import (
    sample_routes,
    sample_dirty_routes,
    sample_feedbacks,
    sample_dirty_feedbacks,
    get_expectations,
)


def print_separator():
    print("\n" + "=" * 80)


def print_title(title: str):
    print_separator()
    print(f"  {title}")
    print_separator()


def print_dict(data: Dict[str, Any], indent: int = 2):
    print(json.dumps(data, ensure_ascii=False, indent=indent))


def run_demo():
    print_title("攀岩馆线路难度标定台 - 演示程序")
    print("\n本程序将演示以下核心功能：")
    print("  1. 新增线路（含自动难度计算）")
    print("  2. 脏数据处理（进入问题列表，保留来源）")
    print("  3. 新增试爬反馈（动态调整难度）")
    print("  4. 修改线路")
    print("  5. 提交审核 / 确认 / 拒绝")
    print("  6. 导出线路档案")
    print("  7. 查看操作日志")
    print("  8. 查看问题列表")

    manager = RouteCalibrationManager()
    route_ids = []

    print_title("第一阶段：新增有效线路")
    print("\n预期：")
    expectations = get_expectations()
    for i, exp in enumerate([expectations["route_0_expectation"], expectations["route_1_expectation"]]):
        print(f"  线路{i+1} '{exp['name']}': 预期难度 {exp['expected_base_difficulty']}")
        print(f"    原因: {exp['reason']}")
        print(f"    角度乘数: {exp['angle_multiplier']}")

    print("\n实际执行：")
    for i, route_data in enumerate(sample_routes):
        print(f"\n--- 新增线路 {i+1}: {route_data['name']} ---")
        route, result = manager.add_route(
            name=route_data["name"],
            wall_section=route_data["wall_section"],
            angle=route_data["angle"],
            holds_data=route_data["holds"],
            notes=route_data["notes"],
        )

        print_dict(result)

        if result["success"]:
            route_ids.append(route.id)
            print(f"\n线路创建成功！ID: {route.id}")
        else:
            print(f"\n线路创建失败！")

    print_title("第二阶段：新增脏数据线路（测试问题列表机制）")
    print("\n脏数据包含以下问题：")
    print("  - 线路名称为空")
    print("  - 墙壁角度75度（超出-30到60度范围）")
    print("  - 抓点ID为空")
    print("  - 抓点坐标超出范围(x=-10, y=150)")
    print("  - 抓点大小3.0（超出0-2范围）")
    print("  - 抓点难度贡献3.0（超出0.5-2.0范围）")
    print("  - 无起点/终点抓点")
    print("  - 不足3个手抓点")

    print("\n实际执行：")
    for route_data in sample_dirty_routes:
        print("\n--- 尝试新增脏数据线路 ---")
        route, result = manager.add_route(
            name=route_data["name"],
            wall_section=route_data["wall_section"],
            angle=route_data["angle"],
            holds_data=route_data["holds"],
            notes=route_data["notes"],
        )
        print_dict(result)

    print_title("第三阶段：查看问题列表（脏数据已进入，保留来源）")
    issues = manager.get_issues(unresolved_only=True)
    print(f"\n共有 {len(issues)} 个未解决的问题：")
    for i, issue in enumerate(issues):
        print(f"\n问题 {i+1}:")
        print(f"  类型: {issue['type']}")
        print(f"  来源: {issue['source']}")
        print(f"  原因: {issue['reason']}")
        print(f"  原始数据: {json.dumps(issue['data'], ensure_ascii=False)}")

    print_title("第四阶段：新增试爬反馈（动态调整难度）")
    print("\n反馈权重说明：")
    print(f"  {expectations['feedback_weighting']}")
    print("\n抓点难度说明：")
    for hold_type, desc in expectations["difficulty_scaling"].items():
        print(f"  {hold_type}: {desc}")

    print("\n实际执行：")
    for i, fb_data in enumerate(sample_feedbacks):
        route_idx = fb_data["route_index"]
        if route_idx < len(route_ids):
            route_id = route_ids[route_idx]
            route_info = manager.get_route(route_id)
            print(f"\n--- 为线路 '{route_info['name']}' 添加反馈 {i+1} ---")
            print(f"  试爬者: {fb_data['climber_name']} (经验: {fb_data['climber_experience_level']})")
            print(f"  感知难度: {fb_data['perceived_difficulty']}")
            print(f"  完成: {fb_data['completed']}, 尝试次数: {fb_data['number_of_attempts']}")

            feedback, result = manager.add_feedback(
                route_id=route_id,
                climber_name=fb_data["climber_name"],
                climber_experience_level=fb_data["climber_experience_level"],
                completed=fb_data["completed"],
                perceived_difficulty=fb_data["perceived_difficulty"],
                number_of_attempts=fb_data["number_of_attempts"],
                time_taken=fb_data.get("time_taken"),
                comments=fb_data.get("comments"),
            )

            print_dict(result)

    print_title("第五阶段：新增脏数据反馈（测试问题列表机制）")
    print("\n脏数据反馈包含以下问题：")
    print("  - 试爬者名称为空")
    print("  - 经验等级无效（superman）")
    print("  - 难度等级无效（V99）")
    print("  - 尝试次数为0")

    print("\n实际执行：")
    for fb_data in sample_dirty_feedbacks:
        route_idx = fb_data["route_index"]
        if route_idx < len(route_ids):
            route_id = route_ids[route_idx]
            print(f"\n--- 尝试为线路添加脏数据反馈 ---")
            feedback, result = manager.add_feedback(
                route_id=route_id,
                climber_name=fb_data["climber_name"],
                climber_experience_level=fb_data["climber_experience_level"],
                completed=fb_data["completed"],
                perceived_difficulty=fb_data["perceived_difficulty"],
                number_of_attempts=fb_data["number_of_attempts"],
            )
            print_dict(result)

    print_title("第六阶段：查看当前所有线路状态")
    all_routes = manager.list_routes()
    print(f"\n共有 {len(all_routes)} 条线路：")
    for route in all_routes:
        print(f"\n线路: {route['name']}")
        print(f"  ID: {route['id']}")
        print(f"  状态: {route['status']}")
        print(f"  墙段: {route['wall_section']}")
        print(f"  角度: {route['angle']}度")
        print(f"  建议难度: {route['proposed_difficulty']}")
        print(f"  确认难度: {route['confirmed_difficulty']}")
        print(f"  抓点数: {route['holds_count']}")
        print(f"  反馈数: {route['feedbacks_count']}")
        print(f"  基础分数: {route['base_score']:.4f}")
        if route["breakdown"]:
            print(f"  分数明细: {route['breakdown']}")

    print_title("第七阶段：修改线路")
    if route_ids:
        route_id = route_ids[0]
        route_info = manager.get_route(route_id)
        print(f"\n--- 修改线路 '{route_info['name']}' ---")
        print("  更新：将角度从 10度 改为 25度（应提高难度）")

        route, result = manager.update_route(
            route_id=route_id,
            updates={
                "angle": 25,
                "notes": "调整了墙角度，增加了难度",
            },
        )
        print_dict(result)

        route_info = manager.get_route(route_id)
        print(f"\n修改后的建议难度: {route_info['proposed_difficulty']}")

    print_title("第八阶段：提交审核 / 确认 / 拒绝")
    if len(route_ids) >= 2:
        route1_id = route_ids[0]
        route2_id = route_ids[1]
        route1_info = manager.get_route(route1_id)
        route2_info = manager.get_route(route2_id)

        print(f"\n--- 提交线路 '{route1_info['name']}' 到审核 ---")
        result = manager.submit_for_review(route1_id)
        print_dict(result)

        print(f"\n--- 确认线路 '{route1_info['name']}' ---")
        result = manager.confirm_route(route1_id)
        print_dict(result)

        print(f"\n--- 提交线路 '{route2_info['name']}' 到审核 ---")
        result = manager.submit_for_review(route2_id)
        print_dict(result)

        print(f"\n--- 拒绝线路 '{route2_info['name']}' ---")
        result = manager.reject_route(route2_id, "抓点配置不合理，需要重新调整仰角区域的抓点")
        print_dict(result)

    print_title("第九阶段：导出线路档案")
    export_path = os.path.join(os.getcwd(), "routes_export.json")
    result = manager.export_routes(export_path)
    print(f"\n导出结果：")
    print_dict(result)
    print(f"\n导出文件已保存到: {export_path}")

    print_title("第十阶段：查看操作日志（每一步都有输入、输出、失败原因）")
    logs = manager.get_operation_logs()
    print(f"\n共有 {len(logs)} 条操作记录（显示最近 5 条）：")
    for i, log in enumerate(logs[:5]):
        print(f"\n日志 {i+1}:")
        print(f"  操作: {log['operation']}")
        print(f"  成功: {log['success']}")
        print(f"  时间: {log['timestamp']}")
        if log["error_reason"]:
            print(f"  失败原因: {log['error_reason']}")
        print(f"  输入: {json.dumps(log['input_data'], ensure_ascii=False)}")
        print(f"  输出: {json.dumps(log['output_data'], ensure_ascii=False)}")

    print_title("第十一阶段：最终验证 - 问题列表")
    issues = manager.get_issues(unresolved_only=True)
    print(f"\n共有 {len(issues)} 个未解决的问题：")
    for issue in issues:
        print(f"  [{issue['type']}] {issue['reason']} (来源: {issue['source']})")

    print_title("演示完成！")
    print("\n总结：")
    print("  1. 线路档案：创建成功，包含抓点配置、坡度、难度计算")
    print("  2. 抓点配置：不同类型有不同难度权重，大小影响难度")
    print("  3. 试爬反馈：根据经验等级加权，多次反馈调整难度")
    print("  4. 脏数据：全部进入问题列表，保留原始数据和来源")
    print("  5. 操作日志：每一步都有输入、输出、失败原因可查询")
    print("  6. 导出功能：完整导出所有线路的详细信息")
    print("\n查看导出文件 routes_export.json 可获得完整的线路详情")
    print("\n所有规则都可以通过查看操作日志和问题列表来验证，无需阅读源码")

    return manager


def interactive_mode():
    manager = RouteCalibrationManager()
    route_ids = []

    while True:
        print_title("攀岩馆线路难度标定台 - 交互模式")
        print("\n请选择操作：")
        print("  1. 新增线路")
        print("  2. 新增试爬反馈")
        print("  3. 查看所有线路")
        print("  4. 提交线路审核")
        print("  5. 确认线路")
        print("  6. 拒绝线路")
        print("  7. 查看问题列表")
        print("  8. 查看操作日志")
        print("  9. 导出线路档案")
        print("  0. 运行完整演示")
        print("  q. 退出")

        choice = input("\n请输入选项: ").strip().lower()

        if choice == "1":
            name = input("线路名称: ")
            wall_section = input("墙段位置: ")
            angle = float(input("墙壁角度: "))
            print("\n抓点配置（输入完成后输入空行结束）：")
            holds = []
            hold_idx = 1
            while True:
                print(f"\n抓点 {hold_idx}:")
                hold_type = input("  类型(jug/crimp/sloper/pocket/pinch/foothold): ")
                if not hold_type:
                    break
                try:
                    x = float(input("  x坐标(0-100): "))
                    y = float(input("  y坐标(0-100): "))
                    size = float(input("  大小(0-2): "))
                    diff = float(input("  难度贡献(0.5-2.0): "))
                    is_start = input("  是起点?(y/n): ").lower() == "y"
                    is_end = input("  是终点?(y/n): ").lower() == "y"
                    holds.append({
                        "id": f"h{hold_idx}",
                        "type": hold_type,
                        "position": {"x": x, "y": y},
                        "size": size,
                        "difficulty_contribution": diff,
                        "is_start": is_start,
                        "is_end": is_end,
                    })
                    hold_idx += 1
                except ValueError:
                    print("输入错误，请重新输入")

            route, result = manager.add_route(name, wall_section, angle, holds)
            print_dict(result)
            if result["success"]:
                route_ids.append(route.id)

        elif choice == "2":
            if not route_ids:
                print("请先新增线路")
                continue
            print("\n现有线路：")
            for i, rid in enumerate(route_ids):
                info = manager.get_route(rid)
                print(f"  {i}. {info['name']}")
            try:
                idx = int(input("选择线路编号: "))
                if 0 <= idx < len(route_ids):
                    route_id = route_ids[idx]
                    climber_name = input("试爬者名称: ")
                    level = input("经验等级(beginner/intermediate/advanced/expert): ")
                    completed = input("是否完成?(y/n): ").lower() == "y"
                    diff = input("感知难度(V0-V12): ")
                    try:
                        attempts = int(input("尝试次数: "))
                    except ValueError:
                        attempts = 1

                    feedback, result = manager.add_feedback(
                        route_id, climber_name, level, completed,
                        diff if diff else None, attempts
                    )
                    print_dict(result)
            except ValueError:
                print("无效输入")

        elif choice == "3":
            routes = manager.list_routes()
            for route in routes:
                print(f"\n{route['name']}")
                print(f"  状态: {route['status']}")
                print(f"  建议难度: {route['proposed_difficulty']}")
                print(f"  确认难度: {route['confirmed_difficulty']}")

        elif choice == "4":
            if not route_ids:
                print("请先新增线路")
                continue
            try:
                idx = int(input("线路编号: "))
                if 0 <= idx < len(route_ids):
                    result = manager.submit_for_review(route_ids[idx])
                    print_dict(result)
            except ValueError:
                print("无效输入")

        elif choice == "5":
            if not route_ids:
                print("请先新增线路")
                continue
            try:
                idx = int(input("线路编号: "))
                if 0 <= idx < len(route_ids):
                    diff = input("确认难度(留空使用建议难度): ")
                    result = manager.confirm_route(route_ids[idx], diff if diff else None)
                    print_dict(result)
            except ValueError:
                print("无效输入")

        elif choice == "6":
            if not route_ids:
                print("请先新增线路")
                continue
            try:
                idx = int(input("线路编号: "))
                if 0 <= idx < len(route_ids):
                    reason = input("拒绝原因: ")
                    result = manager.reject_route(route_ids[idx], reason)
                    print_dict(result)
            except ValueError:
                print("无效输入")

        elif choice == "7":
            issues = manager.get_issues(unresolved_only=True)
            print(f"\n共有 {len(issues)} 个问题：")
            for issue in issues:
                print(f"\n[{issue['type']}] {issue['reason']}")
                print(f"  来源: {issue['source']}")
                print(f"  数据: {json.dumps(issue['data'], ensure_ascii=False)}")

        elif choice == "8":
            logs = manager.get_operation_logs()
            print(f"\n最近 10 条操作日志：")
            for log in logs[:10]:
                status = "✓" if log["success"] else "✗"
                print(f"\n{status} {log['operation']}")
                if log["error_reason"]:
                    print(f"  失败原因: {log['error_reason']}")

        elif choice == "9":
            path = input("导出路径(留空使用默认): ").strip()
            if not path:
                path = os.path.join(os.getcwd(), "routes_export.json")
            result = manager.export_routes(path)
            print_dict(result)

        elif choice == "0":
            run_demo()
            break

        elif choice == "q":
            print("再见！")
            break

        else:
            print("无效选项")

        input("\n按回车继续...")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        run_demo()
    else:
        print("\n运行方式：")
        print("  python main.py        - 交互模式")
        print("  python main.py --demo - 运行完整演示")
        print()
        interactive_mode()
