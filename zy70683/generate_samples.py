#!/usr/bin/env python3
import os
import shutil
from datetime import datetime, timedelta

from service import MealVoucherService


def generate_normal_samples(service: MealVoucherService):
    print("=== 生成正常样例数据 ===")
    v1 = service.add_visitor("张三", "13800138001", "华为技术有限公司", datetime(2026, 5, 20))
    v2 = service.add_visitor("李四", "13800138002", "阿里巴巴集团", datetime(2026, 5, 21))
    v3 = service.add_visitor("王五", "13800138003", "腾讯科技", datetime(2026, 5, 22))
    print(f"  添加访客: {v1.visitor_id}, {v2.visitor_id}, {v3.visitor_id}")
    m1 = service.add_meeting(
        "AI技术分享会",
        "赵主任",
        datetime(2026, 5, 20, 9, 0),
        datetime(2026, 5, 20, 12, 0)
    )
    m2 = service.add_meeting(
        "战略合作洽谈会",
        "钱总",
        datetime(2026, 5, 21, 14, 0),
        datetime(2026, 5, 21, 18, 0)
    )
    m3 = service.add_meeting(
        "项目启动会",
        "孙经理",
        datetime(2026, 5, 22, 10, 0),
        datetime(2026, 5, 22, 12, 0)
    )
    print(f"  添加会议: {m1.meeting_id}, {m2.meeting_id}, {m3.meeting_id}")
    vc1 = service.issue_voucher(
        v1.visitor_id, m1.meeting_id,
        datetime(2026, 5, 20, 11, 30),
        datetime(2026, 5, 20, 14, 0)
    )
    vc2 = service.issue_voucher(
        v2.visitor_id, m2.meeting_id,
        datetime(2026, 5, 21, 12, 0),
        datetime(2026, 5, 21, 14, 0)
    )
    vc3 = service.issue_voucher(
        v3.visitor_id, m3.meeting_id,
        datetime(2026, 5, 22, 11, 30),
        datetime(2026, 5, 22, 14, 0)
    )
    print(f"  发放餐券: {vc1.voucher_code}, {vc2.voucher_code}, {vc3.voucher_code}")
    service.use_voucher(vc1.voucher_code, "一楼员工餐厅")
    print(f"  使用餐券: {vc1.voucher_code}")
    service.cancel_meeting(m2.meeting_id, "参会人员时间冲突，改期到下周")
    print(f"  取消会议: {m2.meeting_id}")
    print("正常样例数据生成完成\n")


def generate_dirty_data_samples(service: MealVoucherService):
    print("=== 生成脏数据样例 ===")
    v = service.add_visitor("测试访客", "invalid-phone", "", datetime(2026, 5, 25))
    print(f"  添加脏数据访客: {v.visitor_id}")
    m = service.add_meeting(
        "",
        "",
        datetime(2026, 5, 25, 9, 0),
        datetime(2026, 5, 24, 9, 0)
    )
    print(f"  添加异常时间会议: {m.meeting_id}")
    service.issue_voucher("INVALID_VISITOR", m.meeting_id, datetime.now(), datetime.now() + timedelta(hours=3))
    service.issue_voucher(v.visitor_id, "INVALID_MEETING", datetime.now(), datetime.now() + timedelta(hours=3))
    print("  尝试发放无效关联餐券")
    print("脏数据样例生成完成\n")


def generate_boundary_conflict_samples(service: MealVoucherService):
    print("=== 生成边界冲突样例 ===")
    v = service.add_visitor("冲突测试访客", "13900139001", "冲突测试公司", datetime(2026, 5, 26))
    m = service.add_meeting(
        "冲突测试会议",
        "测试主持",
        datetime(2026, 5, 26, 9, 0),
        datetime(2026, 5, 26, 12, 0)
    )
    vc = service.issue_voucher(
        v.visitor_id, m.meeting_id,
        datetime.now() - timedelta(hours=1),
        datetime.now() + timedelta(hours=3)
    )
    service.use_voucher(vc.voucher_code, "测试餐厅")
    print(f"  先使用餐券: {vc.voucher_code}")
    service.cancel_meeting(m.meeting_id, "会议临时取消")
    print(f"  后取消会议，产生冲突: {m.meeting_id}")
    service.verify_voucher(vc.voucher_code, "行政测试员")
    print("  执行核销检查，标记为冲突状态")
    print("边界冲突样例生成完成\n")


def generate_empty_samples(service: MealVoucherService):
    print("=== 空结果样例说明 ===")
    print("  1. 查询不存在的餐券码返回空结果")
    print("  2. 查询不存在的会议ID返回空结果")
    print("  3. 查询无核销历史的餐券返回空列表")
    print("  4. 新安装系统无任何数据时返回空报告")
    print("空结果样例说明完成\n")


def generate_acceptance_samples(service: MealVoucherService):
    print("=== 生成验收样例 ===")
    v_normal = service.add_visitor("验收正常访客", "13888888888", "验收公司", datetime(2026, 5, 27))
    m_normal = service.add_meeting(
        "验收正常会议",
        "验收主持人",
        datetime(2026, 5, 27, 9, 0),
        datetime(2026, 5, 27, 12, 0)
    )
    vc_normal = service.issue_voucher(
        v_normal.visitor_id, m_normal.meeting_id,
        datetime(2026, 5, 27, 11, 30),
        datetime(2026, 5, 27, 14, 0)
    )
    service.verify_voucher(vc_normal.voucher_code, "验收员")
    print(f"  正常样例餐券: {vc_normal.voucher_code} - 会议正常，无需核销")
    v_abnormal = service.add_visitor("验收异常访客", "13999999999", "异常公司", datetime(2026, 5, 28))
    m_abnormal = service.add_meeting(
        "验收异常会议",
        "异常主持人",
        datetime(2026, 5, 28, 9, 0),
        datetime(2026, 5, 28, 12, 0)
    )
    vc_abnormal = service.issue_voucher(
        v_abnormal.visitor_id, m_abnormal.meeting_id,
        datetime(2026, 5, 28, 11, 30),
        datetime(2026, 5, 28, 14, 0)
    )
    service.cancel_meeting(m_abnormal.meeting_id, "验收测试：会议临时取消", auto_cancel_vouchers=False)
    service.verify_voucher(vc_abnormal.voucher_code, "验收员")
    print(f"  异常样例餐券: {vc_abnormal.voucher_code} - 会议已取消，待核销")
    print("验收样例生成完成\n")


def main():
    data_dir = "data"
    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
        print(f"已清除旧数据目录: {data_dir}")
    service = MealVoucherService(data_dir)
    generate_normal_samples(service)
    generate_dirty_data_samples(service)
    generate_boundary_conflict_samples(service)
    generate_empty_samples(service)
    generate_acceptance_samples(service)
    print("=== 所有样例数据生成完毕 ===")
    print(f"数据保存在: {os.path.abspath(data_dir)}")
    print("\n接下来可以运行:")
    print("  python cli.py report --format human  # 查看人读格式报告")
    print("  python cli.py report --format json    # 查看机器可读格式报告")
    print("  python cli.py history                  # 查看所有核销历史")


if __name__ == '__main__':
    main()
