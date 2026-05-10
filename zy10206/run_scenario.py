#!/usr/bin/env python3
import subprocess
import os
import shutil
import json
import sys

def run(cmd):
    print(f"\n>>> {cmd}")
    result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    print(result.stdout)
    if result.stderr:
        print(f"[STDERR]: {result.stderr}")
    return result

def main():
    # 清理环境
    if os.path.exists("data"): shutil.rmtree("data")
    if os.path.exists("exports"): shutil.rmtree("exports")

    print("="*50)
    print("=== 1. 初始化数据 ===")
    print("="*50)
    
    run("python3 -m piano_checkin member add --name \"Alice (按课时)\" --phone 13800138000 --balance 10.0")
    run("python3 -m piano_checkin member add --name \"Bob (包月)\" --phone 13900139000 --balance 0.0")
    
    # 读取 ID
    with open("data/members.json") as f:
        members = json.load(f)
    alice_id = next(m['member_id'] for m in members if "Alice" in m['name'])
    bob_id = next(m['member_id'] for m in members if "Bob" in m['name'])

    print(f"Alice ID: {alice_id}")
    print(f"Bob ID: {bob_id}")

    # 给 Bob 开包月
    run(f"python3 -m piano_checkin package add --member-id {bob_id} --type monthly --start 2026-05-01 --end 2026-05-31")

    print("\n" + "="*50)
    print("=== 2. 正常核销 (Alice 2小时) ===")
    print("="*50)
    run(f"python3 -m piano_checkin checkin --member-id {alice_id} --date 2026-05-10 --start 14:00 --end 16:00 --yes")

    print("\n" + "="*50)
    print("=== 3. 测试重复提交 (同一时间点) ===")
    print("="*50)
    print("> 预期：报错 '操作重复'")
    run(f"python3 -m piano_checkin checkin --member-id {alice_id} --date 2026-05-10 --start 14:00 --end 16:00 --yes")

    print("\n" + "="*50)
    print("=== 4. 测试余额不足强制核销 (Alice 超支10h) ===")
    print("="*50)
    print("> 预期：强制通过，进入人工审核列表")
    run(f"python3 -m piano_checkin checkin --member-id {alice_id} --date 2026-05-11 --start 09:00 --end 19:00 --force --notes \"老板特批，先练后补\" --yes")

    print("\n" + "="*50)
    print("=== 5. 测试补录 (Ref ID 去重) ===")
    print("="*50)
    print("> 注意：由于之前余额已超支，补录需加 --force")
    print("> 第一次补录 (Booking #A101)...")
    run(f"python3 -m piano_checkin checkin --member-id {alice_id} --type manual_entry --date 2026-05-01 --start 10:00 --end 11:00 --ref-id BK_A101 --force --notes \"前台忘记录入\" --yes")
    
    print("> 第二次补录 (重复同一个 Booking ID)...")
    print("> 预期：报错 '操作重复' (优先于余额检查)")
    run(f"python3 -m piano_checkin checkin --member-id {alice_id} --type manual_entry --date 2026-05-01 --start 10:00 --end 11:00 --ref-id BK_A101 --force --notes \"我再录一遍\" --yes")

    print("\n" + "="*50)
    print("=== 6. 包月用户核销 (Bob) ===")
    print("="*50)
    print("> 预期：余额不变，显示包月核销")
    run(f"python3 -m piano_checkin checkin --member-id {bob_id} --date 2026-05-15 --start 18:00 --end 20:00 --yes")

    print("\n" + "="*50)
    print("=== 7. 预约取消扣课时 (No-show Penalty) ===")
    print("="*50)
    run(f"python3 -m piano_checkin checkin --member-id {alice_id} --type penalty --date 2026-05-20 --start 15:00 --end 16:00 --notes \"预约未到\" --yes")

    print("\n" + "="*50)
    print("=== 8. 查看结果 ===")
    print("="*50)
    
    print("\n--- 会员最终余额 ---")
    run("python3 -m piano_checkin member list")
    
    print("\n--- 交易历史 ---")
    run("python3 -m piano_checkin history")
    
    print("\n--- 人工审核清单 ---")
    run("python3 -m piano_checkin review")
    
    print("\n--- 导出数据 ---")
    run("python3 -m piano_checkin export")

if __name__ == "__main__":
    main()
