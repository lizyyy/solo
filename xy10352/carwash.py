#!/usr/bin/env python3
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional

DATA_FILE = "carwash_data.json"
STATIONS_COUNT = 3

PRICES = {
    "普通洗车": 30,
    "打蜡": 50,
    "内饰清洗": 80,
}


def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if "no_shows" in data and isinstance(data["no_shows"], list):
                data["no_shows"] = set(data["no_shows"])
            if "call_ids" in data and isinstance(data["call_ids"], list):
                data["call_ids"] = set(data["call_ids"])
            if "complete_ids" in data and isinstance(data["complete_ids"], list):
                data["complete_ids"] = set(data["complete_ids"])
            return data
    return {
        "cards": {},
        "queue": [],
        "stations": {str(i): None for i in range(1, STATIONS_COUNT + 1)},
        "transactions": [],
        "no_shows": set(),
        "call_ids": set(),
        "complete_ids": set(),
    }


def save_data(data):
    data_to_save = {
        k: list(v) if isinstance(v, set) else v
        for k, v in data.items()
    }
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data_to_save, f, ensure_ascii=False, indent=2)


def generate_transaction_id():
    return datetime.now().strftime("%Y%m%d%H%M%S%f")


def get_today():
    return datetime.now().strftime("%Y-%m-%d")


def add_transaction(data, transaction_type, amount, plate, details=""):
    data["transactions"].append({
        "id": generate_transaction_id(),
        "time": datetime.now().isoformat(),
        "date": get_today(),
        "type": transaction_type,
        "amount": amount,
        "plate": plate,
        "details": details,
    })


def cmd_enqueue(args):
    data = load_data()
    if len(args) < 2:
        print("用法: carwash enqueue <车牌号> <服务类型> [--card <卡号>] [--wax] [--interior]")
        sys.exit(1)

    plate = args[0]
    service_type = args[1]
    card_id = None
    wax = False
    interior = False
    add_ons_paid = True

    i = 2
    while i < len(args):
        if args[i] == "--card":
            i += 1
            if i >= len(args):
                print("错误: --card 需要卡号参数")
                sys.exit(1)
            card_id = args[i]
        elif args[i] == "--wax":
            wax = True
        elif args[i] == "--interior":
            interior = True
        elif args[i] == "--addon-unpaid":
            add_ons_paid = False
        i += 1

    if service_type not in ["普通洗车", "会员扣次"]:
        print("错误: 服务类型必须是 '普通洗车' 或 '会员扣次'")
        sys.exit(1)

    if service_type == "会员扣次":
        if not card_id:
            print("错误: 会员扣次需要指定 --card 参数")
            sys.exit(1)
        if card_id not in data["cards"]:
            print(f"异常: 预付卡不存在 - 卡号 {card_id}")
            sys.exit(1)
        card = data["cards"][card_id]
        if card["remaining_washes"] <= 0 and card["balance"] <= 0:
            print(f"异常: 预付卡余额/次数不足 - 卡号 {card_id}, 剩余次数: {card['remaining_washes']}, 余额: {card['balance']}")
            sys.exit(1)

    existing = next((c for c in data["queue"] if c["plate"] == plate and c["status"] in ["排队中", "已叫号"]), None)
    if existing:
        print(f"错误: 车辆 {plate} 已在排队中，状态: {existing['status']}")
        sys.exit(1)

    vehicle = {
        "id": f"V{generate_transaction_id()}",
        "plate": plate,
        "service_type": service_type,
        "card_id": card_id,
        "wax": wax,
        "interior": interior,
        "add_ons_paid": add_ons_paid,
        "status": "排队中",
        "called": False,
        "call_count": 0,
        "station": None,
        "queue_number": len(data["queue"]) + 1,
        "enqueue_time": datetime.now().isoformat(),
        "complete_time": None,
        "amount_charged": 0,
        "washes_deducted": 0,
        "exception": None,
    }

    if service_type == "会员扣次":
        card = data["cards"][card_id]
        if plate in data["no_shows"]:
            vehicle["exception"] = "爽约后再次出现"

    if (wax or interior) and not add_ons_paid:
        vehicle["exception"] = "加项未付费"

    data["queue"].append(vehicle)
    save_data(data)
    print(f"✓ 车辆 {plate} 已入队，排队号: {vehicle['queue_number']}")
    if vehicle["exception"]:
        print(f"  ⚠ 异常: {vehicle['exception']}")


