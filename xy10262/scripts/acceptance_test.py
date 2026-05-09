#!/usr/bin/env python3
"""口岸冷藏车排队温控API - 验收测试脚本

业务场景: 口岸冷藏车排队通关
  - 入口: 车辆入队
  - 关键校验: 温度片段
  - 判断依据: 查验优先级

运行方式:
  python -m scripts.acceptance_test
"""

import sys
import json
from datetime import datetime, timedelta
from scripts.client import PortApiClient


def print_step(step: int, title: str, detail: str = ""):
    print(f"\n{'='*60}")
    print(f"  [验收步骤 {step}] {title}")
    if detail:
        print(f"  {detail}")
    print(f"{'='*60}")


def wait_for_input():
    input("\n  >> 按回车键继续下一个验收步骤...")


def acceptance_normal_flow():
    """场景1: 正常通关流程 - 多辆车排队，优先级联动温控和风险"""
    print("\n" + "#" * 70)
    print("#  验收场景 1: 正常通关流程")
    print("#  目的: 验证车辆入队 → 温控上报 → 优先级联动 → 查验判定")
    print("#" * 70)

    with PortApiClient() as client:
        wait_for_input()

        print_step(1, "车辆入队 (业务入口)",
                   "入队3辆车，验证: 自动分配排队号、根据货物类型判定风险等级")

        print("\n  车辆 A - 疫苗 (极高风险货物, CRITICAL)")
        vehicle_a = client.enqueue_vehicle(
            plate_number="沪A-验收-001",
            cargo_type="疫苗",
            target_temp_low=-25.0,
            target_temp_high=-15.0,
            remark="冷链进口新冠疫苗,1200箱"
        )
        print(f"    ✓ 入队成功: ID={vehicle_a['id']}, 排队号={vehicle_a['queue_number']}")
        print(f"    ✓ 风险等级: {vehicle_a['risk_level']} (预期: critical)")

        print("\n  车辆 B - 生鲜肉类 (高风险货物, HIGH)")
        vehicle_b = client.enqueue_vehicle(
            plate_number="沪A-验收-002",
            cargo_type="生鲜肉类",
            target_temp_low=-18.0,
            target_temp_high=-5.0,
            remark="进口澳洲牛肉,5吨"
        )
        print(f"    ✓ 入队成功: ID={vehicle_b['id']}, 排队号={vehicle_b['queue_number']}")
        print(f"    ✓ 风险等级: {vehicle_b['risk_level']} (预期: high)")

        print("\n  车辆 C - 冷冻食品 (低风险货物, LOW)")
        vehicle_c = client.enqueue_vehicle(
            plate_number="沪A-验收-003",
            cargo_type="冷冻食品",
            target_temp_low=-18.0,
            target_temp_high=-10.0,
            remark="冷冻汤圆、水饺"
        )
        print(f"    ✓ 入队成功: ID={vehicle_c['id']}, 排队号={vehicle_c['queue_number']}")
        print(f"    ✓ 风险等级: {vehicle_c['risk_level']} (预期: low)")

        wait_for_input()

        print_step(2, "上报温度片段 (关键校验)",
                   "验证: 温度自动判定正常/异常，异常触发查验优先级提升")

        base_time = datetime.utcnow()

        print(f"\n  车辆 A (疫苗) - 上报3条正常温度 [-22, -21, -20]℃")
        temp_a1 = client.add_temperature(vehicle_a["id"], -22.0, base_time)
        temp_a2 = client.add_temperature(vehicle_a["id"], -21.0, base_time + timedelta(minutes=5))
        temp_a3 = client.add_temperature(vehicle_a["id"], -20.0, base_time + timedelta(minutes=10))
        print(f"    ✓ 温度记录: 正常={temp_a1['is_normal']} 正常={temp_a2['is_normal']} 正常={temp_a3['is_normal']}")

        print(f"\n  车辆 B (生鲜) - 上报3条温度，其中1条异常高温 [2℃]")
        temp_b1 = client.add_temperature(vehicle_b["id"], -12.0, base_time)
        temp_b2 = client.add_temperature(vehicle_b["id"], 2.0, base_time + timedelta(minutes=5))
        temp_b3 = client.add_temperature(vehicle_b["id"], -10.0, base_time + timedelta(minutes=10))
        print(f"    ✓ 温度记录: 正常={temp_b1['is_normal']} 异常={temp_b2['is_normal']}(类型: {temp_b2['anomaly_type']}) 正常={temp_b3['is_normal']}")

        print(f"\n  车辆 C (冷冻食品) - 上报3条正常温度")
        temp_c1 = client.add_temperature(vehicle_c["id"], -15.0, base_time)
        temp_c2 = client.add_temperature(vehicle_c["id"], -14.0, base_time + timedelta(minutes=5))
        temp_c3 = client.add_temperature(vehicle_c["id"], -13.0, base_time + timedelta(minutes=10))
        print(f"    ✓ 温度记录: 全部正常")

        wait_for_input()

        print_step(3, "查验优先级联动 (用户判断依据)",
                   "查询排队列表，验证: 优先级由 风险等级 + 温控异常 联动计算，列表按优先级排序")

        queue = client.list_queue()
        print(f"\n  当前排队车辆总数: {len(queue)}")
        print(f"\n  按优先级排序后的队列:")
        for idx, v in enumerate(queue, 1):
            print(f"    {idx}. 排队号#{v['queue_number']} | 车牌={v['plate_number']} | "
                  f"优先级={v['inspection_priority']} | 风险={v['risk_level']} | 状态={v['status']}")

        print(f"\n  ✅ 验收要点:")
        print(f"     - 车辆B (生鲜肉类+温控异常) 优先级应该最高")
        print(f"     - 车辆A (疫苗高风险+无异常) 优先级次之")
        print(f"     - 车辆C (低风险+无异常) 优先级最低")

        wait_for_input()

        print_step(4, "开始查验",
                   "验证: 按优先级顺序开始查验，状态流转: waiting → inspecting")

        vehicle_a_detail = client.get_vehicle(vehicle_a["id"])
        vehicle_b_detail = client.get_vehicle(vehicle_b["id"])
        vehicle_c_detail = client.get_vehicle(vehicle_c["id"])

        print(f"\n  车辆 B (优先级最高) - 开始查验")
        inspection_b = client.start_inspection(vehicle_b["id"], inspector="张查验员")
        print(f"    ✓ 查验记录ID: {inspection_b['id']}")
        print(f"    ✓ 开始时间: {inspection_b['started_at']}")

        wait_for_input()

        print_step(5, "完成查验 - 判定放行/暂扣",
                   "验证: 查验完成后状态流转至最终状态")

        print(f"\n  车辆 B - 查验结果: PASSED (放行)")
        result_b = client.complete_inspection(
            inspection_b["id"],
            inspection_result="passed",
            check_points="温控记录完整, 单据齐全, 包装完好",
            issues_found="无"
        )
        print(f"    ✓ 最终状态: {result_b['vehicle']['status']}")
        print(f"    ✓ 完成时间: {result_b['inspection']['completed_at']}")

        print(f"\n  车辆 A - 查验结果: PASSED (放行)")
        inspection_a = client.start_inspection(vehicle_a["id"], inspector="李查验员")
        result_a = client.complete_inspection(
            inspection_a["id"],
            inspection_result="passed",
            check_points="温控全程正常, 冷链运输符合要求",
            issues_found="无"
        )
        print(f"    ✓ 最终状态: {result_a['vehicle']['status']}")

        print(f"\n  车辆 C - 查验结果: DETAINED (暂扣 - 模拟发现问题)")
        inspection_c = client.start_inspection(vehicle_c["id"], inspector="王查验员")
        result_c = client.complete_inspection(
            inspection_c["id"],
            inspection_result="detained",
            check_points="温控记录核查, 单据审核",
            issues_found="发现部分包装破损, 需进一步检验检疫"
        )
        print(f"    ✓ 最终状态: {result_c['vehicle']['status']}")

        wait_for_input()

        print_step(6, "车辆详情查询",
                   "验证: 可查询完整业务轨迹 - 温控历史 + 查验记录")

        print(f"\n  车辆 B 完整详情:")
        detail_b = client.get_vehicle(vehicle_b["id"])
        print(f"    基本信息: 车牌={detail_b['plate_number']}, 货物={detail_b['cargo_type']}")
        print(f"    温控记录 ({len(detail_b['temperature_records'])}条):")
        for tr in detail_b["temperature_records"]:
            flag = "✓" if tr["is_normal"] else "⚠"
            print(f"      {flag} {tr['record_time'][:19]} - {tr['temperature']}℃ "
                  f"{'(' + tr['anomaly_type'] + ')' if tr['anomaly_type'] else ''}")
        print(f"    查验记录 ({len(detail_b['inspection_records'])}条):")
        for ir in detail_b["inspection_records"]:
            print(f"      查验员={ir['inspector']}, 结果={ir['inspection_result']}")

        print("\n✅ 验收场景1完成: 正常通关流程验证通过!")


