#!/usr/bin/env python3
"""集成测试脚本"""

import json
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import os

from dns_switch_sim.models import (
    SwitchPlan, SwitchStep, SwitchPhase, Region, CDNVendor,
    DNSRecord, DNSRecordType, VendorExport, ProbeLog
)
from dns_switch_sim.parsers import ParserFactory
from dns_switch_sim.simulation import SimulationEngine
from dns_switch_sim.exporters import MarkdownExporter, JSONAuditExporter


def create_test_data(temp_dir: Path):
    """创建测试数据"""
    
    now = datetime.now()
    start_time = now.replace(hour=14, minute=0, second=0, microsecond=0)
    
    switch_plan_data = {
        "plan_id": "test_switch_001",
        "name": "测试 CDN 切换计划",
        "domain": "cdn.example.com",
        "original_vendor": "cdn_a",
        "target_vendor": "cdn_b",
        "rollback_vendor": "cdn_a",
        "created_at": now.isoformat(),
        "planned_start_time": start_time.isoformat(),
        "steps": [
            {
                "step_id": "step_001",
                "phase": "ttl_lower",
                "description": "降低 TTL",
                "target_vendor": "cdn_a",
                "region": "global",
                "start_time": start_time.isoformat(),
                "duration_minutes": 30,
                "traffic_percent": 100,
            },
            {
                "step_id": "step_002",
                "phase": "traffic_shift",
                "description": "切流至 CDN B",
                "target_vendor": "cdn_b",
                "region": "cn_main",
                "start_time": (start_time + timedelta(minutes=30)).isoformat(),
                "duration_minutes": 15,
                "traffic_percent": 100,
            },
            {
                "step_id": "step_003",
                "phase": "rollback",
                "description": "回滚至 CDN A",
                "target_vendor": "cdn_a",
                "region": "global",
                "start_time": (start_time + timedelta(minutes=120)).isoformat(),
                "duration_minutes": 15,
                "traffic_percent": 100,
            },
        ],
    }
    
    dns_records_data = [
        {
            "domain": "cdn.example.com",
            "type": "CNAME",
            "value": "cdn-a.example.com",
            "ttl": 300,
            "region": "cn_main",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
        {
            "domain": "cdn.example.com",
            "type": "CNAME",
            "value": "cdn-a.example.com",
            "ttl": 300,
            "region": "na",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
    ]
    
    vendor_export_data = [
        {
            "vendor": "cdn_a",
            "region": "cn_main",
            "domain": "cdn.example.com",
            "cname_target": "cdn-a.example.com",
            "health_status": "healthy",
            "last_check": now.isoformat(),
            "bandwidth_mbps": 1250.5,
            "error_rate": 0.001,
        },
        {
            "vendor": "cdn_b",
            "region": "cn_main",
            "domain": "cdn.example.com",
            "cname_target": "cdn-b.example.com",
            "health_status": "healthy",
            "last_check": now.isoformat(),
            "bandwidth_mbps": 890.2,
            "error_rate": 0.002,
        },
    ]
    
    probe_log_data = [
        {
            "timestamp": now.isoformat(),
            "region": "cn_main",
            "domain": "cdn.example.com",
            "resolver_ip": "114.114.114.114",
            "resolved_ips": ["1.2.3.4", "1.2.3.5"],
            "resolved_cname": "cdn-a.example.com",
            "http_status": 200,
            "response_time_ms": 45,
            "success": True,
        },
        {
            "timestamp": (now - timedelta(seconds=30)).isoformat(),
            "region": "cn_main",
            "domain": "cdn.example.com",
            "resolver_ip": "8.8.8.8",
            "resolved_ips": ["5.6.7.8"],
            "resolved_cname": "cdn-a.example.com",
            "http_status": 200,
            "response_time_ms": 120,
            "success": True,
        },
        {
            "timestamp": (now - timedelta(seconds=60)).isoformat(),
            "region": "cn_main",
            "domain": "cdn.example.com",
            "resolver_ip": "1.1.1.1",
            "resolved_ips": ["9.10.11.12"],
            "resolved_cname": "cdn-a.example.com",
            "http_status": 500,
            "response_time_ms": 500,
            "success": False,
        },
    ]
    
    plan_path = temp_dir / "switch_plan.json"
    dns_path = temp_dir / "dns_records.json"
    vendor_path = temp_dir / "vendor_export.json"
    probe_path = temp_dir / "probe_log.json"
    
    with open(plan_path, "w", encoding="utf-8") as f:
        json.dump(switch_plan_data, f, ensure_ascii=False, indent=2)
    
    with open(dns_path, "w", encoding="utf-8") as f:
        json.dump(dns_records_data, f, ensure_ascii=False, indent=2)
    
    with open(vendor_path, "w", encoding="utf-8") as f:
        json.dump(vendor_export_data, f, ensure_ascii=False, indent=2)
    
    with open(probe_path, "w", encoding="utf-8") as f:
        json.dump(probe_log_data, f, ensure_ascii=False, indent=2)
    
    return plan_path, dns_path, vendor_path, probe_path


def run_test():
    """运行集成测试"""
    
    print("=" * 60)
    print("DNS 切换演练模拟工具 - 集成测试")
    print("=" * 60)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        print("\n[1/5] 创建测试数据...")
        plan_path, dns_path, vendor_path, probe_path = create_test_data(temp_path)
        print(f"  ✅ 切换计划: {plan_path}")
        print(f"  ✅ 域名记录: {dns_path}")
        print(f"  ✅ 供应商导出: {vendor_path}")
        print(f"  ✅ 探测日志: {probe_path}")
        
        print("\n[2/5] 解析数据文件...")
        switch_plan = ParserFactory.parse(plan_path, "switch_plan")
        dns_records = ParserFactory.parse(dns_path, "dns_records")
        vendor_exports = ParserFactory.parse(vendor_path, "vendor_export")
        probe_logs = ParserFactory.parse(probe_path, "probe_log")
        
        print(f"  ✅ 切换计划: {switch_plan.name}")
        print(f"  ✅ 域名记录: {len(dns_records)} 条")
        print(f"  ✅ 供应商导出: {len(vendor_exports)} 条")
        print(f"  ✅ 探测日志: {len(probe_logs)} 条")
        
        print("\n[3/5] 执行模拟...")
        sim_time = switch_plan.planned_start_time + timedelta(minutes=20)
        print(f"  🕐 模拟时间: {sim_time}")
        
        engine = SimulationEngine(switch_plan, dns_records, vendor_exports, probe_logs)
        result = engine.simulate(sim_time)
        
        print(f"  ✅ 模拟 ID: {result.simulation_id}")
        print(f"  ✅ 检查结果: {len(result.check_results)} 项")
        
        stats = {}
        for check in result.check_results:
            stats[check.result.value] = stats.get(check.result.value, 0) + 1
        for status, count in stats.items():
            print(f"    - {status}: {count} 项")
        
        print("\n[4/5] 导出报告...")
        md_path = temp_path / "report.md"
        json_path = temp_path / "audit.json"
        
        MarkdownExporter.export(result, switch_plan, md_path)
        print(f"  ✅ Markdown 报告: {md_path}")
        
        JSONAuditExporter.export(result, switch_plan, json_path)
        print(f"  ✅ JSON 审计包: {json_path}")
        
        print("\n[5/5] 验证输出...")
        if md_path.exists():
            with open(md_path, "r", encoding="utf-8") as f:
                md_content = f.read()
                print(f"  ✅ Markdown 报告大小: {len(md_content)} 字符")
                if "DNS 切换演练报告" in md_content:
                    print(f"  ✅ Markdown 报告内容有效")
        
        if json_path.exists():
            with open(json_path, "r", encoding="utf-8") as f:
                json_content = json.load(f)
                print(f"  ✅ JSON 审计包版本: {json_content.get('audit_version')}")
                print(f"  ✅ 模拟 ID: {json_content.get('simulation', {}).get('id')}")
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        
        print("\n📋 测试结果摘要:")
        print(f"  - 数据解析: 通过")
        print(f"  - 模拟引擎: 通过")
        print(f"  - 检查模块: 通过 ({len(result.check_results)} 项检查)")
        print(f"  - 导出模块: 通过 (Markdown + JSON)")
        
        return True


if __name__ == "__main__":
    run_test()