def cmd_call(args):
    data = load_data()
    if len(args) < 1:
        print("用法: carwash call <车牌号> [--force]")
        sys.exit(1)

    plate = args[0]
    force = "--force" in args

    vehicle = next((c for c in data["queue"] if c["plate"] == plate and c["status"] == "排队中"), None)
    if not vehicle:
        vehicle = next((c for c in data["queue"] if c["plate"] == plate and c["status"] == "已叫号"), None)
        if vehicle:
            if vehicle["id"] in data["call_ids"]:
                print(f"✗ 重复叫号: 车辆 {plate} 已经叫过号了，不会重复扣次")
                print(f"  当前状态: {vehicle['status']}")
                sys.exit(0)

    if not vehicle:
        print(f"错误: 未找到排队中的车辆 {plate}")
        sys.exit(1)

    if vehicle["id"] in data["call_ids"] and not force:
        print(f"✗ 重复叫号: 车辆 {plate} 已经叫过号了，不会重复扣次")
        sys.exit(0)

    available_station = next((s for s, v in data["stations"].items() if v is None), None)
    if not available_station:
        print("错误: 没有空闲工位")
        sys.exit(1)

    vehicle["status"] = "已叫号"
    vehicle["called"] = True
    vehicle["call_count"] += 1
    vehicle["station"] = available_station
    data["stations"][available_station] = vehicle["id"]
    data["call_ids"].add(vehicle["id"])

    if vehicle["service_type"] == "会员扣次" and vehicle["washes_deducted"] == 0:
        card = data["cards"][vehicle["card_id"]]
        if card["remaining_washes"] > 0:
            card["remaining_washes"] -= 1
            vehicle["washes_deducted"] = 1
            add_transaction(data, "扣次", 0, plate, f"卡号 {vehicle['card_id']} 扣次1次")
        else:
            price = PRICES["普通洗车"]
            if card["balance"] >= price:
                card["balance"] -= price
                vehicle["amount_charged"] += price
                add_transaction(data, "消费", price, plate, f"余额支付洗车费，卡号 {vehicle['card_id']}")
            else:
                vehicle["exception"] = "余额不足"

    save_data(data)
    print(f"✓ 叫号成功: {plate}")
    print(f"  工位: {available_station}")
    print(f"  服务: {vehicle['service_type']}")
    if vehicle["card_id"]:
        card = data["cards"][vehicle["card_id"]]
        print(f"  卡余额: 次数={card['remaining_washes']}, 金额={card['balance']}")
    if vehicle["exception"]:
        print(f"  ⚠ 异常: {vehicle['exception']}")


def cmd_complete(args):
    data = load_data()
    if len(args) < 1:
        print("用法: carwash complete <车牌号>")
        sys.exit(1)

    plate = args[0]

    vehicle = next((c for c in data["queue"] if c["plate"] == plate and c["status"] == "已叫号"), None)
    if not vehicle:
        vehicle = next((c for c in data["queue"] if c["plate"] == plate and c["status"] == "已完成"), None)
        if vehicle:
            if vehicle["id"] in data["complete_ids"]:
                print(f"✗ 重复操作: 车辆 {plate} 已经完成，不会重复收费")
                sys.exit(0)

    if not vehicle:
        print(f"错误: 未找到叫号中的车辆 {plate}")
        sys.exit(1)

    if vehicle["id"] in data["complete_ids"]:
        print(f"✗ 重复操作: 车辆 {plate} 已经完成，不会重复收费")
        sys.exit(0)

    if vehicle["exception"] in ["余额不足", "加项未付费", "爽约后再次出现"]:
        print(f"异常: 车辆 {plate} 存在异常 '{vehicle['exception']}'，请先处理")
        sys.exit(1)

    if vehicle["service_type"] == "普通洗车" and vehicle["amount_charged"] == 0:
        price = PRICES["普通洗车"]
        vehicle["amount_charged"] += price
        add_transaction(data, "收入", price, plate, "普通洗车费")

    add_ons_total = 0
    if vehicle["wax"]:
        add_ons_total += PRICES["打蜡"]
    if vehicle["interior"]:
        add_ons_total += PRICES["内饰清洗"]

    if add_ons_total > 0:
        add_ons_charged = vehicle.get("add_ons_charged", 0)
        if add_ons_charged == 0:
            if vehicle["service_type"] == "会员扣次":
                card = data["cards"][vehicle["card_id"]]
                if card["balance"] >= add_ons_total:
                    card["balance"] -= add_ons_total
                    vehicle["amount_charged"] += add_ons_total
                    vehicle["add_ons_charged"] = add_ons_total
                    add_transaction(data, "消费", add_ons_total, plate, f"加项费用: 打蜡={vehicle['wax']}, 内饰={vehicle['interior']}")
                else:
                    vehicle["exception"] = "余额不足（加项）"
                    print(f"异常: 车辆 {plate} 存在异常 '{vehicle['exception']}'")
                    save_data(data)
                    sys.exit(1)
            else:
                vehicle["amount_charged"] += add_ons_total
                vehicle["add_ons_charged"] = add_ons_total
                add_transaction(data, "收入", add_ons_total, plate, f"加项费用: 打蜡={vehicle['wax']}, 内饰={vehicle['interior']}")

    vehicle["status"] = "已完成"
    vehicle["complete_time"] = datetime.now().isoformat()
    if vehicle["station"]:
        data["stations"][vehicle["station"]] = None
    data["complete_ids"].add(vehicle["id"])

    save_data(data)
    print(f"✓ 完成服务: {plate}")
    print(f"  总收费: {vehicle['amount_charged']} 元")
    print(f"  扣次: {vehicle['washes_deducted']} 次")


