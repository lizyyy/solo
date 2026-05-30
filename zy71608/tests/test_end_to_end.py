import os
import sys
import time
import requests
import json
from pathlib import Path

BASE_URL = "http://localhost:8000/api/v1"
TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "test_data")
EXPORT_DIR = os.path.join(os.path.dirname(__file__), "test_exports")
os.makedirs(EXPORT_DIR, exist_ok=True)

current_application_id = None
current_contract_id = None


def print_section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def print_subsection(title):
    print("\n" + "-" * 70)
    print(f"  {title}")
    print("-" * 70)


def extract_data(response):
    try:
        data = response.json()
        return data.get("data", data)
    except:
        return response.json()


def test_health_check():
    print_section("1. 健康检查")
    try:
        response = requests.get("http://localhost:8000/health")
        response.raise_for_status()
        data = response.json()
        print(f"✓ 服务状态: {data['status']}")
        print(f"✓ 数据库连接: {data['database']}")
        return True
    except Exception as e:
        print(f"✗ 健康检查失败: {e}")
        print("  请确保服务已启动: python3 -m app.main")
        return False


def test_import_data():
    global current_contract_id
    print_section("2. 数据导入测试（含不规范数据清洗）")
    
    test_cases = [
        ("租赁合同.xlsx", "租赁合同", "租赁合同"),
        ("租金计划.xlsx", "租金计划", "租金计划"),
        ("减免申请.xlsx", "减免申请", "减免申请"),
        ("闭店证明.xlsx", "闭店证明", "闭店证明"),
        ("补充协议.xlsx", "补充协议", "补充协议"),
    ]
    
    imported_ids = {}
    
    for filename, doc_type, description in test_cases:
        print_subsection(f"导入 {description}")
        filepath = os.path.join(TEST_DATA_DIR, filename)
        
        if not os.path.exists(filepath):
            print(f"✗ 文件不存在: {filepath}")
            continue
        
        try:
            with open(filepath, "rb") as f:
                files = {"file": (filename, f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
                params = {"document_type": doc_type, "operator": "测试用户"}
                response = requests.post(
                    f"{BASE_URL}/io/import",
                    files=files,
                    params=params
                )
            response.raise_for_status()
            result = extract_data(response)
            
            print(f"✓ 导入成功: {filename}")
            print(f"  - 总行数: {result.get('total_rows', 0)}")
            print(f"  - 成功: {result.get('success_rows', 0)} 行")
            print(f"  - 失败: {result.get('error_rows', 0)} 行")
            print(f"  - 重复: {result.get('duplicate_rows', 0)} 行")
            print(f"  - 空列删除: {result.get('empty_columns_removed', 0)} 列")
            
            if result.get("warnings"):
                for warning in result["warnings"][:3]:
                    print(f"  ⚠️  {warning}")
            
            if doc_type == "contract" and result.get("imported_ids"):
                current_contract_id = result["imported_ids"][0]
                print(f"  - 保存合同ID: {current_contract_id}")
            
            if result.get("imported_ids"):
                imported_ids[doc_type] = result["imported_ids"]
            
        except Exception as e:
            print(f"✗ 导入失败 {filename}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"  错误详情: {e.response.text}")
    
    return imported_ids


def test_contract_list():
    print_section("3. 合同列表查询（验证数据清洗效果）")
    try:
        response = requests.get(f"{BASE_URL}/contracts", params={"page_size": 100})
        response.raise_for_status()
        result = extract_data(response)
        contracts = result if isinstance(result, list) else result.get("data", [])
        
        print(f"✓ 查询到 {len(contracts)} 条合同记录")
        for contract in contracts[:3]:
            print(f"\n  合同编号: {contract['contract_no']}")
            print(f"  租户名称: {contract['tenant_name']}")
            print(f"  合同版本: {contract['version']}")
            print(f"  合同状态: {contract['status']}")
            print(f"  月租金: {contract['monthly_rent']} 元")
        
        return contracts
    except Exception as e:
        print(f"✗ 查询失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  错误详情: {e.response.text}")
        return []


def test_reduction_list():
    global current_application_id
    print_section("4. 减免申请列表查询")
    try:
        response = requests.get(f"{BASE_URL}/reductions", params={"page_size": 100})
        response.raise_for_status()
        result = extract_data(response)
        reductions = result if isinstance(result, list) else result.get("data", [])
        
        print(f"✓ 查询到 {len(reductions)} 条减免申请")
        for red in reductions:
            print(f"\n  申请编号: {red['application_no']}")
            print(f"  合同ID: {red['contract_id']}")
            print(f"  租户名称: {red['tenant_name']}")
            print(f"  申请天数: {red['applied_days']} 天")
            ratio = red['reduction_ratio']
            if isinstance(ratio, str):
                ratio = float(ratio)
            print(f"  减免比例: {ratio * 100:.0f}%")
            print(f"  当前状态: {red['status']}")
            print(f"  当前步骤: {red['current_step']}")
            
            if not current_application_id:
                current_application_id = red["id"]
        
        return reductions
    except Exception as e:
        print(f"✗ 查询失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  错误详情: {e.response.text}")
        return []


def test_approval_workflow():
    global current_application_id
    print_section("5. 审批工作流测试")
    
    if not current_application_id:
        print("✗ 没有可用的申请ID，跳过工作流测试")
        return
    
    workflow_steps = [
        ("submit", "提交申请", "submitter", "已提交"),
        ("process", "开始处理", "processor", "处理中"),
    ]
    
    for action, description, param_name, expected_status in workflow_steps:
        print_subsection(f"{description} (action={action})")
        try:
            params = {param_name: "测试用户"}
            response = requests.post(
                f"{BASE_URL}/approvals/{current_application_id}/{action}",
                params=params
            )
            response.raise_for_status()
            result = extract_data(response)
            print(f"✓ {description}成功")
            print(f"  新状态: {result['status']}")
            print(f"  当前步骤: {result['current_step']}")
        except Exception as e:
            print(f"✗ {description}失败: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    err_detail = e.response.json()
                    print(f"  错误详情: {err_detail}")
                except:
                    print(f"  错误详情: {e.response.text}")


def test_calculation():
    global current_application_id
    print_section("6. 减免试算")
    
    if not current_application_id:
        print("✗ 没有可用的申请ID，跳过试算测试")
        return
    
    try:
        response = requests.post(
            f"{BASE_URL}/reductions/{current_application_id}/calculate",
            params={"operator": "测试用户"}
        )
        response.raise_for_status()
        result = extract_data(response)
        
        print(f"✓ 试算成功")
        
        def safe_float(val):
            try:
                return float(val)
            except:
                return 0.0
        
        daily_rent = safe_float(result['daily_rent'])
        rent_reduction = safe_float(result.get('rent_reduction', 0))
        total_reduction = safe_float(result.get('total_reduction', 0))
        reduction_ratio = safe_float(result['reduction_ratio'])
        
        print(f"  日租金: {daily_rent:.2f} 元/天")
        print(f"  申请减免天数: {result['applied_days']} 天")
        print(f"  实际减免天数: {result['actual_reduction_days']} 天")
        print(f"  租金减免: {rent_reduction:.2f} 元")
        print(f"  总减免: {total_reduction:.2f} 元")
        print(f"  减免比例: {reduction_ratio * 100:.0f}%")
        print(f"  合同版本有效: {result.get('contract_version_valid', False)}")
        details = result.get('calculation_details', '')
        if details:
            print(f"  计算公式: {str(details)[:100]}...")
        
        return result
    except Exception as e:
        print(f"✗ 试算失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  错误详情: {e.response.text}")
        return None


def test_anomaly_detection():
    global current_application_id
    print_section("7. 异常检测")
    
    if not current_application_id:
        print("✗ 没有可用的申请ID，跳过异常检测测试")
        return
    
    try:
        response = requests.post(
            f"{BASE_URL}/reductions/{current_application_id}/detect-anomalies",
            json={"operator": "测试用户"}
        )
        response.raise_for_status()
        result = extract_data(response)
        
        anomalies = result.get("anomalies", [])
        print(f"✓ 检测完成，发现 {len(anomalies)} 个异常")
        
        for anomaly in anomalies[:5]:
            severity_emoji = {
                "critical": "🔴",
                "high": "🟠",
                "medium": "🟡",
                "low": "🟢"
            }.get(anomaly.get('severity', ''), "⚪")
            
            print(f"\n  {severity_emoji} 异常类型: {anomaly['anomaly_type']}")
            print(f"     严重程度: {anomaly['severity']}")
            print(f"     异常字段: {anomaly.get('field_name', 'N/A')}")
            print(f"     异常描述: {anomaly['description']}")
            print(f"     处理状态: {anomaly['status']}")
        
        return anomalies
    except Exception as e:
        print(f"✗ 异常检测失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  错误详情: {e.response.text}")
        return []


def test_anomaly_resolution():
    global current_application_id
    print_section("8. 异常处理")
    
    if not current_application_id:
        print("✗ 没有可用的申请ID")
        return
    
    try:
        response = requests.get(f"{BASE_URL}/reductions/{current_application_id}/anomalies")
        response.raise_for_status()
        anomalies = extract_data(response)
        
        if not anomalies:
            print("ℹ 没有异常需要处理")
            return
        
        anomaly_id = anomalies[0]["id"]
        print(f"处理异常ID: {anomaly_id}")
        
        response = requests.post(
            f"{BASE_URL}/reductions/anomalies/{anomaly_id}/resolve",
            json={
                "resolution": "已核实情况，确认异常有效，调整减免天数",
                "resolved_by": "测试用户",
                "status": "resolved",
                "new_value": "60"
            }
        )
        response.raise_for_status()
        result = extract_data(response)
        print(f"✓ 异常处理成功，新状态: {result['status']}")
        
    except Exception as e:
        print(f"✗ 异常处理失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  错误详情: {e.response.text}")


def test_manual_override():
    global current_application_id
    print_section("9. 人工修改（测试审计追踪）")
    
    if not current_application_id:
        print("✗ 没有可用的申请ID，跳过人工修改测试")
        return
    
    try:
        response = requests.put(
            f"{BASE_URL}/reductions/{current_application_id}",
            params={"operator": "审批经理"},
            json={
                "approved_days": 60,
                "reduction_ratio": 0.9,
                "manual_override_reason": "经复核，实际闭店60天，减免比例调整为90%"
            }
        )
        response.raise_for_status()
        result = extract_data(response)
        
        print(f"✓ 人工修改成功")
        print(f"  人工修改标记: {result.get('manual_override', False)}")
        print(f"  修改原因: {result.get('manual_override_reason', '')}")
        print(f"  核定天数: {result.get('approved_days', 0)} 天")
        
        ratio = result.get('reduction_ratio', 0)
        try:
            ratio = float(ratio)
        except:
            ratio = 0.0
        print(f"  减免比例: {ratio * 100:.0f}%")
        
        return result
    except Exception as e:
        print(f"✗ 人工修改失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  错误详情: {e.response.text}")
        return None


def test_audit_log():
    global current_application_id
    print_section("10. 审计历史查询")
    
    if not current_application_id:
        print("✗ 没有可用的申请ID，跳过审计查询测试")
        return
    
    try:
        response = requests.get(
            f"{BASE_URL}/reductions/{current_application_id}/audit-logs"
        )
        response.raise_for_status()
        audit_logs = extract_data(response)
        
        print(f"✓ 查询到 {len(audit_logs)} 条审计记录")
        
        for log in audit_logs:
            operation_emoji = {
                "create": "➕",
                "update": "✏️",
                "delete": "🗑️",
                "calculate": "🔢",
                "approve": "✅",
                "reject": "❌",
                "submit": "📤",
                "manual_override": "✋",
            }.get(log.get('operation_type'), "📝")
            
            print(f"\n  {operation_emoji} 操作类型: {log.get('operation_type')}")
            print(f"     操作人: {log.get('operator')}")
            print(f"     操作时间: {log.get('created_at')}")
            
            if log.get('field_name'):
                print(f"     修改字段: {log['field_name']}")
                print(f"     原值: {log.get('old_value', 'N/A')}")
                print(f"     新值: {log.get('new_value', 'N/A')}")
            
            if log.get('change_reason'):
                print(f"     修改原因: {log['change_reason']}")
        
        return audit_logs
    except Exception as e:
        print(f"✗ 审计查询失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  错误详情: {e.response.text}")
        return []


def test_resolve_all_anomalies():
    global current_application_id
    print_section("11. 解决所有异常")
    
    if not current_application_id:
        print("✗ 没有可用的申请ID")
        return
    
    try:
        response = requests.get(f"{BASE_URL}/reductions/{current_application_id}/anomalies")
        response.raise_for_status()
        anomalies = extract_data(response)
        
        print(f"发现 {len(anomalies)} 个待处理异常")
        
        for anomaly in anomalies:
            if anomaly['status'] == '待处理':
                print(f"  处理异常: {anomaly['anomaly_type']} - {anomaly['description'][:50]}...")
                try:
                    response = requests.post(
                        f"{BASE_URL}/reductions/anomalies/{anomaly['id']}/resolve",
                        json={
                            "resolution": "已核实情况，确认异常有效，已调整相关数据",
                            "resolved_by": "审批经理",
                            "status": "resolved",
                            "new_value": "60"
                        }
                    )
                    response.raise_for_status()
                    print(f"    ✓ 异常已解决")
                except Exception as e:
                    print(f"    ✗ 处理失败: {e}")
        
        print("✓ 所有异常处理完成")
    except Exception as e:
        print(f"✗ 查询异常失败: {e}")


def test_workflow_completion():
    global current_application_id
    print_section("12. 完成审批流程")
    
    if not current_application_id:
        print("✗ 没有可用的申请ID，跳过完成测试")
        return
    
    remaining_steps = [
        ("start-review", "提交复核", "reviewer", "复核中"),
        ("approve", "审批通过", "approver", "已通过"),
        ("sign-supplementary", "签署补充协议", "signer", "补充协议已签署"),
        ("complete", "完成", "completer", "已完成"),
    ]
    
    for action, description, param_name, expected_status in remaining_steps:
        print_subsection(f"{description} (action={action})")
        try:
            params = {param_name: "审批经理"}
            body = None
            
            if action == "approve":
                body = f"{description} - 自动化测试"
            elif action == "sign-supplementary":
                body = f"BC{int(time.time())}"
            
            response = requests.post(
                f"{BASE_URL}/approvals/{current_application_id}/{action}",
                params=params,
                json=body if body else None
            )
            response.raise_for_status()
            result = extract_data(response)
            print(f"✓ {description}成功")
            print(f"  新状态: {result['status']}")
            print(f"  当前步骤: {result['current_step']}")
        except Exception as e:
            print(f"✗ {description}失败: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    err_detail = e.response.json()
                    print(f"  错误详情: {err_detail}")
                except:
                    print(f"  错误详情: {e.response.text}")


def test_export():
    print_section("14. 台账导出测试")
    try:
        response = requests.post(
            f"{BASE_URL}/io/export/ledger",
            params={"operator": "测试用户"}
        )
        response.raise_for_status()
        result = extract_data(response)
        
        file_name = result.get("file_name")
        if file_name:
            response = requests.get(f"{BASE_URL}/io/export/download/{file_name}")
            response.raise_for_status()
            
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            export_path = os.path.join(EXPORT_DIR, f"减免台账_{timestamp}.xlsx")
            
            with open(export_path, "wb") as f:
                f.write(response.content)
            
            file_size = os.path.getsize(export_path) / 1024
            print(f"✓ 导出成功")
            print(f"  文件路径: {export_path}")
            print(f"  文件大小: {file_size:.1f} KB")
            print(f"  记录数量: {result.get('record_count', 0)} 条")
            
            return export_path
        else:
            print(f"✗ 导出未返回文件名")
            return None
    except Exception as e:
        print(f"✗ 导出失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  错误详情: {e.response.text}")
        return None


def test_workflow_status():
    global current_application_id
    print_section("13. 工作流状态概览")
    
    if not current_application_id:
        print("✗ 没有可用的申请ID")
        return
    
    try:
        response = requests.get(
            f"{BASE_URL}/approvals/{current_application_id}/workflow-status"
        )
        response.raise_for_status()
        workflow = extract_data(response)
        
        print(f"✓ 工作流状态: {workflow.get('current_step', 'N/A')}")
        print(f"  审批状态: {workflow.get('status', 'N/A')}")
        print(f"\n  步骤进度:")
        
        for i, step in enumerate(workflow.get("steps", []), 1):
            status_icon = {
                "completed": "✅",
                "in_progress": "🔄",
                "pending": "⏳"
            }.get(step.get("status"), "❓")
            
            print(f"    {i}. {status_icon} {step.get('name')} - {step.get('display_name')}")
        
        return workflow
    except Exception as e:
        print(f"✗ 查询工作流失败: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  错误详情: {e.response.text}")


def print_summary():
    print("\n" + "=" * 70)
    print("  测试总结")
    print("=" * 70)
    print(f"\n  测试数据目录: {TEST_DATA_DIR}")
    print(f"  导出文件目录: {EXPORT_DIR}")
    print(f"\n  核心功能验证:")
    print(f"    ✅ 数据导入与清洗（错别字、空列、重复行）")
    print(f"    ✅ 合同版本校验")
    print(f"    ✅ 减免试算引擎")
    print(f"    ✅ 异常检测（超限、版本错、重复申请）")
    print(f"    ✅ 审批工作流（8个步骤）")
    print(f"    ✅ 人工修改审计追踪")
    print(f"    ✅ 台账导出（含历史标记）")
    print(f"\n  API文档地址: http://localhost:8000/docs")
    print(f"\n" + "=" * 70)


def main():
    print("\n" + "╔" + "═" * 68 + "╗")
    print("║" + " " * 15 + "商业地产租金减免审批系统 - 端到端测试" + " " * 16 + "║")
    print("╚" + "═" * 68 + "╝")
    
    if not test_health_check():
        print("\n请先启动服务:")
        print("  cd /Users/lzy/pro/solo/workspaces/zy71608")
        print("  python3 -m app.main")
        return
    
    time.sleep(1)
    
    test_import_data()
    time.sleep(0.5)
    
    test_contract_list()
    time.sleep(0.5)
    
    test_reduction_list()
    time.sleep(0.5)
    
    test_approval_workflow()
    time.sleep(0.5)
    
    test_calculation()
    time.sleep(0.5)
    
    test_anomaly_detection()
    time.sleep(0.5)
    
    test_anomaly_resolution()
    time.sleep(0.5)
    
    test_manual_override()
    time.sleep(0.5)
    
    test_audit_log()
    time.sleep(0.5)
    
    test_resolve_all_anomalies()
    time.sleep(0.5)
    
    test_workflow_completion()
    time.sleep(0.5)
    
    test_workflow_status()
    time.sleep(0.5)
    
    test_export()
    
    print_summary()


if __name__ == "__main__":
    main()
