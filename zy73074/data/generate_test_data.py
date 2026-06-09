import csv
import json
import random
from datetime import datetime, timedelta

random.seed(42)

CABINET_IDS = ["PDU-A01", "PDU-A02", "PDU-B01", "PDU-B02", "PDU-C01"]

def gen_repair_photos_batch1():
    """第一批维修照片 - 字段名版本1"""
    rows = []
    base_time = datetime(2026, 6, 1, 8, 0)
    for i in range(20):
        cab = random.choice(CABINET_IDS)
        t = base_time + timedelta(hours=random.randint(0, 72))
        rows.append({
            "照片编号": f"PHT-2026-{1000+i:04d}",
            "设备编号": cab,
            "拍摄时间": t.strftime("%Y-%m-%d %H:%M:%S"),
            "异常部位": random.choice(["母线排", "进线端子", "电容柜", "出线开关", "散热风扇"]),
            "温度读数": f"{random.randint(45, 95)}℃",
            "拍摄人": random.choice(["张三", "李四", "王五"]),
            "处理意见": random.choice(["待备件", "已紧固", "观察运行", "需更换", "已清灰"]),
            "数据来源": "班组巡检App-v1"
        })
    return rows

def gen_repair_photos_batch2():
    """第二批维修照片 - 字段名不一致（算法值班人交来的版本）"""
    rows = []
    base_time = datetime(2026, 6, 3, 9, 0)
    for i in range(15):
        cab = random.choice(CABINET_IDS)
        t = base_time + timedelta(hours=random.randint(0, 96))
        rows.append({
            "photo_id": f"PHT-2026-{2000+i:04d}",
            "cabinet_code": cab,
            "shoot_ts": t.strftime("%Y-%m-%d %H:%M:%S"),
            "part_name": random.choice(["母线排", "进线端子", "电容柜", "出线开关", "散热风扇"]),
            "temp_value": f"{random.randint(48, 92)}℃",
            "operator": random.choice(["赵六", "钱七", "孙八"]),
            "suggestion": random.choice(["待备件", "已紧固", "观察运行", "需更换", "已清灰"]),
            "source": "算法巡检系统-v2"
        })
    return rows

def gen_spare_parts():
    """备件到货表 - 故意造一条晚到的（晚于停机窗口）"""
    rows = [
        {
            "备件编号": "SP-FAN-001",
            "备件名称": "轴流散热风扇",
            "对应设备": "PDU-A01",
            "需求日期": "2026-06-02",
            "计划停机窗口": "2026-06-03 00:00-06:00",
            "实际到货时间": "2026-06-03 14:25:00",
            "状态": "已到货",
            "供应商": "电气配件甲",
            "晚到原因": "物流中转延误"
        },
        {
            "备件编号": "SP-TERM-002",
            "备件名称": "镀锡进线端子",
            "对应设备": "PDU-B02",
            "需求日期": "2026-06-04",
            "计划停机窗口": "2026-06-05 00:00-06:00",
            "实际到货时间": "2026-06-04 16:10:00",
            "状态": "已到货",
            "供应商": "铜排加工厂",
            "晚到原因": ""
        },
        {
            "备件编号": "SP-CAP-003",
            "备件名称": "补偿电容组",
            "对应设备": "PDU-C01",
            "需求日期": "2026-06-05",
            "计划停机窗口": "2026-06-06 00:00-06:00",
            "实际到货时间": "2026-06-07 09:30:00",
            "状态": "已到货",
            "供应商": "电容供应商乙",
            "晚到原因": "厂家产能紧张"
        },
        {
            "备件编号": "SP-SW-004",
            "备件名称": "出线断路器",
            "对应设备": "PDU-A02",
            "需求日期": "2026-06-06",
            "计划停机窗口": "2026-06-07 00:00-06:00",
            "实际到货时间": "2026-06-06 11:00:00",
            "状态": "已到货",
            "供应商": "开关厂丙",
            "晚到原因": ""
        }
    ]
    return rows

def gen_temp_sampling():
    """温度采样CSV - 故意插入采样断档（6月3日凌晨那段）"""
    rows = []
    start = datetime(2026, 6, 1, 0, 0, 0)
    for cab in CABINET_IDS:
        t = start
        while t < datetime(2026, 6, 8, 0, 0, 0):
            if cab == "PDU-A01" and t >= datetime(2026, 6, 3, 0, 0, 0) and t < datetime(2026, 6, 3, 6, 0, 0):
                t += timedelta(minutes=5)
                continue
            if cab == "PDU-C01" and t >= datetime(2026, 6, 5, 22, 0, 0) and t < datetime(2026, 6, 6, 2, 0, 0):
                t += timedelta(minutes=5)
                continue
            
            hour = t.hour
            base_temp = 35
            if 9 <= hour <= 18:
                base_temp = 55 + random.uniform(-5, 15)
            elif 19 <= hour <= 23 or 0 <= hour <= 6:
                base_temp = 42 + random.uniform(-3, 8)
            
            if cab == "PDU-A01" and t >= datetime(2026, 6, 3, 6, 0, 0) and t < datetime(2026, 6, 4, 6, 0, 0):
                base_temp += 18
            
            if cab == "PDU-C01" and t >= datetime(2026, 6, 6, 2, 0, 0) and t < datetime(2026, 6, 7, 12, 0, 0):
                base_temp += 22
            
            rows.append({
                "timestamp": t.strftime("%Y-%m-%d %H:%M:%S"),
                "cabinet_id": cab,
                "temperature_c": round(base_temp + random.uniform(-2, 2), 1),
                "sampling_point": f"{cab}-SP{random.randint(1,5)}"
            })
            t += timedelta(minutes=5)
    return rows

def gen_manual_notes():
    """人工备注表 - 用来验证不被覆盖"""
    rows = [
        {
            "关联照片编号": "PHT-2026-1003",
            "备注内容": "用户侧确认：6月2日夜间曾发生短时过负荷，当时尖峰电流约1120A",
            "备注人": "阿敏",
            "备注时间": "2026-06-04 10:15:00"
        },
        {
            "关联照片编号": "PHT-2026-1008",
            "备注内容": "此照片拍摄于备件更换前，旧风扇已连续运行3年未维护",
            "备注人": "阿敏",
            "备注时间": "2026-06-04 11:20:00"
        }
    ]
    return rows

def write_csv(filename, fieldnames, data):
    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)

if __name__ == "__main__":
    batch1 = gen_repair_photos_batch1()
    write_csv("data/repair_photos_batch1.csv", batch1[0].keys(), batch1)
    print(f"生成维修照片批次1: {len(batch1)} 行")

    batch2 = gen_repair_photos_batch2()
    write_csv("data/repair_photos_batch2.csv", batch2[0].keys(), batch2)
    print(f"生成维修照片批次2(字段名不一致): {len(batch2)} 行")

    parts = gen_spare_parts()
    write_csv("data/spare_parts.csv", parts[0].keys(), parts)
    print(f"生成备件到货表: {len(parts)} 行")

    samples = gen_temp_sampling()
    write_csv("data/temperature_sampling.csv", samples[0].keys(), samples)
    print(f"生成温度采样: {len(samples)} 行")

    notes = gen_manual_notes()
    write_csv("data/manual_notes.csv", notes[0].keys(), notes)
    print(f"生成人工备注: {len(notes)} 行")

    print("全部测试数据生成完毕 ✓")