def cmd_cancel(args):
    data = load_data()
    if len(args) < 1:
        print("用法: carwash cancel <车牌号> [--no-show]")
        sys.exit(1)

    plate = args[0]
    no_show = "--no-show" in args

    vehicle = next((c for c in data["queue"] if c["plate"] == plate and c["status"] in ["排队中", "已叫号"]), None)
    if not vehicle:
        print(f"错误: 未找到活跃的车辆 {plate}")
        sys.exit(1)

    if no_show:
        vehicle["status"] = "已爽约"
        data["no_shows"].add(plate)
        add_transaction(data, "爽约", 0, plate, "爽约记录")
        print(f"✓ 记录爽约: {plate}")
    else:
        vehicle["status"] = "已取消"
        add_transaction(data, "取消", 0, plate, "主动取消")
        print(f"✓ 取消排队: {plate}")

    if vehicle["station"]:
        data["stations"][vehicle["station"]] = None

    if vehicle["service_type"] == "会员扣次" and vehicle["washes_deducted"] > 0:
        card = data["cards"][vehicle["card_id"]]
        card["remaining_washes"] += vehicle["washes_deducted"]
        add_transaction(data, "返还次数", 0, plate, f"卡号 {vehicle['card_id']} 返还次数")

    save_data(data)


def cmd_balance(args):
    data = load_data()
    if len(args) < 1:
        print("用法: carwash balance <卡号>")
        sys.exit(1)

    card_id = args[0]
    if card_id not in data["cards"]:
        print(f"错误: 卡号 {card_id} 不存在")
        sys.exit(1)

    card = data["cards"][card_id]
    print(f"卡号: {card_id}")
    print(f"车主: {card['owner']}")
    print(f"剩余次数: {card['remaining_washes']}")
    print(f"余额: {card['balance']} 元")


def cmd_status(args):
    data = load_data()
    print("\n" + "=" * 60)
    print("洗车店当前状态")
    print("=" * 60)

    print("\n【工位状态】")
    for station, vehicle_id in data["stations"].items():
        if vehicle_id:
            vehicle = next((c for c in data["queue"] if c["id"] == vehicle_id), None)
            if vehicle:
                print(f"  工位 {station}: {vehicle['plate']} ({vehicle['service_type']})")
            else:
                print(f"  工位 {station}: 占用中 (未知)")
        else:
            print(f"  工位 {station}: 空闲")

    print("\n【排队列表】")
    queue_list = [c for c in data["queue"] if c["status"] in ["排队中", "已叫号"]]
    if queue_list:
        for v in queue_list:
            status_mark = "⚠ " if v["exception"] else "  "
            info = f"#{v['queue_number']} {v['plate']} - {v['service_type']}"
            if v["wax"]:
                info += " +打蜡"
            if v["interior"]:
                info += " +内饰"
            info += f" [{v['status']}]"
            if v["station"]:
                info += f" 工位{v['station']}"
            if v["exception"]:
                info += f" [异常: {v['exception']}]"
            print(f"  {status_mark}{info}")
    else:
        print("  无排队车辆")

    print("\n【异常车辆】")
    exceptions = [c for c in data["queue"] if c["exception"] and c["status"] in ["排队中", "已叫号"]]
    if exceptions:
        for v in exceptions:
            print(f"  {v['plate']}: {v['exception']}")
    else:
        print("  无异常")

    print("\n【预付卡余额】")
    if data["cards"]:
        for card_id, card in data["cards"].items():
            print(f"  {card_id} ({card['owner']}): 次数={card['remaining_washes']}, 余额={card['balance']}")
    else:
        print("  无预付卡")

    today = get_today()
    today_txs = [t for t in data["transactions"] if t["date"] == today]
    today_income = sum(t["amount"] for t in today_txs if t["type"] in ["收入", "消费"])

    print(f"\n【今日统计】")
    print(f"  交易数: {len(today_txs)}")
    print(f"  今日收入: {today_income} 元")
    print("=" * 60 + "\n")


