#!/usr/bin/env python3
import subprocess
import sys
import time
import json
import os

PY = sys.executable
CARWASH = "carwash.py"
DATA_FILE = "carwash_data.json"


def run(cmd, desc=None):
    if desc:
        print("\n" + "=" * 60)
        print(f"▶ {desc}")
        print("=" * 60)
    print(f"$ {cmd}")
    result = subprocess.run([PY, CARWASH] + cmd.split(), capture_output=True, text=True)
    if result.stdout:
        print(result.stdout.rstrip())
    if result.stderr:
        print(result.stderr.rstrip())
    print()
    time.sleep(0.1)
    return result


def get_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def snapshot(title):
    print("\n" + "=" * 60)
    print(f"📸 {title}")
    print("=" * 60)
    data = get_data()
    if not data:
        print("无数据")
        return

    print("\n【预付卡状态】")
    for cid, card in data["cards"].items():
        print(f"  {cid} ({card['owner']}): 次数={card['remaining_washes']}, 余额={card['balance']}")

    print("\n【排队车辆】")
    for v in data["queue"]:
        status = f"[{v['status']}]"
        if v["station"]:
            status += f" 工位{v['station']}"
        if v["exception"]:
            status += f" ⚠{v['exception']}"
        addons = []
        if v["wax"]:
            addons.append("打蜡")
        if v["interior"]:
            addons.append("内饰")
        addon_str = f" +{'+'.join(addons)}" if addons else ""
        print(f"  #{v['queue_number']} {v['plate']}: {v['service_type']}{addon_str} {status}")
        if v["amount_charged"] > 0 or v["washes_deducted"] > 0:
            print(f"      已收费: {v['amount_charged']} 元, 扣次: {v['washes_deducted']}")

    print("\n【工位占用】")
    for station, vid in data["stations"].items():
        if vid:
            v = next((c for c in data["queue"] if c["id"] == vid), None)
            if v:
                print(f"  工位{station}: {v['plate']}")
            else:
                print(f"  工位{station}: 占用 (未知)")
        else:
            print(f"  工位{station}: 空闲")

    today = time.strftime("%Y-%m-%d")
    today_txs = [t for t in data["transactions"] if t["date"] == today]
    income = sum(t["amount"] for t in today_txs if t["type"] in ["收入", "消费"])
    print(f"\n【今日收入】{income} 元 (交易 {len(today_txs)} 笔)")


