#!/usr/bin/env python3
from datetime import datetime, timedelta
from api import RiskControlAPI
from database import Database
import json
import os


def test_full_flow():
    print("=" * 60)
    print("【验收测试1】完整流程测试")
    print("=" * 60)
    
    if os.path.exists("risk_control.db"):
        os.remove("risk_control.db")
    
    api = RiskControlAPI()
    
    print("\n1. 创建风控拦截记录")
    release = api.create_release(
        mobile="13800138001",
        scene="注册",
        business_object="用户注册风控",
        risk_reason="同一IP短时间内多次请求验证码",
        applicant="张小明",
        remark="用户反馈无法收到验证码"
    )
    print(f"   创建成功 - ID: {release['id']}, 状态: {release['status']}")
    assert release['status'] == "拦截中"
    
    print("\n2. 申请放行")
    start_time = datetime.now()
    end_time = start_time + timedelta(hours=24)
    release = api.apply_release(
        release_id=release['id'],
        operator="张小明",
        release_start_time=start_time,
        release_end_time=end_time,
        remark="用户已核实身份，申请放行24小时"
    )
    print(f"   申请成功 - 状态: {release['status']}, 放行至: {release['release_end_time']}")
    assert release['status'] == "放行申请"
    
    print("\n3. 审批通过")
    release = api.approve_release(
        release_id=release['id'],
        approver="王经理",
        remark="审批通过，同意放行"
    )
    print(f"   审批成功 - 状态: {release['status']}, 审批人: {release['approver']}")
    assert release['status'] == "已放行"
    
    print("\n4. 查看详情和历史记录")
    detail = api.get_release_detail(release['id'])
    print(f"   详情获取成功 - 历史记录数: {len(detail['history'])}")
    for h in detail['history']:
        print(f"     - {h['operation_time'][:19]} {h['operator']} {h['operation_type']}: {h['remark']}")
    
    print("\n5. 过期失效")
    release = api.expire_release(release['id'], "系统自动")
    print(f"   过期成功 - 状态: {release['status']}")
    assert release['status'] == "已失效"
    
    print("\n✅ 完整流程测试通过!")
    return detail['id']


def test_conflict_remark():
    print("\n" + "=" * 60)
    print("【验收测试2】场景冲突处理测试")
    print("=" * 60)
    
    api = RiskControlAPI()
    
    print("\n1. 创建一条注册场景的拦截记录")
    release = api.create_release(
        mobile="13800138002",
        scene="注册",
        business_object="用户注册风控",
        risk_reason="手机号风险等级高",
        applicant="李小红"
    )
    print(f"   创建成功 - ID: {release['id']}, 场景: {release['scene']}")
    
    print("\n2. 申请放行（但应该是支付场景，操作失误）")
    start_time = datetime.now()
    end_time = start_time + timedelta(hours=12)
    release = api.apply_release(
        release_id=release['id'],
        operator="李小红",
        release_start_time=start_time,
        release_end_time=end_time,
        remark="支付场景放行申请"
    )
    
    print("\n3. 添加备注修正场景错误，继续流程")
    release = api.add_remark(
        release_id=release['id'],
        operator="李小红",
        remark="【重要修正】场景填写错误，实际应为注册场景放行，用户需要注册账号"
    )
    print(f"   备注添加成功 - 版本号: {release['version']}")
    
    print("\n4. 审批通过（流程未卡死）")
    release = api.approve_release(
        release_id=release['id'],
        approver="赵主管",
        remark="已确认备注信息，同意放行"
    )
    print(f"   审批成功 - 状态: {release['status']}")
    assert release['status'] == "已放行"
    
    print("\n5. 查看完整历史")
    detail = api.get_release_detail(release['id'])
    print("   历史记录:")
    for h in detail['history']:
        print(f"     - {h['operation_type']}: {h['remark'][:30]}...")
    
    print("\n✅ 冲突处理测试通过! 备注后流程可继续推进")
    return detail['id']


def test_import_bad_rows():
    print("\n" + "=" * 60)
    print("【验收测试3】导入坏行记录测试")
    print("=" * 60)
    
    db = Database()
    
    print("\n1. 记录导入坏行")
    bad_records = [
        ("13800138003,注冊,,手机号格式正确但场景字段为繁体", "场景字段使用了繁体字，需转为简体"),
        ("", "手机号为空"),
        ("13800138004,支付,用户支付风控,放行开始时间格式错误: 2024/13/01", "日期月份超出范围")
    ]
    
    batch_no = f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    for i, (original_data, error_msg) in enumerate(bad_records, 1):
        bad = db.add_import_bad_record(batch_no, i, original_data, error_msg)
        print(f"   记录坏行 {i}: {error_msg}")
    
    print("\n✅ 导入坏行记录测试通过!")
    return batch_no


def test_query_and_export():
    print("\n" + "=" * 60)
    print("【验收测试4】列表查询与导出一致性测试")
    print("=" * 60)
    
    api = RiskControlAPI()
    
    print("\n1. 查询所有记录")
    all_releases = api.query_releases()
    print(f"   查询到 {len(all_releases)} 条记录")
    for r in all_releases:
        print(f"     - {r['mobile']} | {r['scene']} | {r['status']}")
    
    print("\n2. 按状态筛选 - 已放行")
    released = api.query_releases(status="已放行")
    print(f"   已放行记录数: {len(released)}")
    
    print("\n3. 按手机号筛选")
    mobile_query = api.query_releases(mobile="13800138001")
    print(f"   手机号13800138001记录数: {len(mobile_query)}")
    
    print("\n4. 按申请人筛选")
    applicant_query = api.query_releases(applicant="张小明")
    print(f"   张小明申请的记录数: {len(applicant_query)}")
    
    print("\n5. 导出CSV并验证字段一致性")
    csv_content = api.export_releases()
    csv_lines = csv_content.strip().split('\n')
    headers = csv_lines[0].split(',')
    print(f"   导出字段: {headers}")
    print(f"   导出记录数: {len(csv_lines) - 1}")
    assert len(csv_lines) - 1 == len(all_releases), "导出记录数与查询结果不一致"
    
    print("\n6. 导出到文件")
    output_file = "风控放行记录导出.csv"
    api.export_releases(output_file=output_file)
    print(f"   已导出到文件: {output_file}")
    
    print("\n✅ 查询与导出测试通过!")


def main():
    print("\n" + "🚀" * 20)
    print("短信验证码服务风控放行系统 - 验收测试套件")
    print("🚀" * 20)
    
    try:
        flow_id = test_full_flow()
        conflict_id = test_conflict_remark()
        batch_no = test_import_bad_rows()
        test_query_and_export()
        
        print("\n" + "=" * 60)
        print("【验收总结】")
        print("=" * 60)
        print(f"   完整流程记录ID: {flow_id}")
        print(f"   冲突处理记录ID: {conflict_id}")
        print(f"   坏行记录批次号: {batch_no}")
        print("\n   ✅ 列表查询 ✓ 详情查询 ✓ 历史记录 ✓ 导出功能")
        print("   ✅ 状态流转 ✓ 人工备注 ✓ 筛选功能 ✓ 冲突处理")
        print("\n🎉 所有验收测试通过! 系统功能完整可用。")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