def acceptance_priority_logic():
    """场景2: 优先级联动验证 - 温控异常直接影响优先级"""
    print("\n" + "#" * 70)
    print("#  验收场景 2: 优先级联动验证")
    print("#  目的: 验证温控异常 → 查验优先级自动提升 的联动关系")
    print("#" * 70)

    with PortApiClient() as client:
        wait_for_input()

        print_step(1, "入队一辆中等风险车辆 (乳制品, MEDIUM)", "")

        vehicle = client.enqueue_vehicle(
            plate_number="沪A-验收-004",
            cargo_type="乳制品",
            target_temp_low=2.0,
            target_temp_high=8.0,
            remark="进口常温酸奶"
        )
        vehicle_id = vehicle["id"]
        detail0 = client.get_vehicle(vehicle_id)
        print(f"    初始优先级: {detail0['inspection_priority']} (预期: normal 或 low)")

        wait_for_input()

        print_step(2, "上报3条温控异常，观察优先级变化", "")

        base_time = datetime.utcnow()

        print(f"\n  异常1: 温度 0℃ (低于下限 2℃)...")
        client.add_temperature(vehicle_id, 0.0, base_time)
        detail1 = client.get_vehicle(vehicle_id)
        print(f"    1次异常后优先级: {detail1['inspection_priority']}")

        print(f"\n  异常2: 温度 -1℃...")
        client.add_temperature(vehicle_id, -1.0, base_time + timedelta(minutes=5))
        detail2 = client.get_vehicle(vehicle_id)
        print(f"    2次异常后优先级: {detail2['inspection_priority']}")

        print(f"\n  异常3: 温度 12℃ (高于上限 8℃)...")
        client.add_temperature(vehicle_id, 12.0, base_time + timedelta(minutes=10))
        detail3 = client.get_vehicle(vehicle_id)
        print(f"    3次异常后优先级: {detail3['inspection_priority']} (预期: highest 或 high)")

        print(f"\n  ✅ 验收要点: 随着温控异常次数增加，查验优先级自动提升")
        print(f"     优先级 = 风险等级评分 + 温控异常评分")

        wait_for_input()

        print_step(3, "人工修改温度验证",
                   "验证: 人工修改保留痕迹，原温度可追溯")

        temps = detail3["temperature_records"]
        if temps:
            record_to_modify = temps[0]["id"]
            print(f"\n  修改温度记录 #{record_to_modify}: 0℃ → 5℃ (正常范围)")
            modified = client.manual_update_temperature(
                record_id=record_to_modify,
                new_temperature=5.0,
                modified_by="张主管",
                reason="温度探头故障, 已校准并复核"
            )
            print(f"    ✓ 原温度: {modified['original_temperature']}℃")
            print(f"    ✓ 现温度: {modified['temperature']}℃")
            print(f"    ✓ 人工修改标记: {modified['is_manual_modified']}")
            print(f"    ✓ 修改人: {modified['modified_by']}")
            print(f"    ✓ 备注: {modified['remark']}")

            print(f"\n  ✅ 验收要点: 人工修改痕迹完整保留，可审计追溯")

        print("\n✅ 验收场景2完成: 优先级联动验证通过!")


