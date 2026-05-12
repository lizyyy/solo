#!/usr/bin/env python3
"""
电商赠品履约CLI - 自动化演示脚本
执行这个脚本可以完整验证所有核心功能
"""
import os
import sys
import json
import shutil
from datetime import datetime


def run_cmd(cmd):
    print(f"\n{'='*60}")
    print(f"执行: {cmd}")
    print('='*60)
    ret = os.system(cmd)
    return ret == 0


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    print("="*60)
    print("  电商赠品履约CLI - 自动化演示脚本")
    print("  时间:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("="*60)
    
    data_dir = os.path.join(script_dir, "data")
    if os.path.exists(data_dir):
        print("\n清理旧数据...")
        shutil.rmtree(data_dir)
    
    print("\n检查 Python 版本...")
    print(f"Python 版本: {sys.version}")
    
    print("\n" + "="*60)
    print("【阶段1: 初始化系统 + 加载样例】")
    print("="*60)
    
    if not run_cmd(f"{sys.executable} -m src.cli init --with-samples"):
        print("\n❌ 初始化失败，终止演示")
        return 1
    
    print("\n" + "="*60)
    print("【阶段2: 规则校验】")
    print("="*60)
    
    if not run_cmd(f"{sys.executable} -m src.cli check"):
        print("\n❌ 规则校验失败")
        return 1
    
    print("\n" + "="*60)
    print("【阶段3: 查看订单详情(正常赠送订单)】")
    print("="*60)
    
    if not run_cmd(f"{sys.executable} -m src.cli detail ORD_001_NORMAL"):
        print("\n❌ 查看订单详情失败")
        return 1
    
    print("\n" + "="*60)
    print("【阶段4: 查看拆单订单详情】")
    print("="*60)
    
    if not run_cmd(f"{sys.executable} -m src.cli detail ORD_004_SPLIT_A"):
        print("\n❌ 查看拆单订单失败")
        return 1
    
    print("\n" + "="*60)
    print("【阶段5: 分配赠品库存】")
    print("="*60)
    
    if not run_cmd(f"{sys.executable} -m src.cli allocate"):
        print("\n❌ 库存分配失败")
        return 1
    
    print("\n" + "="*60)
    print("【阶段6: 模拟发货回调】")
    print("="*60)
    
    if not run_cmd(f"{sys.executable} -m src.cli import-data shipment test_data/shipment_normal.json"):
        print("\n❌ 发货回调处理失败")
        return 1
    
    print("\n" + "="*60)
    print("【阶段7: 测试幂等性 - 重复发货回调】")
    print("="*60)
    
    run_cmd(f"{sys.executable} -m src.cli import-data shipment test_data/shipment_normal.json")
    print("(预期: 显示重复发货回调，幂等保护生效)")
    
    print("\n" + "="*60)
    print("【阶段8: 查看发货后的订单详情】")
    print("="*60)
    
    run_cmd(f"{sys.executable} -m src.cli detail ORD_001_NORMAL")
    
    print("\n" + "="*60)
    print("【阶段9: 模拟退货(ORD_003_PARTIAL_RETURN) - 先发货】")
    print("="*60)
    
    shipment_data = {
        "order_id": "ORD_003_PARTIAL_RETURN",
        "gift_sku": "GIFT_SK001",
        "gift_qty": 1,
        "tracking_no": "SF9999999999"
    }
    temp_shipment = os.path.join(script_dir, "test_data", "temp_shipment_003.json")
    with open(temp_shipment, 'w', encoding='utf-8') as f:
        json.dump(shipment_data, f, indent=2)
    
    run_cmd(f"{sys.executable} -m src.cli import-data shipment {temp_shipment}")
    
    print("\n" + "="*60)
    print("【阶段10: 模拟退货回调 - 扣费场景】")
    print("="*60)
    
    if not run_cmd(f"{sys.executable} -m src.cli import-data return test_data/return_partial.json"):
        print("\n⚠️ 退货处理可能有警告(扣费场景)")
    
    print("\n" + "="*60)
    print("【阶段11: 查看退货后的订单详情】")
    print("="*60)
    
    run_cmd(f"{sys.executable} -m src.cli detail ORD_003_PARTIAL_RETURN")
    
    print("\n" + "="*60)
    print("【阶段12: 创建补发任务】")
    print("="*60)
    
    run_cmd(f"{sys.executable} -m src.cli reissue create ORD_002_STOCK_SHORTAGE --reason \"物流丢件\" --operator \"DEMO_OP_001\"")
    
    print("\n" + "="*60)
    print("【阶段13: 查看审计日志】")
    print("="*60)
    
    run_cmd(f"{sys.executable} -m src.cli list-audits")
    
    print("\n" + "="*60)
    print("【阶段14: 查看库存操作日志】")
    print("="*60)
    
    run_cmd(f"{sys.executable} -m src.cli list-inv-ops")
    
    print("\n" + "="*60)
    print("【阶段15: 生成整体报告】")
    print("="*60)
    
    if not run_cmd(f"{sys.executable} -m src.cli report"):
        print("\n❌ 生成报告失败")
        return 1
    
    if os.path.exists(temp_shipment):
        os.remove(temp_shipment)
    
    print("\n" + "="*60)
    print("  ✅ 演示完成！")
    print("  请查看 report 输出判断业务闭环:")
    print("  - 赠品状态分布: 清楚看到各阶段状态")
    print("  - 库存情况: 可用/已占用/已发货一目了然")
    print("  - 异常订单: 自动识别扣费订单")
    print("  - 财务摘要: 显示扣费总金额")
    print("="*60)
    
    return 0


if __name__ == "__main__":
    exit(main())
