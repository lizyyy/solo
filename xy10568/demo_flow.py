#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
演示脚本：展示远程设备指令审计CLI的完整流程
包含成功路径和失败路径
"""

import os
import sys
import json
from datetime import datetime
from device_audit_cli import DeviceAuditCLI


def print_section(title):
    """打印分隔标题"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def demo_success_path():
    """演示成功路径：对摄像头分组执行安全指令"""
    print_section("演示路径 1: 成功路径 - 摄像头快照指令")
    
    cli = DeviceAuditCLI()
    
    # 1. 查看指令模板详情
    print("\n【1】查看指令模板详情")
    cli._show_template_detail("TPL-CAM-SNAPSHOT")
    
    # 2. 查看设备详情
    print("\n【2】查看摄像头设备详情")
    cli._show_device_detail("CAM-001")
    
    # 3. 创建批次 - 对摄像头分组执行
    print("\n【3】创建指令批次 (安全指令，无需确认)")
    
    template = cli._execute_sql("SELECT * FROM command_templates WHERE id = ?", ("TPL-CAM-SNAPSHOT",))[0]
    group = cli._execute_sql("SELECT * FROM groups WHERE id = ?", ("GRP-CAM",))[0]
    mappings = cli._execute_sql("SELECT device_id FROM device_group_mapping WHERE group_id = ?", ("GRP-CAM",))
    device_ids = [m['device_id'] for m in mappings]
    
    params = {"output_path": "/tmp/snapshot.jpg"}
    
    batch_id = cli._generate_id("BATCH-")
    now = datetime.now().isoformat()
    
    cli._insert("batches", {
        "id": batch_id,
        "command_template_id": "TPL-CAM-SNAPSHOT",
        "params_json": json.dumps(params, ensure_ascii=False),
        "status": "pending",
        "created_at": now,
        "created_by": "demo_operator"
    })
    
    for device_id in device_ids:
        device = cli._execute_sql("SELECT * FROM devices WHERE id = ?", (device_id,))[0]
        execution_id = cli._generate_id("EXEC-")
        
        if device['status'] == 'offline':
            cli._insert("executions", {
                "id": execution_id, "batch_id": batch_id, "device_id": device_id,
                "status": "skipped", "attempt_count": 0, "max_attempts": 3,
                "last_error": "设备离线",
                "created_at": now, "updated_at": now
            })
            cli._insert("audit_logs", {
                "id": cli._generate_id("LOG-"), "batch_id": batch_id,
                "execution_id": execution_id, "device_id": device_id,
                "action": "skip",
                "before_data": json.dumps({"status": "pending"}, ensure_ascii=False),
                "after_data": json.dumps({"status": "skipped", "reason": "device offline"}, ensure_ascii=False),
                "operator": "system", "reason": "设备离线，自动跳过",
                "created_at": now
            })
        else:
            cli._insert("executions", {
                "id": execution_id, "batch_id": batch_id, "device_id": device_id,
                "status": "pending", "attempt_count": 0, "max_attempts": 3,
                "request_log": json.dumps({
                    "template_id": "TPL-CAM-SNAPSHOT",
                    "template_content": template['content'],
                    "params": params
                }, ensure_ascii=False),
                "created_at": now, "updated_at": now
            })
    
    cli._insert("audit_logs", {
        "id": cli._generate_id("LOG-"), "batch_id": batch_id, "execution_id": None,
        "device_id": None, "action": "create_batch",
        "before_data": None,
        "after_data": json.dumps({
            "template_id": "TPL-CAM-SNAPSHOT",
            "template_name": template['name'],
            "device_count": len(device_ids), "params": params
        }, ensure_ascii=False),
        "operator": "demo_operator", "reason": "创建新指令批次",
        "created_at": now
    })
    
    print(f"✓ 批次创建成功: {batch_id}")
    print(f"  - 目标分组: {group['name']} ({len(device_ids)}个设备)")
    print(f"  - 指令: {template['name']}")
    
    # 4. 执行批次
    print(f"\n【4】执行批次 {batch_id}")
    executions = cli._execute_sql("SELECT * FROM executions WHERE batch_id = ?", (batch_id,))
    
    for exec in executions:
        if exec['status'] == 'skipped':
            print(f"  ⏭️  {exec['device_id']}: 已跳过 (设备离线)")
            continue
        
        # 模拟全部成功
        now2 = datetime.now().isoformat()
        cli._update("executions", {
            "status": "success", "attempt_count": 1,
            "response_log": json.dumps({
                "success": True, "timestamp": now2,
                "output": f"Snapshot saved to {params['output_path']}"
            }, ensure_ascii=False),
            "last_error": None, "updated_at": now2
        }, {"id": exec['id']})
        
        cli._insert("audit_logs", {
            "id": cli._generate_id("LOG-"), "batch_id": batch_id,
            "execution_id": exec['id'], "device_id": exec['device_id'],
            "action": "execute_success",
            "before_data": json.dumps({"status": "pending"}, ensure_ascii=False),
            "after_data": json.dumps({"status": "success", "attempt": 1}, ensure_ascii=False),
            "operator": "system", "reason": "指令执行成功",
            "created_at": now2
        })
        
        print(f"  ✅ {exec['device_id']}: 成功")
    
    cli._update("batches", {"status": "completed"}, {"id": batch_id})
    
    # 5. 查看批次详情
    print(f"\n【5】查看批次详情")
    cli._show_batch_detail(batch_id)
    
    # 6. 生成报告
    print(f"\n【6】生成批次报告")
    cli._generate_batch_report(batch_id)
    
    return batch_id


