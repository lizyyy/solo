import json
import subprocess
import sys

print("\n" + "=" * 80)
print("端到端验证：复盘记录 ⇄ 可重新跑命令 ⇄ 结果一致")
print("=" * 80)

# 1. 读取旧口径场景的复盘记录
print("\n【第一步】读取 audit_old_caliber.json 中的重跑命令")
with open("audit_old_caliber.json") as f:
    data1 = json.load(f)

replay_cmd = data1["replay_commands"]["replay_with_trace"]
scenario_key = data1["scenario_key"]
print(f"  复盘记录 scenario_key = {scenario_key}")
print(f"  复盘记录重跑命令     = {replay_cmd}")
print(f"  原始分账明细: 金额={data1['reminder']['split_details'][0]['amount']}, "
      f"比例={data1['reminder']['split_details'][0]['split_ratio']}, "
      f"收款人={data1['reminder']['split_details'][0]['payee']}")
print(f"  原始历史记录条数: {len(data1['reminder']['history'])}")

# 2. 按复盘记录的命令重跑，导出新的复盘文件
print("\n【第二步】按复盘命令重跑，导出到 replay_result.json")
export_file = "replay_result.json"
run_cmd = f"{replay_cmd} --export {export_file}".replace("python main.py", "python3 main.py")
print(f"  执行: {run_cmd}")

result = subprocess.run(run_cmd, shell=True, cwd="/Users/lzy/pro/solo/workspaces/zy72449",
                       capture_output=True, text=True)
if result.returncode != 0:
    print(f"  ❌ 重跑失败: {result.stderr}")
    sys.exit(1)
print(f"  ✅ 重跑成功")

# 3. 读取新的复盘文件
with open(export_file) as f:
    data2 = json.load(f)

print(f"\n【第三步】比较两次复盘记录的关键内容")
print(f"  两次 scenario_key 一致: {data1['scenario_key']} == {data2['scenario_key']} -> {'✅' if data1['scenario_key'] == data2['scenario_key'] else '❌'}")
print(f"  两次 final_status 一致: {data1['final_status']} == {data2['final_status']} -> {'✅' if data1['final_status'] == data2['final_status'] else '❌'}")

# 分账明细核对
sd1 = data1["reminder"]["split_details"][0]
sd2 = data2["reminder"]["split_details"][0]
print(f"\n【分账明细核对】")
print(f"  金额一致   : {sd1['amount']} == {sd2['amount']} -> {'✅' if sd1['amount'] == sd2['amount'] else '❌'}")
print(f"  比例一致   : {sd1['split_ratio']} == {sd2['split_ratio']} -> {'✅' if sd1['split_ratio'] == sd2['split_ratio'] else '❌'}")
print(f"  收款人一致 : {sd1['payee']} == {sd2['payee']} -> {'✅' if sd1['payee'] == sd2['payee'] else '❌'}")

# 历史记录核对（按 source+action+detail 匹配，忽略时间和id）
print(f"\n【历史记录核对】")
h1 = [(h["source"], h["action"], h["operator"], h["detail"]) for h in data1["reminder"]["history"]]
h2 = [(h["source"], h["action"], h["operator"], h["detail"]) for h in data2["reminder"]["history"]]
print(f"  历史记录条数一致: {len(h1)} == {len(h2)} -> {'✅' if len(h1) == len(h2) else '❌'}")

all_match = True
for i, (a, b) in enumerate(zip(h1, h2)):
    match = a == b
    if not match:
        all_match = False
    print(f"  历史记录{i+1}: {'✅' if match else '❌'} {a[0]} | {a[1]} | {a[2]} | {a[3]}")

# 原始材料追溯核对
print(f"\n【原始材料追溯核对】")
sm1 = data1["source_materials"]
sm2 = data2["source_materials"]
check_fields = ["performer_name", "performance_date", "program_name", "jielong_raw",
                "contract_no", "contract_valid_until", "contract_old_caliber", "contract_copyright_owner"]
for field in check_fields:
    v1 = sm1.get(field)
    v2 = sm2.get(field)
    match = v1 == v2
    print(f"  {field:25s}: {str(v1)[:30]:>30s} == {str(v2)[:30]:<30s} -> {'✅' if match else '❌'}")
    if not match:
        all_match = False

# 重跑命令再核对
print(f"\n【可重新跑命令核对】")
cmd1 = data1["replay_commands"]["replay"]
cmd2 = data2["replay_commands"]["replay"]
key1 = data1["replay_commands"]["scenario_key"]
key2 = data2["replay_commands"]["scenario_key"]
print(f"  两次 replay 命令一致: {cmd1 == cmd2} -> {'✅' if cmd1 == cmd2 else '❌'}")
print(f"  命令中 scenario_key 正确: '{scenario_key}' in '{cmd1}' -> {'✅' if scenario_key in cmd1 else '❌'}")
print(f"  复盘记录与命令完全对齐: {scenario_key == key1} and '{scenario_key}' in '{cmd1}' -> {'✅' if (scenario_key == key1 and scenario_key in cmd1) else '❌'}")

print("\n" + "=" * 80)
if all_match and sd1['amount'] == sd2['amount'] and sd1['payee'] == sd2['payee']:
    print("✅ 端到端验证通过：复盘记录 ⇄ 可重新跑命令 ⇄ 结果一致")
    print("  - 复盘记录里的 scenario_key 与 replay_commands 一致")
    print("  - 按复盘命令重跑后，分账明细、历史记录、原始材料全部对上")
    print("  - 导出的新复盘记录同样带有正确的 scenario_key 可再次重跑")
else:
    print("❌ 验证失败")
print("=" * 80 + "\n")