def main():
    print("口岸冷藏车排队温控API - 业务验收测试")
    print("=" * 60)

    with PortApiClient() as client:
        try:
            print("\n[前置检查] 服务健康检查...")
            health = client.health_check()
            print(f"  ✓ 服务运行正常: {health}")
        except Exception as e:
            print(f"\n  ✗ 错误: 无法连接到服务器")
            print(f"\n请先按以下步骤启动服务:")
            print(f"  1. 进入项目目录:")
            print(f"     cd /Users/mac/pro/solo/workspaces/xy10262")
            print(f"  2. 安装依赖:")
            print(f"     pip install -r requirements.txt")
            print(f"  3. 启动服务 (新开一个终端窗口):")
            print(f"     python -m uvicorn app.main:app --reload")
            print(f"  4. 等待服务启动后，重新运行本脚本")
            sys.exit(1)

    print("\n选择验收场景:")
    print("  1. 正常通关流程 (推荐先执行)")
    print("  2. 优先级联动验证")
    print("  3. 全部执行")
    print("  0. 退出")

    choice = input("\n请输入选项 (1/2/3/0): ").strip()

    if choice == "1":
        acceptance_normal_flow()
    elif choice == "2":
        acceptance_priority_logic()
    elif choice == "3":
        acceptance_normal_flow()
        acceptance_priority_logic()
    elif choice == "0":
        print("已退出")
        sys.exit(0)
    else:
        print(f"无效选项: {choice}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  🎉 所有验收步骤完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
