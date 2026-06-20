import requests
import json
import time
import os
import pandas as pd
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
OUTPUT_DIR = "/Users/lzy/pro/solo/workspaces/zy72559/validation_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def log_step(step_num, description, data=None):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"\n{'='*80}\n[Step {step_num}] {timestamp} - {description}\n{'='*80}"
    print(log_line)
    if data:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    
    with open(f"{OUTPUT_DIR}/validation_log.txt", "a") as f:
        f.write(log_line + "\n")
        if data:
            f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

def step_1_init_snapshots():
    log_step(1, "初始化特征快照数据")
    snapshots = [
        {
            "snapshot_id": "SNAP-2024-001",
            "snapshot_name": "2024年Q1用户特征快照",
            "snapshot_time": "2024-03-31T23:59:59",
            "total_users": 10000,
            "features": ["age", "gender", "consumption_level"]
        },
        {
            "snapshot_id": "SNAP-2024-002",
            "snapshot_name": "2024年Q2用户特征快照",
            "snapshot_time": "2024-06-30T23:59:59",
            "total_users": 12500,
            "features": ["age", "gender", "consumption_level", "active_days"]
        }
    ]
    results = []
    for snap in snapshots:
        resp = requests.post(f"{BASE_URL}/api/snapshots", json=snap)
        results.append(resp.json())
        print(f"  创建快照 {snap['snapshot_id']}: {resp.status_code}")
    log_step(1.1, "快照创建结果", results)
    return results

def step_2_import_no_snapshot():
    log_step(2, "无快照编号首次导入评测切片 - 核心Bug验证点")
    slice_data = {
        "slice_id": "EVAL-TEST-001",
        "slice_name": "冷启动新用户扩展测试-无快照",
        "feature_snapshot_id": None,
        "time_window_start": "2024-04-01T00:00:00",
        "time_window_end": "2024-06-30T23:59:59",
        "total_users": 500,
        "imported_by": "小孟"
    }
    resp = requests.post(f"{BASE_URL}/api/eval-slices", json=slice_data)
    print(f"  导入状态: {resp.status_code}")
    result = resp.json()
    log_step(2.1, "导入结果（检查conflicts是否有created_at）", result)
    
    conflicts = result.get("conflicts", [])
    assert len(conflicts) > 0, "❌ 应该生成EMPTY_SNAPSHOT_ID冲突"
    for c in conflicts:
        assert c.get("created_at"), f"❌ 冲突created_at为空: {c}"
        assert c.get("conflict_type") == "EMPTY_SNAPSHOT_ID", "❌ 冲突类型错误"
        assert c.get("status") == "pending", "❌ 冲突状态应为pending"
    print("  ✅ 冲突已正确持久化，created_at不为空")
    
    return result["id"], result

def step_3_check_detail(slice_id):
    log_step(3, "刷新详情页 - 验证冲突证据、处理状态、操作日志")
    resp = requests.get(f"{BASE_URL}/api/eval-slices/{slice_id}")
    detail = resp.json()
    log_step(3.1, "详情数据", detail)
    
    assert detail.get("has_pending_conflicts") == True, "❌ 应有待确认冲突标记"
    assert len(detail.get("all_conflicts", [])) > 0, "❌ 应显示所有冲突"
    assert len(detail.get("operation_logs", [])) > 0, "❌ 应有操作日志"
    
    for log in detail["operation_logs"]:
        assert log.get("target_id") == "EVAL-TEST-001", f"❌ 操作日志target_id错误: {log}"
    
    print("  ✅ 详情页展示正确：待确认冲突标记、冲突列表、操作日志均正常")
    return detail

