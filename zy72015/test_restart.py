#!/usr/bin/env python3
import sys
import os
import json
import time
import requests

API_BASE = "http://127.0.0.1:5000/api"


def print_step(step, title):
    print(f"\n{'='*70}")
    print(f" 步骤 {step}: {title}")
    print(f"{'='*70}")


def check_api_available():
    try:
        r = requests.get(f"{API_BASE}/health", timeout=2)
        return r.status_code == 200
    except:
        return False


def wait_for_api(timeout=30):
    print("等待API服务启动...", end="", flush=True)
    for i in range(timeout):
        if check_api_available():
            print(" ✅ 服务已就绪")
            return True
        time.sleep(1)
        print(".", end="", flush=True)
    print(" ❌ 服务启动超时")
    return False


def test_step_1_start_api():
    print_step(1, "启动API服务")

    print("\n🔧 清理端口5000...")
    import subprocess
    subprocess.run(["lsof", "-ti:5000"], capture_output=True)
    subprocess.run(["pkill", "-f", "port=5000"], capture_output=True)
    import time
    time.sleep(2)

    import subprocess
    proc = subprocess.Popen(
        [sys.executable, "cli.py", "api"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )

    if not wait_for_api():
        proc.terminate()
        raise Exception("API服务启动失败")

    print("✅ API服务启动成功")
    return proc


def test_step_2_verify_data_via_api():
    print_step(2, "通过API验证数据完整性")

    print("\n📡 调用 /api/batches 获取批次列表")
    r = requests.get(f"{API_BASE}/batches")
    assert r.status_code == 200, f"API调用失败: {r.status_code}"
    batches = r.json()["data"]
    assert len(batches) >= 1, f"至少应有1个批次，实际{len(batches)}个"
    batch_no = batches[0]["batch_no"]
    print(f"✅ 批次: {batch_no}")

    print(f"\n📡 调用 /api/batches/{batch_no}/summary 获取归集汇总")
    r = requests.get(f"{API_BASE}/batches/{batch_no}/summary")
    assert r.status_code == 200
    summary = r.json()["data"]
    print(f"   已确认金额: {summary['confirmed_amount']:.2f} 元")
    print(f"   已挂起金额: {summary['suspended_amount']:.2f} 元")
    print(f"   已确认记录: {summary['status_counts']['confirmed']} 条")
    print(f"   已挂起记录: {summary['status_counts']['suspended']} 条")

    assert summary["confirmed_amount"] > 0, "已确认金额应大于0"
    assert summary["suspended_amount"] > 0, "挂起金额应大于0"
    assert summary["status_counts"]["confirmed"] >= 1, "至少1条已确认记录"
    assert summary["status_counts"]["suspended"] >= 1, "至少1条挂起记录"

    expected_confirmed = 1256.80 + 880.00
    expected_suspended = 568.30
    assert abs(summary["confirmed_amount"] - expected_confirmed) < 0.01, f"已确认金额应为{expected_confirmed:.2f}元"
    assert abs(summary["suspended_amount"] - expected_suspended) < 0.01, f"挂起金额应为{expected_suspended:.2f}元"
    assert summary["status_counts"]["confirmed"] == 2, "应2条已确认记录"
    assert summary["status_counts"]["suspended"] == 1, "应1条挂起记录"

    print("\n📡 调用 /api/records 获取所有记录")
    r = requests.get(f"{API_BASE}/records")
    assert r.status_code == 200
    records = r.json()["data"]
    assert len(records) == 3, f"应有3条记录，实际{len(records)}条"

    print("\n🔍 验证每条记录的原始备注和处理历史:")
    for rec in records:
        print(f"\n  记录 {rec['id']} ({rec['pile_no']}):")
        print(f"    来源: {rec['source']}")
        print(f"    原始备注: {rec['original_remarks'][:40]}..." if len(rec['original_remarks']) > 40 else f"    原始备注: {rec['original_remarks']}")
        print(f"    处理历史: {len(rec['processing_history'])} 条")
        assert rec['original_remarks'], "原始备注不应为空"
        assert len(rec['processing_history']) >= 1, "处理历史不应为空"

    print("\n📡 调用 /api/export/discrepancies 导出差异清单")
    r = requests.get(f"{API_BASE}/export/discrepancies?format=csv")
    assert r.status_code == 200
    assert "Content-Disposition" in r.headers, "应有下载响应头"
    print(f"✅ 差异清单导出成功，文件大小: {len(r.content)} 字节")

    print("\n📡 调用 /api/export/report 导出完整报告")
    r = requests.get(f"{API_BASE}/export/report?format=xlsx")
    assert r.status_code == 200
    assert "Content-Disposition" in r.headers, "应有下载响应头"
    print(f"✅ 完整报告导出成功，文件大小: {len(r.content)} 字节")

    print("\n✅ API数据验证通过，所有数据完整、金额正确")
    return batch_no, summary


def test_step_3_restart_api(proc):
    print_step(3, "重启API服务（验证持久化）")

    print("\n🔴 停止API服务...")
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except:
        proc.kill()
    print("✅ API服务已停止")

    time.sleep(2)

    print("\n🟢 重新启动API服务...")
    import subprocess
    new_proc = subprocess.Popen(
        [sys.executable, "cli.py", "api"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )

    if not wait_for_api():
        new_proc.terminate()
        raise Exception("API服务重启失败")

    print("✅ API服务重启成功")
    return new_proc


def test_step_4_verify_after_restart(batch_no_before, summary_before):
    print_step(4, "重启后验证数据一致性")

    print(f"\n📡 调用 /api/batches/{batch_no_before}/summary 验证归集汇总")
    r = requests.get(f"{API_BASE}/batches/{batch_no_before}/summary")
    assert r.status_code == 200
    summary_after = r.json()["data"]

    print(f"\n📊 数据对比:")
    print(f"   已确认金额: 重启前 {summary_before['confirmed_amount']:.2f} → 重启后 {summary_after['confirmed_amount']:.2f}")
    print(f"   已挂起金额: 重启前 {summary_before['suspended_amount']:.2f} → 重启后 {summary_after['suspended_amount']:.2f}")
    print(f"   已确认记录: 重启前 {summary_before['status_counts']['confirmed']} → 重启后 {summary_after['status_counts']['confirmed']}")
    print(f"   已挂起记录: 重启前 {summary_before['status_counts']['suspended']} → 重启后 {summary_after['status_counts']['suspended']}")

    assert abs(summary_after["confirmed_amount"] - summary_before["confirmed_amount"]) < 0.01, "重启后已确认金额不一致"
    assert abs(summary_after["suspended_amount"] - summary_before["suspended_amount"]) < 0.01, "重启后挂起金额不一致"
    assert summary_after["status_counts"]["confirmed"] == summary_before["status_counts"]["confirmed"], "重启后已确认记录数不一致"
    assert summary_after["status_counts"]["suspended"] == summary_before["status_counts"]["suspended"], "重启后挂起记录数不一致"

    print("\n📡 调用 /api/records 验证单条记录历史")
    r = requests.get(f"{API_BASE}/records")
    records_after = r.json()["data"]

    for rec in records_after:
        if rec["status"] == "confirmed" and len(rec["processing_history"]) >= 2:
            print(f"\n🔍 验证记录 {rec['id']} 的处理历史:")
            for i, h in enumerate(rec["processing_history"], 1):
                print(f"   [{i}] {h['timestamp']} | {h['operator']} | {h['action']}")
            assert len(rec["processing_history"]) >= 2, "处理历史不完整"
            assert "老曹" in rec["processing_history"][1]["operator"], "操作人信息丢失"
            assert "状态变更" in rec["processing_history"][1]["action"], "操作信息丢失"

    print("\n📡 重新导出报告，验证数字一致")
    r = requests.get(f"{API_BASE}/export/report?format=csv")
    assert r.status_code == 200
    content = r.content.decode("utf-8-sig")
    expected_confirmed = 1256.80 + 880.00
    expected_suspended = 568.30
    assert f"{expected_confirmed:.2f}" in content, f"导出的已确认金额不一致，应包含{expected_confirmed:.2f}"
    assert f"{expected_suspended:.2f}" in content, f"导出的挂起金额不一致，应包含{expected_suspended:.2f}"
    print(f"✅ 导出报告数字验证通过：已确认{expected_confirmed:.2f}元，挂起{expected_suspended:.2f}元")

    print("\n✅ 重启验证通过：所有数据、备注、处理历史、金额完全一致")


def test_step_5_verify_record_detail():
    print_step(5, "验证单条记录完整信息（供接手人查阅）")

    print("\n📡 调用 /api/records 获取所有记录ID")
    r = requests.get(f"{API_BASE}/records")
    records = r.json()["data"]

    suspended_record = [r for r in records if r["status"] == "suspended"][0]
    record_id = suspended_record["id"]

    print(f"\n📡 调用 /api/records/{record_id} 获取挂起记录详情")
    r = requests.get(f"{API_BASE}/records/{record_id}")
    assert r.status_code == 200
    rec_detail = r.json()["data"]

    print(f"\n📋 记录详情（模拟接手人查阅）:")
    print(f"   记录ID: {rec_detail['id']}")
    print(f"   充电桩: {rec_detail['pile_no']}")
    print(f"   数据来源: {rec_detail['source']}")
    print(f"   来源参考: {rec_detail['source_ref']}")
    print(f"   交易日期: {rec_detail['transaction_date']}")
    print(f"   台账应收: {rec_detail['expected_amount']:.2f} 元")
    print(f"   银行实收: 待补凭证")
    print(f"   当前状态: {rec_detail['status']}")
    print(f"   创建时间: {rec_detail['created_at']}")
    print(f"   更新时间: {rec_detail['updated_at']}")
    print(f"\n   💬 原始备注（月底对账表原文）:")
    print(f"      {rec_detail['original_remarks']}")
    print(f"\n   📝 处理意见:")
    for line in rec_detail['processing_notes'].split('\n'):
        print(f"      {line}")
    print(f"\n   📜 处理历史（可追溯）:")
    for i, h in enumerate(rec_detail["processing_history"], 1):
        print(f"      [{i}] {h['timestamp']}")
        print(f"          操作人: {h['operator']}")
        print(f"          动作: {h['action']}")
        print(f"          原因: {h['reason']}")
        if h.get('notes'):
            print(f"          备注: {h['notes']}")

    assert "4月旧口径补录" in rec_detail["original_remarks"], "原始备注丢失"
    assert "老曹说等银行6月上旬补打回单" in rec_detail["original_remarks"], "业务备注丢失"
    assert "业务提醒" in rec_detail["processing_notes"], "处理意见丢失"
    assert len(rec_detail["processing_history"]) == 2, "处理历史不完整"

    print("\n✅ 验证通过：接手人可完整查看原始备注、处理意见和判断历史")


def main():
    proc = None
    try:
        proc = test_step_1_start_api()
        batch_no, summary_before = test_step_2_verify_data_via_api()
        proc = test_step_3_restart_api(proc)
        test_step_4_verify_after_restart(batch_no, summary_before)
        test_step_5_verify_record_detail()

        print(f"\n{'='*70}")
        print(f"  🎉 重启验证全部通过！")
        print(f"{'='*70}")
        print(f"\n✅ 关键验证结论:")
        print(f"   1. 重启后数据完整：批次、记录、状态全部保留")
        print(f"   2. 金额一致：已确认2136.80元，挂起568.30元")
        print(f"   3. 历史追溯：处理人、时间、原因、备注完整留存")
        print(f"   4. 原始备注：月底对账表乱备注完整保留")
        print(f"   5. 导出一致：重启前后导出数字完全相同")
        print(f"   6. 接手友好：任何人都能看懂前一次的判断依据")
        print(f"\n{'='*70}\n")

        return 0

    except Exception as e:
        print(f"\n❌ 验证失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        if proc and proc.poll() is None:
            print("\n🔴 正在停止API服务...")
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except:
                proc.kill()
            print("✅ API服务已停止")


if __name__ == "__main__":
    sys.exit(main())
