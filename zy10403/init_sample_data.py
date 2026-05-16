#!/usr/bin/env python3
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import engine, Base
from models import Lease, LeaseStatus
from schemas import LeaseCreate
from services import create_lease


def init_sample_data():
    Base.metadata.create_all(bind=engine)
    db = Session(bind=engine)

    try:
        sample_leases = [
            LeaseCreate(
                branch_name="feature/user-auth",
                env_id="preview-01",
                assignee="zhang.san",
                lease_start=datetime.now() - timedelta(days=3),
                lease_end=datetime.now() + timedelta(days=1),
                renew_reason="用户认证功能联调",
                request_id="req-001"
            ),
            LeaseCreate(
                branch_name="feature/payment",
                env_id="preview-02",
                assignee="li.si",
                lease_start=datetime.now() - timedelta(days=2),
                lease_end=datetime.now() + timedelta(days=3),
                renew_reason="支付模块测试",
                request_id="req-002"
            ),
            LeaseCreate(
                branch_name="feature/search",
                env_id="preview-03",
                assignee="wang.wu",
                lease_start=datetime.now() - timedelta(days=10),
                lease_end=datetime.now() - timedelta(days=5),
                renew_reason="搜索功能优化",
                request_id="req-003"
            ),
            LeaseCreate(
                branch_name="hotfix/security-patch",
                env_id="preview-01",
                assignee="zhao.liu",
                lease_start=datetime.now() + timedelta(days=2),
                lease_end=datetime.now() + timedelta(days=5),
                renew_reason="安全补丁测试",
                request_id="req-004"
            ),
            LeaseCreate(
                branch_name="feature/report",
                env_id="preview-04",
                assignee="zhang.san",
                lease_start=datetime.now() - timedelta(days=1),
                lease_end=datetime.now() + timedelta(days=7),
                renew_reason="报表模块开发",
                request_id="req-005"
            ),
        ]

        for lease_data in sample_leases:
            try:
                result = create_lease(db, lease_data)
                print(f"{'[幂等] ' if result['is_idempotent'] else ''}创建租约: {result['lease'].branch_name} -> {result['lease'].env_id}")
            except ValueError as e:
                print(f"跳过: {e}")

        print("\n✅ 样例数据初始化完成！")
        print(f"   已创建 {db.query(Lease).count()} 个租约记录")

    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()