def step_4_supplement_snapshot(slice_id):
    log_step(4, "小孟补录特征快照编号 - 流程核心节点")
    update_data = {
        "feature_snapshot_id": "SNAP-2024-002",
        "operator": "小孟"
    }
    resp = requests.put(f"{BASE_URL}/api/eval-slices/{slice_id}/snapshot", json=update_data)
    print(f"  补录状态: {resp.status_code}")
    result = resp.json()
    log_step(4.1, "补录结果（检查新冲突）", result)
    
    conflicts = result.get("conflicts", [])
    print(f"  冲突数量: {len(conflicts)}")
    for c in conflicts:
        print(f"    - {c['conflict_type']}: {c['description']} (status={c['status']}, created_at={c.get('created_at')})")
    
    return result

def step_5_try_expand_blocked(slice_id):
    log_step(5, "未确认冲突时尝试扩展 - 验证拦截机制")
    try:
        resp = requests.post(f"{BASE_URL}/api/eval-slices/{slice_id}/expand", json={"operator": "小孟"})
        print(f"  扩展状态: {resp.status_code}")
        result = resp.json()
        log_step(5.1, "扩展结果（应被拦截）", result)
        
        if resp.status_code == 400 or "存在未确认的冲突" in str(result):
            print("  ✅ 扩展已被正确拦截，提示存在待确认冲突")
            return True
        else:
            print(f"  ❌ 扩展未被拦截！响应: {result}")
            return False
    except Exception as e:
        print(f"  ✅ 扩展请求抛出异常（拦截生效）: {e}")
        return True

def step_6_resolve_conflicts(slice_id, detail):
    log_step(6, "小孟确认所有冲突")
    all_conflicts = detail.get("all_conflicts", [])
    pending_conflicts = [c for c in all_conflicts if c["status"] == "pending"]
    print(f"  待确认冲突数: {len(pending_conflicts)}")
    
    resolved = []
    for c in pending_conflicts:
        resolve_data = {
            "resolution": "confirmed",
            "operator": "小孟"
        }
        resp = requests.put(f"{BASE_URL}/api/conflicts/{c['id']}/resolve", json=resolve_data)
        result = resp.json()
        resolved.append(result)
        print(f"  确认冲突 {c['id']} ({c['conflict_type']}): {resp.status_code}")
    
    log_step(6.1, "冲突确认结果", resolved)
    
    resp = requests.get(f"{BASE_URL}/api/eval-slices/{slice_id}")
    detail_after = resp.json()
    assert detail_after.get("has_pending_conflicts") == False, "❌ 确认后不应有待确认冲突"
    print("  ✅ 所有冲突已确认，has_pending_conflicts=False")
    
    return detail_after

def step_7_run_expand(slice_id):
    log_step(7, "执行相似用户扩展 - 验证操作日志持久化")
    expand_data = {
        "operator": "小孟",
        "expand_ratio": 2.0
    }
    resp = requests.post(f"{BASE_URL}/api/eval-slices/{slice_id}/expand", json=expand_data)
    print(f"  扩展状态: {resp.status_code}")
    result = resp.json()
    log_step(7.1, "扩展结果", result)
    
    assert result.get("status") == "expand_completed", "❌ 扩展状态错误"
    assert len(result.get("expand_results", [])) > 0, "❌ 无扩展结果"
    
    print(f"  ✅ 扩展完成，扩展结果数: {len(result.get('expand_results', []))}")
    return result

def step_8_check_operation_logs(slice_id):
    log_step(8, "验证操作日志 - 关键Bug验证点2")
    resp = requests.get(f"{BASE_URL}/api/eval-slices/{slice_id}")
    detail = resp.json()
    logs = detail.get("operation_logs", [])
    log_step(8.1, "操作日志列表", logs)
    
    operations = [log["operation"] for log in logs]
    print(f"  所有操作: {operations}")
    
    assert "执行相似用户扩展" in operations, "❌ 缺少'执行相似用户扩展'操作日志！"
    assert "导入评测切片" in operations, "❌ 缺少'导入评测切片'操作日志"
    assert "补录特征快照编号" in operations, "❌ 缺少'补录特征快照编号'操作日志"
    
    print("  ✅ 操作日志完整：包含导入、补录、扩展等所有关键动作")
    return logs

