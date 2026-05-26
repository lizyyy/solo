#!/usr/bin/env python3
import requests
import os

BASE_URL = "http://localhost:8000"
SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "sample_data")


def print_separator(title=""):
    print("\n" + "=" * 60)
    if title:
        print(f"  {title}")
        print("=" * 60)


def quick_start_demo():
    print_separator("园林养护药剂喷洒作业系统 - 快速演示")

    print("\n[1] 导入药剂库存...")
    with open(os.path.join(SAMPLE_DIR, "chemicals.json"), "rb") as f:
        resp = requests.post(f"{BASE_URL}/api/chemicals/import", files={"file": f})
    print(f"    ✅ {resp.json()['message']}")

    print("\n[2] 导入天气记录...")
    with open(os.path.join(SAMPLE_DIR, "weather.json"), "rb") as f:
        resp = requests.post(f"{BASE_URL}/api/weather/import", files={"file": f})
    print(f"    ✅ {resp.json()['message']}")

    print("\n[3] 第一次提交作业记录...")
    with open(os.path.join(SAMPLE_DIR, "spray_records.csv"), "rb") as f:
        resp = requests.post(f"{BASE_URL}/api/spray/upload", files={"file": f})
    result = resp.json()
    batch_no = result["batch_no"]
    print(f"    ✅ 批次号: {batch_no}")
    print(f"    📊 统计: {result['summary']}")

    print("\n[4] 查看处理报告...")
    resp = requests.get(f"{BASE_URL}/api/report/{batch_no}/text")
    print_separator("处理报告")
    print(resp.text)

    print("\n[5] 再次提交相同记录（测试去重）...")
    with open(os.path.join(SAMPLE_DIR, "spray_records.csv"), "rb") as f:
        resp = requests.post(f"{BASE_URL}/api/spray/upload", files={"file": f})
    result2 = resp.json()
    print(f"    ✅ 批次号: {result2['batch_no']}")
    print(f"    📊 统计: {result2['summary']}")
    print(f"    ℹ️  重复记录数: {result2['summary']['duplicate']}")

    print("\n[6] 查看批次列表...")
    resp = requests.get(f"{BASE_URL}/api/batches")
    batches = resp.json()
    for b in batches:
        print(f"    📦 {b['batch_no']} - 总数:{b['total_records']} 正常:{b['normal_count']} 待确认:{b['confirm_count']} 失败:{b['failed_count']}")

    print("\n[7] 追踪单条记录详情...")
    print("    请访问以下链接查看记录详情:")
    print(f"    {BASE_URL}/api/records/1")

    print_separator("演示完成")
    print(f"\n📖 在线API文档: {BASE_URL}/docs")
    print(f"📖 查看报告: {BASE_URL}/api/report/{batch_no}/text")
    print("\n💡 提示: 可以再次运行此脚本验证去重功能！")


if __name__ == "__main__":
    try:
        quick_start_demo()
    except requests.exceptions.ConnectionError:
        print("\n❌ 无法连接到服务器，请先启动服务:")
        print("   uvicorn main:app --reload")
        print("   或 python main.py")
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
