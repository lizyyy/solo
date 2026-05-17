#!/usr/bin/env python3
import requests
import csv
import io

BASE_URL = "http://localhost:8000"


def check_server():
    try:
        response = requests.get(f"{BASE_URL}/", timeout=5)
        if response.status_code == 200:
            print("✅ 服务已启动")
            return True
    except:
        pass
    print("❌ 服务未启动，请先运行: uvicorn main:app --reload")
    return False


def create_race_config():
    print("📝 创建赛事配置...")
    data = {
        "race_name": "2024北京马拉松",
        "total_runners": 30000,
        "expected_dropout_rate": 0.05,
        "backup_ratio_water": 0.2,
        "backup_ratio_salt": 0.3,
        "backup_ratio_gel": 0.25
    }
    response = requests.post(f"{BASE_URL}/api/race-configs/", json=data)
    if response.status_code == 200:
        print(f"✅ 赛事配置创建成功 (ID: {response.json()['id']})")
        return response.json()["id"]
    else:
        print(f"⚠️ 配置可能已存在")
        return 1


def import_stations():
    print("📥 导入站点数据...")
    with open("data/stations.csv", "rb") as f:
        files = {"file": ("stations.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/api/import/stations/", files=files)
        result = response.json()
        if result.get("success"):
            print(f"✅ 成功导入 {result.get('records_imported', 0)} 个站点")
        else:
            print(f"⚠️ 导入结果: {result.get('message')}")


def import_supply_allocations():
    print("📥 导入物资分配数据...")
    with open("data/supply_allocations.csv", "rb") as f:
        files = {"file": ("supply_allocations.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/api/import/supply-allocations/", files=files)
        result = response.json()
        if result.get("success"):
            print(f"✅ 成功导入 {result.get('records_imported', 0)} 条物资分配记录")
        else:
            print(f"⚠️ 导入结果: {result.get('message')}")


def calculate_requirements(config_id):
    print("🔢 计算补给需求和缺口...")
    response = requests.post(f"{BASE_URL}/api/calculate/{config_id}")
    result = response.json()
    if result.get("success"):
        print(f"✅ 计算完成，共发现 {result.get('total_gaps', 0)} 个缺口")
        for gap in result.get("gap_details", []):
            print(f"  - {gap['station']} {gap['category']}: {gap['gap']} ({gap['level']})")
    else:
        print(f"⚠️ 计算结果: {result.get('message')}")


def show_transfer_suggestions():
    print("💡 获取调拨建议...")
    response = requests.get(f"{BASE_URL}/api/transfer-suggestions/")
    suggestions = response.json()
    print(f"✅ 共 {len(suggestions)} 条调拨建议")
    for s in suggestions[:5]:
        print(f"  - {s['from_station']} → {s['to_station']}: {s['category']} {s['suggested_quantity']} (优先级{s['priority']})")


def export_reports(config_id):
    print("📤 导出报告...")
    response = requests.get(f"{BASE_URL}/api/export/markdown/{config_id}")
    with open("report.md", "w", encoding="utf-8") as f:
        f.write(response.text)
    print("✅ Markdown报告已导出: report.md")
    
    response = requests.get(f"{BASE_URL}/api/export/json/{config_id}")
    with open("report.json", "w", encoding="utf-8") as f:
        import json
        json.dump(response.json(), f, ensure_ascii=False, indent=2)
    print("✅ JSON报告已导出: report.json")


def main():
    print("=" * 60)
    print("🏃 马拉松补给系统 - 一键造数脚本")
    print("=" * 60)
    
    if not check_server():
        return
    
    config_id = create_race_config()
    import_stations()
    import_supply_allocations()
    calculate_requirements(config_id)
    show_transfer_suggestions()
    export_reports(config_id)
    
    print("=" * 60)
    print("✅ 造数完成！")
    print(f"📖 访问 API 文档: {BASE_URL}/docs")
    print(f"📊 查看缺口: {BASE_URL}/api/gap-records/?status=open")
    print("=" * 60)


if __name__ == "__main__":
    main()