def demo_failure_path():
    """演示失败路径：对全部设备执行危险指令，包含离线设备和失败设备"""
    print_section("演示路径 2: 失败路径 - 危险指令 + 离线设备 + 失败设备")
    
    cli = DeviceAuditCLI()
    
    # 1. 查看危险指令模板
    print("\n【1】查看危险指令模板")
    cli._show_template_detail("TPL-CONFIG-SYNC")
    
    # 2. 创建批次 - 对全部设备执行危险指令
    print("\n【2】创建危险指令批次 (⚠️ 需要确认)")
    
    template = cli._execute_sql("SELECT * FROM command_templates WHERE id = ?", ("TPL-CONFIG-SYNC",))[0]
    group = cli._execute_sql("SELECT * FROM groups WHERE id = ?", ("GRP-ALL",))[0]
    mappings = cli._execute_sql("SELECT device_id FROM device_group_mapping WHERE group_id = ?", ("GRP-ALL",))
    device_ids = [m['device_id'] for m in mappings]
    
    params = {"device_ip": "192.168.1.1"}
    
    print(f"  ⚠️  这是一个危险指令！")
    print(f"  - 指令名称: {template['name']}")
    print(f"  - 指令内容: {template['content']}")
    print(f"  - 目标分组: {group['name']} ({len(device_ids)}个设备)")
    print(f"  - 已确认执行 (演示模式)")
    
    batch_id = cli._generate_id("BATCH-")
    now = datetime.now().isoformat()
    
    cli._insert("batches", {
        "id": batch_id,
        "command_template_id": "TPL-CONFIG-SYNC",
        "params_json": json.dumps(params, ensure_ascii=False),
        "status": "pending",
        "created_at": now,
        "created_by": "demo_admin"
    })
    
    skipped_count = 0
    pending_count = 0
    
    for device_id in device_ids:
        device = cli._execute_sql("SELECT * FROM devices WHERE id = ?", (device_id,))[0]
        execution_id = cli._generate_id("EXEC-")
        
        if device['status'] == 'offline':
            cli._insert("executions", {
                "id": execution_id, "batch_id": batch_id, "device_id": device_id,
                "status": "skipped", "attempt_count": 0, "max_attempts": 3,
                "last_error": "设备离线",
                "created_at": now, "updated_at": now
            })
            cli._insert("audit_logs", {
                "id": cli._generate_id("LOG-"), "batch_id": batch_id,
                "execution_id": execution_id, "device_id": device_id,
                "action": "skip",
                "before_data": json.dumps({"status": "pending"}, ensure_ascii=False),
                "after_data": json.dumps({"status": "skipped", "reason": "device offline"}, ensure_ascii=False),
                "operator": "system", "reason": "设备离线，自动跳过",
                "created_at": now
            })
            skipped_count += 1
        else:
            cli._insert("executions", {
                "id": execution_id, "batch_id": batch_id, "device_id": device_id,
                "status": "pending", "attempt_count": 0, "max_attempts": 3,
                "request_log": json.dumps({
                    "template_id": "TPL-CONFIG-SYNC",
                    "template_content": template['content'],
                    "params": params
                }, ensure_ascii=False),
                "created_at": now, "updated_at": now
            })
            pending_count += 1
    
    cli._insert("audit_logs", {
        "id": cli._generate_id("LOG-"), "batch_id": batch_id, "execution_id": None,
        "device_id": None, "action": "create_batch",
        "before_data": None,
        "after_data": json.dumps({
            "template_id": "TPL-CONFIG-SYNC",
            "template_name": template['name'],
            "device_count": len(device_ids), "params": params,
            "is_dangerous": True
        }, ensure_ascii=False),
        "operator": "demo_admin", "reason": "管理员确认执行危险指令",
        "created_at": now
    })
    
    print(f"✓ 批次创建成功: {batch_id}")
    print(f"  - 待执行: {pending_count} 个")
    print(f"  - 已跳过(离线): {skipped_count} 个")
    
    # 3. 执行批次 (部分成功，部分失败)
    print(f"\n【3】执行批次 {batch_id} (模拟部分失败)")
    executions = cli._execute_sql("SELECT * FROM executions WHERE batch_id = ?", (batch_id,))
    
    success_count = 0
    fail_count = 0
    failed_executions = []
    
    for exec in executions:
        if exec['status'] == 'skipped':
            print(f"  ⏭️  {exec['device_id']}: 已跳过")
            continue
        
        # 模拟部分设备失败（最后2个设备失败）
        device = cli._execute_sql("SELECT * FROM devices WHERE id = ?", (exec['device_id'],))[0]
        is_success = device['id'] not in ['SEN-002', 'SEN-003']
        
        now2 = datetime.now().isoformat()
        
        if is_success:
            cli._update("executions", {
                "status": "success", "attempt_count": 1,
                "response_log": json.dumps({
                    "success": True, "timestamp": now2,
                    "output": "Config synchronized successfully"
                }, ensure_ascii=False),
                "last_error": None, "updated_at": now2
            }, {"id": exec['id']})
            
            cli._insert("audit_logs", {
                "id": cli._generate_id("LOG-"), "batch_id": batch_id,
                "execution_id": exec['id'], "device_id": exec['device_id'],
                "action": "execute_success",
                "before_data": json.dumps({"status": "pending"}, ensure_ascii=False),
                "after_data": json.dumps({"status": "success", "attempt": 1}, ensure_ascii=False),
                "operator": "system", "reason": "指令执行成功",
                "created_at": now2
            })
            
            print(f"  ✅ {exec['device_id']}: 成功")
            success_count += 1
        else:
            # 模拟失败后重试2次仍然失败
            error_msg = f"配置同步失败: 网络超时"
            cli._update("executions", {
                "status": "failed", "attempt_count": 3,
                "response_log": json.dumps({
                    "success": False, "timestamp": now2,
                    "error": error_msg, "attempts": 3
                }, ensure_ascii=False),
                "last_error": error_msg, "updated_at": now2
            }, {"id": exec['id']})
            
            cli._insert("audit_logs", {
                "id": cli._generate_id("LOG-"), "batch_id": batch_id,
                "execution_id": exec['id'], "device_id": exec['device_id'],
                "action": "execute_failed",
                "before_data": json.dumps({"status": "pending", "attempts": 0}, ensure_ascii=False),
                "after_data": json.dumps({"status": "failed", "attempts": 3, "error": error_msg}, ensure_ascii=False),
                "operator": "system", "reason": error_msg,
                "created_at": now2
            })
            
            failed_executions.append(exec)
            print(f"  ❌ {exec['device_id']}: 失败 (已达到最大重试次数)")
            fail_count += 1
    
    cli._update("batches", {"status": "completed"}, {"id": batch_id})
    
    print(f"\n执行结果: 成功={success_count}, 失败={fail_count}, 跳过={skipped_count}")
    
    # 4. 查看失败详情
    print(f"\n【4】查看失败设备详情")
    for exec in failed_executions:
        device = cli._execute_sql("SELECT * FROM devices WHERE id = ?", (exec['device_id'],))[0]
        print(f"\n  🚨 设备: {device['id']} ({device['name']})")
        print(f"     IP: {device['ip']}")
        print(f"     错误: {exec['last_error']}")
    
    # 5. 人工修正失败设备
    print(f"\n【5】人工修正失败设备")
    
    for exec in failed_executions:
        print(f"\n  处理设备: {exec['device_id']}")
        print(f"  当前状态: {exec['status']}")
        print(f"  错误信息: {exec['last_error']}")
        print(f"  ➡️  人工已手动修复该设备，标记为 'manual' 状态")
        
        now3 = datetime.now().isoformat()
        before_data = {"status": exec['status'], "attempt_count": exec['attempt_count'], "last_error": exec['last_error']}
        
        cli._update("executions", {
            "status": "manual", "updated_at": now3
        }, {"id": exec['id']})
        
        after_data = {"status": "manual", "attempt_count": exec['attempt_count'], "manual_operator": "on_site_tech"}
        
        cli._insert("audit_logs", {
            "id": cli._generate_id("LOG-"), "batch_id": batch_id,
            "execution_id": exec['id'], "device_id": exec['device_id'],
            "action": "manual_fix",
            "before_data": json.dumps(before_data, ensure_ascii=False),
            "after_data": json.dumps(after_data, ensure_ascii=False),
            "operator": "on_site_tech",
            "reason": "现场技术人员已手动配置设备",
            "created_at": now3
        })
        
        print(f"  ✓ 已记录人工修正，操作者: on_site_tech")
        print(f"  ✓ 状态变化: {exec['status']} → manual")
    
    # 6. 生成报告
    print(f"\n【6】生成批次报告")
    cli._generate_batch_report(batch_id)
    
    return batch_id