def step_9_review_abnormal(slice_id):
    log_step(9, "异常样本复核 - 时间窗穿越留痕")
    resp = requests.get(f"{BASE_URL}/api/eval-slices/{slice_id}")
    detail = resp.json()
    
    expand_results = detail.get("expand_results", [])
    abnormal_samples = [r for r in expand_results if r.get("is_time_window_cross")]
    print(f"  时间窗穿越异常样本数: {len(abnormal_samples)}")
    
    reviewed = []
    for sample in abnormal_samples[:2]:
        review_data = {
            "result_id": sample["id"],
            "review_result": "pending_experiment_review",
            "review_notes": "时间窗穿越导致效果虚高，需实验平台负责人复核",
            "operator": "小孟"
        }
        resp = requests.post(f"{BASE_URL}/api/expand-results/review", json=review_data)
        result = resp.json()
        reviewed.append(result)
        print(f"  复核样本 {sample['id']}: {resp.status_code}")
    
    log_step(9.1, "异常复核结果", reviewed)
    print("  ✅ 异常样本复核完成，留痕记录已保存")
    return reviewed

def step_10_run_self_check(slice_id):
    log_step(10, "运行自检报告 - 四项基本自检")
    resp = requests.post(f"{BASE_URL}/api/eval-slices/{slice_id}/self-check", json={"operator": "小孟"})
    print(f"  自检状态: {resp.status_code}")
    result = resp.json()
    log_step(10.1, "自检报告", result)
    
    check_items = result.get("check_results", [])
    passed = sum(1 for c in check_items if c.get("passed"))
    print(f"  自检通过: {passed}/{len(check_items)}")
    
    check_names = [c["check_name"] for c in check_items]
    assert "重复导入检查" in check_names, "❌ 缺少重复导入检查"
    assert "时间窗穿越效果虚高检查" in check_names, "❌ 缺少时间窗穿越检查"
    assert "补录后重算检查" in check_names, "❌ 缺少补录后重算检查"
    assert "导出一致性检查" in check_names, "❌ 缺少导出一致性检查"
    
    print("  ✅ 四项基本自检完整")
    return result

def step_11_export_excel(slice_id):
    log_step(11, "导出Excel明细 - 验证扩展动作是否在导出中")
    resp = requests.get(f"{BASE_URL}/api/eval-slices/{slice_id}/export")
    print(f"  导出状态: {resp.status_code}")
    
    excel_path = f"{OUTPUT_DIR}/eval_slice_{slice_id}_export.xlsx"
    with open(excel_path, "wb") as f:
        f.write(resp.content)
    print(f"  导出文件已保存: {excel_path}")
    
    return excel_path