def cmd_export(args):
    data = load_data()
    date = args[0] if args else get_today()

    filename = f"daily_report_{date}.txt"

    today_txs = [t for t in data["transactions"] if t["date"] == date]
    today_vehicles = [c for c in data["queue"] if c.get("complete_time") and c["complete_time"].startswith(date)]
    today_income = sum(t["amount"] for t in today_txs if t["type"] in ["收入", "消费"])

    lines = []
    lines.append(f"洗车店日报 - {date}")
    lines.append("=" * 60)
    lines.append(f"\n生成时间: {datetime.now().isoformat()}")
    lines.append(f"\n【今日收入汇总】")
    lines.append(f"  总收入: {today_income} 元")
    lines.append(f"  交易笔数: {len(today_txs)}")

    lines.append(f"\n【今日完成车辆】")
    if today_vehicles:
        for v in today_vehicles:
            info = f"  {v['plate']}: {v['service_type']}"
            if v["wax"]:
                info += " +打蜡"
            if v["interior"]:
                info += " +内饰"
            info += f" | 收费 {v['amount_charged']} 元 | 扣次 {v['washes_deducted']} 次"
            lines.append(info)
    else:
        lines.append("  无")

    lines.append(f"\n【交易明细】")
    if today_txs:
        for t in today_txs:
            lines.append(f"  [{t['time'].split('T')[1][:8]}] {t['type']:>6} | {t['plate']:>8} | {t['amount']:>6} 元 | {t['details']}")
    else:
        lines.append("  无")

    lines.append(f"\n【预付卡期末余额】")
    if data["cards"]:
        for card_id, card in data["cards"].items():
            lines.append(f"  {card_id} ({card['owner']}): 次数={card['remaining_washes']}, 余额={card['balance']}")
    else:
        lines.append("  无")

    lines.append("\n" + "=" * 60)

    with open(filename, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"✓ 日报已导出: {filename}")
    print(f"\n--- 日报预览 ---")
    print("\n".join(lines))


def cmd_reset(args):
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
        print("✓ 数据已重置")
    else:
        print("数据文件不存在")


def cmd_init_demo(args):
    data = {
        "cards": {
            "C001": {"owner": "张三", "remaining_washes": 10, "balance": 200},
            "C002": {"owner": "李四", "remaining_washes": 0, "balance": 500},
            "C003": {"owner": "王五", "remaining_washes": 2, "balance": 20},
            "C004": {"owner": "赵六", "remaining_washes": 0, "balance": 0},
        },
        "queue": [],
        "stations": {str(i): None for i in range(1, STATIONS_COUNT + 1)},
        "transactions": [],
        "no_shows": set(),
        "call_ids": set(),
        "complete_ids": set(),
    }
    save_data(data)
    print("✓ 演示数据已初始化")
    print("\n初始化的预付卡:")
    for cid, card in data["cards"].items():
        print(f"  {cid}: {card['owner']} | 次数={card['remaining_washes']} | 余额={card['balance']}")


def main():
    if len(sys.argv) < 2:
        print("洗车店排队预付卡 CLI")
        print("=" * 40)
        print("命令:")
        print("  enqueue     车辆入队")
        print("  call        叫号分配工位")
        print("  complete    完成服务")
        print("  cancel      取消/爽约")
        print("  balance     查询卡余额")
        print("  status      查看当前状态")
        print("  export      导出日报")
        print("  init-demo   初始化演示数据")
        print("  reset       重置数据")
        print("\n示例:")
        print("  carwash enqueue 京A12345 普通洗车")
        print("  carwash enqueue 京A67890 会员扣次 --card C001 --wax")
        print("  carwash call 京A12345")
        print("  carwash complete 京A12345")
        sys.exit(0)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd == "enqueue":
        cmd_enqueue(args)
    elif cmd == "call":
        cmd_call(args)
    elif cmd == "complete":
        cmd_complete(args)
    elif cmd == "cancel":
        cmd_cancel(args)
    elif cmd == "balance":
        cmd_balance(args)
    elif cmd == "status":
        cmd_status(args)
    elif cmd == "export":
        cmd_export(args)
    elif cmd == "init-demo":
        cmd_init_demo(args)
    elif cmd == "reset":
        cmd_reset(args)
    else:
        print(f"错误: 未知命令 {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
