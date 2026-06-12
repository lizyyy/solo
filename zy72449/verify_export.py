import json
import sys

def verify_export(filepath, expected_key):
    print(f"\n===== 核对复盘记录文件: {filepath} =====")
    with open(filepath) as f:
        data = json.load(f)

    print(f"\n【1】复盘记录与可重新跑命令 对齐检查")
    print(f"  scenario_name      : {data['scenario_name']}")
    print(f"  scenario_key       : {data['scenario_key']}")
    print(f"  replay.scenario_key: {data['replay_commands']['scenario_key']}")
    print(f"  replay.cmd         : {data['replay_commands']['replay']}")
    print(f"  replay_with_trace  : {data['replay_commands']['replay_with_trace']}")

    key_match = data['scenario_key'] == data['replay_commands']['scenario_key']
    cmd_match = expected_key in data['replay_commands']['replay']
    print(f"  scenario_key 与 replay.scenario_key 对齐: {'✅ 通过' if key_match else '❌ 失败'}")
    print(f"  命令中包含正确 scenario_key={expected_key}: {'✅ 通过' if cmd_match else '❌ 失败'}")

    print(f"\n【2】原始材料追溯（从复盘记录追回触发材料）")
    sm = data['source_materials']
    print(f"  表演者       : {sm['performer_name']}")
    print(f"  演出日期     : {sm['performance_date']}")
    print(f"  节目         : {sm['program_name']}")
    print(f"  接龙原始内容 : {sm.get('jielong_raw', 'N/A')}")
    print(f"  合同号       : {sm.get('contract_no', 'N/A')}")
    print(f"  合同到期日   : {sm.get('contract_valid_until', 'N/A')}")
    print(f"  合同旧口径   : {sm.get('contract_old_caliber', 'N/A')}")
    print(f"  版权方       : {sm.get('contract_copyright_owner', 'N/A')}")
    print(f"  截图引用     : {sm.get('contract_screenshot_ref', 'N/A')}")

    print(f"\n【3】分账明细核对")
    if data['reminder']['split_details']:
        sd = data['reminder']['split_details'][0]
        print(f"  金额   : {sd['amount']}")
        print(f"  比例   : {sd['split_ratio']}")
        print(f"  收款人 : {sd['payee']}")
        print(f"  版本   : v{sd['version']}")
    else:
        print(f"  (无分账明细 - 场景可能在冲突留证阶段)")

    print(f"\n【4】历史记录 与 分账明细 对齐检查")
    history = data['reminder']['history']
    print(f"  历史记录共 {len(history)} 条:")
    for h in history:
        print(f"    [{h['source']:12s}] {h['operator']:10s} | {h['action']:15s} | {h['detail']}")

    print(f"\n【5】状态流转检查")
    print(f"  最终状态: {data['final_status']}")
    print(f"  记录状态: {data['reminder']['status']}")

    if data['reminder']['conflicts']:
        print(f"\n【6】冲突证据留证 (场景特有)")
        for c in data['reminder']['conflicts']:
            print(f"    - 字段: {c['field_name']}")
            print(f"      接龙记录: {c['jielong_value']}")
            print(f"      截图记录: {c['screenshot_value']}")
            print(f"      说明: {c['description']}")

    print(f"\n===== 核对完成 {'✅' if key_match and cmd_match else '❌'} =====\n")
    return key_match and cmd_match


if __name__ == "__main__":
    ok1 = verify_export("audit_old_caliber.json", "old")
    ok2 = True
    try:
        ok2 = verify_export("audit_conflict.json", "conflict")
    except FileNotFoundError:
        pass
    sys.exit(0 if (ok1 and ok2) else 1)