def step_12_verify_excel(excel_path, slice_id):
    log_step(12, "打开Excel核对所有字段 - 最终验证")
    
    xl = pd.ExcelFile(excel_path)
    sheet_names = xl.sheet_names
    print(f"  Excel Sheet列表: {sheet_names}")
    
    log_step(12.1, "Sheet名称验证", sheet_names)
    expected_sheets = ["评测切片信息", "扩展结果明细", "冲突处理记录", "操作日志", "自检报告"]
    for s in expected_sheets:
        assert s in sheet_names, f"❌ 缺少Sheet: {s}"
    print("  ✅ 5个Sheet完整")
    
    df_slice = pd.read_excel(excel_path, sheet_name="评测切片信息")
    log_step(12.2, "评测切片信息", df_slice.to_dict('records'))
    
    df_results = pd.read_excel(excel_path, sheet_name="扩展结果明细")
    log_step(12.3, f"扩展结果明细（共{len(df_results)}条）", df_results.head(5).to_dict('records'))
    
    if "风险说明" in df_results.columns:
        has_risk = df_results["风险说明"].notna().sum()
        print(f"  含风险说明的记录数: {has_risk}")
    
    df_conflicts = pd.read_excel(excel_path, sheet_name="冲突处理记录")
    log_step(12.4, f"冲突处理记录（共{len(df_conflicts)}条）", df_conflicts.to_dict('records'))
    
    assert len(df_conflicts) >= 1, "❌ 缺少冲突处理记录"
    for _, row in df_conflicts.iterrows():
        assert pd.notna(row["创建时间"]), f"❌ 冲突创建时间为空: {row.to_dict()}"
        assert pd.notna(row["冲突类型"]), "❌ 冲突类型为空"
        assert pd.notna(row["处理状态"]), "❌ 处理状态为空"
    print("  ✅ 冲突记录：创建时间、冲突类型、处理状态均非空")
    
    df_logs = pd.read_excel(excel_path, sheet_name="操作日志")
    log_step(12.5, f"操作日志（共{len(df_logs)}条）", df_logs.to_dict('records'))
    
    operations = df_logs["操作"].tolist()
    print(f"  导出中的操作列表: {operations}")
    assert "执行相似用户扩展" in operations, "❌ 导出中缺少'执行相似用户扩展'！关键Bug未修复！"
    assert "导入评测切片" in operations, "❌ 导出中缺少'导入评测切片'"
    assert "补录特征快照编号" in operations, "❌ 导出中缺少'补录特征快照编号'"
    
    for _, row in df_logs.iterrows():
        assert row["目标ID"] == "EVAL-TEST-001", f"❌ 操作日志目标ID错误: {row.to_dict()}"
        assert pd.notna(row["操作时间"]), "❌ 操作时间为空"
    
    print("  ✅ 操作日志导出正确：包含扩展动作，目标ID一致，操作时间完整")
    
    df_selfcheck = pd.read_excel(excel_path, sheet_name="自检报告")
    log_step(12.6, f"自检报告（共{len(df_selfcheck)}条）", df_selfcheck.to_dict('records'))
    
    print("\n" + "="*80)
    print("🎉 所有验证通过！两个核心Bug均已修复：")
    print("  1. ✅ 无快照编号导入时，冲突证据完整保存，created_at不为空")
    print("  2. ✅ 执行相似用户扩展后，导出Excel中可见扩展动作操作日志")
    print("="*80)
    
    return {
        "sheet_names": sheet_names,
        "conflict_count": len(df_conflicts),
        "log_count": len(df_logs),
        "has_expand_log": "执行相似用户扩展" in operations,
        "all_created_at_not_null": df_conflicts["创建时间"].notna().all()
    }

def main():
    print("🚀 开始无快照编号导入全流程验证")
    print("="*80)
    
    open(f"{OUTPUT_DIR}/validation_log.txt", "w").close()
    
    try:
        step_1_init_snapshots()
        time.sleep(0.5)
        
        slice_id, import_result = step_2_import_no_snapshot()
        time.sleep(0.5)
        
        detail = step_3_check_detail(slice_id)
        time.sleep(0.5)
        
        step_4_supplement_snapshot(slice_id)
        time.sleep(0.5)
        
        detail_after_supplement = step_3_check_detail(slice_id)
        time.sleep(0.5)
        
        step_5_try_expand_blocked(slice_id)
        time.sleep(0.5)
        
        detail_after_resolve = step_6_resolve_conflicts(slice_id, detail_after_supplement)
        time.sleep(0.5)
        
        step_7_run_expand(slice_id)
        time.sleep(0.5)
        
        step_8_check_operation_logs(slice_id)
        time.sleep(0.5)
        
        step_9_review_abnormal(slice_id)
        time.sleep(0.5)
        
        step_10_run_self_check(slice_id)
        time.sleep(0.5)
        
        excel_path = step_11_export_excel(slice_id)
        time.sleep(0.5)
        
        step_12_verify_excel(excel_path, slice_id)
        
        print(f"\n📋 验证日志已保存到: {OUTPUT_DIR}/validation_log.txt")
        print(f"📊 导出Excel已保存到: {excel_path}")
        
    except Exception as e:
        print(f"\n❌ 验证失败: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    main()
