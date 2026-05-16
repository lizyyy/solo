#!/usr/bin/env python3
"""测试修复是否有效"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, ComparisonResult, Batch
from app import data_generator

# 使用内存数据库
engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def test_data_consistency():
    db = SessionLocal()
    batch_no = "TEST_BATCH_001"
    operator = "测试员"
    record_count = 10
    
    print(f"=== 开始测试: 生成 {record_count} 条记录 ===")
    
    # 初始化规则
    data_generator.init_default_rule(db, operator)
    
    # 生成预约记录
    reservations = data_generator.generate_bus_reservations(db, batch_no, operator, record_count)
    print(f"生成预约记录: {len(reservations)} 条")
    
    # 统计预约中的重复记录
    reservation_duplicates = sum(1 for r in reservations if r.is_duplicate)
    print(f"预约标记为重复提交: {reservation_duplicates} 条")
    
    # 生成比对结果
    results = data_generator.generate_comparison_results(db, batch_no, operator, reservations, "v1.0")
    print(f"生成比对结果: {len(results)} 条")
    
    # 统计异常
    is_abnormal_count = sum(1 for r in results if r.is_abnormal)
    print(f"比对结果 is_abnormal=true: {is_abnormal_count} 条")
    
    # 统计重复提交
    duplicate_count = sum(1 for r in results if r.risk_type == "重复提交")
    print(f"比对结果 风险类型=重复提交: {duplicate_count} 条")
    
    # 统计其他异常类型
    other_abnormal_count = sum(1 for r in results if r.is_abnormal and r.risk_type != "重复提交")
    print(f"比对结果 其他异常类型: {other_abnormal_count} 条")
    
    # 检查一致性
    print("\n=== 一致性检查 ===")
    inconsistencies = []
    for i, r in enumerate(results):
        # 1. is_abnormal=true 时，risk_type 不能是 "正常"
        if r.is_abnormal and r.risk_type == "正常":
            inconsistencies.append(f"记录 {i+1}: is_abnormal=true 但 risk_type='正常'")
        
        # 2. is_abnormal=false 时，risk_type 必须是 "正常"
        if not r.is_abnormal and r.risk_type != "正常":
            inconsistencies.append(f"记录 {i+1}: is_abnormal=false 但 risk_type='{r.risk_type}'")
        
        # 3. risk_type="重复提交" 时，is_abnormal 必须是 true
        if r.risk_type == "重复提交" and not r.is_abnormal:
            inconsistencies.append(f"记录 {i+1}: risk_type='重复提交' 但 is_abnormal=false")
    
    if inconsistencies:
        print("发现不一致:")
        for inc in inconsistencies:
            print(f"  ❌ {inc}")
    else:
        print("  ✅ 所有记录 is_abnormal 与 risk_type 一致")
    
    # 检查重复提交数量是否准确
    if reservation_duplicates == 1:
        print(f"  ✅ 重复提交记录数量正确: {reservation_duplicates} 条（符合'其中一条暴露重复提交'）")
    else:
        print(f"  ❌ 重复提交记录数量不正确: 期望 1 条，实际 {reservation_duplicates} 条")
    
    # 输出各风险类型统计
    print("\n=== 风险类型统计 ===")
    risk_stats = {}
    for r in results:
        risk_stats[r.risk_type] = risk_stats.get(r.risk_type, 0) + 1
    
    for risk_type, count in sorted(risk_stats.items()):
        print(f"  {risk_type}: {count} 条")
    
    # 输出批次摘要
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if batch:
        print(f"\n=== 批次摘要 ===")
        print(f"  {batch.summary}")
        if f"其中重复提交{duplicate_count}条" in batch.summary:
            print("  ✅ 批次摘要中重复提交数量统计正确")
        else:
            print("  ❌ 批次摘要中重复提交数量统计可能不正确")
    
    # 测试按风险类型查询
    print("\n=== 按风险类型查询测试 ===")
    query_duplicate = db.query(ComparisonResult).filter(
        ComparisonResult.batch_no == batch_no,
        ComparisonResult.risk_type == "重复提交"
    ).all()
    
    all_abnormal = [r for r in query_duplicate if r.is_abnormal]
    if len(query_duplicate) == len(all_abnormal):
        print(f"  ✅ 查询'重复提交'返回 {len(query_duplicate)} 条，全部 is_abnormal=true")
    else:
        print(f"  ❌ 查询'重复提交'结果包含 is_abnormal=false 的记录")
    
    db.close()
    
    print("\n=== 测试完成 ===")
    return len(inconsistencies) == 0 and reservation_duplicates == 1


if __name__ == "__main__":
    success = test_data_consistency()
    sys.exit(0 if success else 1)