def main():
    print("\n" + "#" * 60)
    print("# 洗车店排队预付卡 CLI - 完整演示")
    print("#" * 60)

    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)

    print("\n" + "-" * 60)
    print("【场景1: 初始化演示数据】")
    print("-" * 60)
    run("init-demo", "初始化预付卡")

    print("\n" + "-" * 60)
    print("【场景2: 车辆入队 - 普通洗车、会员扣次、加项】")
    print("-" * 60)
    run("enqueue 京A10001 普通洗车", "入队: 京A10001 (普通洗车)")
    run("enqueue 京A20002 会员扣次 --card C001", "入队: 京A20002 (会员扣次 C001)")
    run("enqueue 京A30003 普通洗车 --wax", "入队: 京A30003 (普通洗车 +打蜡)")
    run("enqueue 京A40004 会员扣次 --card C002 --interior", "入队: 京A40004 (会员扣次 C002 +内饰)")

    snapshot("入队完成后的状态")

    print("\n" + "-" * 60)
    print("【场景3: 叫号分配工位 - 验证扣次】")
    print("-" * 60)
    run("call 京A10001", "叫号: 京A10001 (普通洗车)")
    run("call 京A20002", "叫号: 京A20002 (会员扣次, 扣1次)")
    run("call 京A30003", "叫号: 京A30003 (普通洗车 +打蜡)")

    snapshot("3个工位满员后的状态")

    run("call 京A40004", "叫号: 京A40004 (无空闲工位)")

    print("\n" + "-" * 60)
    print("【场景4: 完成服务 - 收费 & 释放工位】")
    print("-" * 60)
    run("complete 京A10001", "完成: 京A10001 (收费30元)")
    run("complete 京A20002", "完成: 京A20002 (扣次1次, 无额外收费)")
    run("complete 京A30003", "完成: 京A30003 (收费 30+50=80元)")

    snapshot("完成3辆车后的状态")

    run("call 京A40004", "叫号: 京A40004 (现在有空闲工位了)")
    run("complete 京A40004", "完成: 京A40004 (扣余额 30+80=110元)")

    snapshot("全部完成后的状态")

    print("\n" + "-" * 60)
    print("【场景5: 爽约测试】")
    print("-" * 60)
    run("enqueue 京A55555 会员扣次 --card C003", "入队: 京A55555 (准备爽约)")
    run("call 京A55555", "叫号: 京A55555")
    run("cancel 京A55555 --no-show", "爽约: 京A55555 (扣次返还?)")

    snapshot("爽约后的状态 - 验证扣次是否返还")

    run("enqueue 京A55555 会员扣次 --card C003", "爽约后再次入队: 京A55555 (应标记异常)")
    snapshot("爽约后再次入队 - 验证异常标记")

    print("\n" + "-" * 60)
    print("【场景6: 异常场景测试】")
    print("-" * 60)
    run("reset", "重置数据")
    run("init-demo", "重新初始化")

    run("enqueue 京A99999 会员扣次 --card C004", "入队: 京A99999 - 余额/次数为0的卡 (应异常)")
    run("enqueue 京A88888 普通洗车 --wax --addon-unpaid", "入队: 京A88888 - 加项未付费 (应异常)")

    snapshot("异常车辆状态")

    print("\n" + "-" * 60)
    print("【场景7: 重复叫号/重复完成 - 验证幂等性】")
    print("-" * 60)
    run("reset", "重置数据")
    run("init-demo", "重新初始化")

    run("enqueue 京A66666 普通洗车", "入队: 京A66666")
    run("call 京A66666", "第1次叫号: 京A66666")
    snapshot("第一次叫号后 - 记录卡状态和收入")

    print("⚠ 记录基准状态:")
    data_before = get_data()
    card_before = data_before["cards"]["C001"]["remaining_washes"]
    income_before = sum(t["amount"] for t in data_before["transactions"])
    print(f"  C001 次数: {card_before}")
    print(f"  当前收入: {income_before}")

    run("call 京A66666", "第2次叫号: 京A66666 (应提示重复, 不重复扣次)")
    run("call 京A66666", "第3次叫号: 京A66666 (重复)")

    snapshot("重复叫号后 - 验证状态未变化")

    data_after_calls = get_data()
    card_after = data_after_calls["cards"]["C001"]["remaining_washes"]
    income_after = sum(t["amount"] for t in data_after_calls["transactions"])
    print(f"\n对比:")
    print(f"  C001 次数: {card_before} -> {card_after} (应相同)")
    print(f"  当前收入: {income_before} -> {income_after} (应相同)")

    run("complete 京A66666", "第1次完成: 京A66666")
    snapshot("第一次完成后")

    data_before_complete = get_data()
    income_before_complete = sum(t["amount"] for t in data_before_complete["transactions"])

    run("complete 京A66666", "第2次完成: 京A66666 (应提示重复, 不重复收费)")
    run("complete 京A66666", "第3次完成: 京A66666 (重复)")

    snapshot("重复完成后 - 验证收入未重复计算")

    data_after_complete = get_data()
    income_after_complete = sum(t["amount"] for t in data_after_complete["transactions"])
    print(f"\n对比:")
    print(f"  收入: {income_before_complete} -> {income_after_complete} (应相同)")

    print("\n" + "-" * 60)
    print("【场景8: 导出日报】")
    print("-" * 60)
    run("reset", "重置数据")
    run("init-demo", "重新初始化")

    run("enqueue 京A00001 普通洗车", "测试数据 1")
    run("enqueue 京A00002 会员扣次 --card C001 --wax", "测试数据 2")
    run("enqueue 京A00003 普通洗车 --interior", "测试数据 3")
    run("call 京A00001", "叫号 1")
    run("call 京A00002", "叫号 2")
    run("complete 京A00001", "完成 1")
    run("complete 京A00002", "完成 2")
    run("call 京A00003", "叫号 3")
    run("complete 京A00003", "完成 3")

    run("export", "导出日报")

    print("\n" + "#" * 60)
    print("# 演示完成！")
    print("#" * 60)


if __name__ == "__main__":
    main()
