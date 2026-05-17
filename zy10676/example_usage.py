#!/usr/bin/env python3
from datetime import datetime, timedelta
from api import RiskControlAPI


def main():
    api = RiskControlAPI()
    
    print("=== 短信验证码风控放行系统 - 使用示例 ===\n")
    
    # 1. 创建拦截记录
    print("1. 创建风控拦截记录")
    result = api.create_release(
        mobile="13900139001",
        scene="登录",
        business_object="用户登录风控",
        risk_reason="异地登录风险",
        applicant="运维人员",
        remark="用户出差在外需要登录"
    )
    print(f"   记录ID: {result['id']}")
    print(f"   当前状态: {result['status']}\n")
    
    # 2. 查询列表
    print("2. 查询拦截中记录")
    blocking = api.query_releases(status="拦截中")
    print(f"   共 {len(blocking)} 条记录\n")
    
    # 3. 申请放行
    print("3. 申请放行")
    result = api.apply_release(
        release_id=result['id'],
        operator="运维人员",
        release_start_time=datetime.now(),
        release_end_time=datetime.now() + timedelta(hours=8),
        remark="申请工作时段放行8小时"
    )
    print(f"   新状态: {result['status']}")
    print(f"   放行截止: {result['release_end_time']}\n")
    
    # 4. 审批通过
    print("4. 审批通过")
    result = api.approve_release(
        release_id=result['id'],
        approver="安全主管",
        remark="情况属实，同意放行"
    )
    print(f"   审批人: {result['approver']}")
    print(f"   最终状态: {result['status']}\n")
    
    # 5. 查看详情
    print("5. 查看完整详情")
    detail = api.get_release_detail(result['id'])
    print(f"   手机号: {detail['mobile']}")
    print(f"   场景: {detail['scene']}")
    print(f"   风控原因: {detail['risk_reason']}")
    print(f"   操作历史: {len(detail['history'])} 条\n")
    
    # 6. 导出CSV
    print("6. 导出CSV文件")
    api.export_releases(output_file="今日放行记录.csv")
    print("   导出完成: 今日放行记录.csv\n")
    
    print("=== 示例执行完成 ===")


if __name__ == "__main__":
    main()