def demo_overall_report():
    """演示总体报告"""
    print_section("演示路径 3: 总体审计报告")
    
    cli = DeviceAuditCLI()
    cli._generate_overall_report()


def main():
    """主函数"""
    print("\n" + "#" * 60)
    print("#  远程设备指令审计 CLI - 完整演示")
    print("#" * 60)
    
    # 初始化
    print_section("步骤 1: 初始化环境")
    cli = DeviceAuditCLI()
    cli._init_database()
    config = cli._get_config()
    config['work_dir'] = cli.work_dir
    config['max_retries'] = 3
    config['skip_offline'] = True
    config['idempotent_check'] = True
    cli._save_config(config)
    print(f"✓ 工作目录: {cli.work_dir}")
    print(f"✓ 数据库文件: {cli.db_path}")
    
    # 导入样例数据
    print_section("步骤 2: 导入样例数据")
    cli._import_example_data()
    
    # 检查数据
    print_section("步骤 3: 数据检查")
    cli.check(type('Args', (), {})())
    
    # 演示成功路径
    batch1 = demo_success_path()
    
    # 演示失败路径
    batch2 = demo_failure_path()
    
    # 演示总体报告
    demo_overall_report()
    
    print_section("演示完成")
    print("\n关键批次ID:")
    print(f"  - 成功路径批次: {batch1}")
    print(f"  - 失败路径批次: {batch2}")
    print("\n可使用以下命令查看详情:")
    print(f"  python3 device_audit_cli.py detail --batch {batch1}")
    print(f"  python3 device_audit_cli.py detail --batch {batch2}")
    print(f"  python3 device_audit_cli.py report --batch {batch1}")
    print(f"  python3 device_audit_cli.py report --batch {batch2}")
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
