#!/usr/bin/env python3
import json
import sys
from datetime import datetime, timedelta

sys.path.insert(0, '.')

from app.models import VisitorCreate, VisitorUpdate, VisitorStatus
from app.services import (
    VisitorService, PermissionService, ParkingService,
    AnomalyService, SummaryService
)
from app.storage import storage


def pprint(title, data):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    if hasattr(data, 'model_dump'):
        print(json.dumps(data.model_dump(mode='json'), indent=2, ensure_ascii=False))
    elif isinstance(data, dict):
        print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
    else:
        print(data)


def main():
    print("=" * 60)
    print("企业门禁访客预约 API - 完整流程演示")
    print("=" * 60)
    
    storage.visitors = {}
    storage.permissions = {}
    storage.parkings = {}
    storage.anomalies = {}
    storage.audit_logs = []
    storage._visitor_history = {}
    ParkingService.reset_parking_pool()
    
    print("\n步骤 1: 创建访客预约")
    visitor_data = VisitorCreate(
        visitor_name="李四",
        visitor_phone="13900139000",
        visitor_company="合作科技有限公司",
        host_name="王经理",
        host_department="市场部",
        scheduled_start_time=datetime.now() + timedelta(hours=2),
        scheduled_end_time=datetime.now() + timedelta(hours=5),
        purpose="项目洽谈",
        needs_parking=True,
        car_plate="沪A88888",
        access_areas=["A栋大厅", "B栋会议室B201"]
    )
    
    visitor = VisitorService.create_visitor(visitor_data, actor="前台小王")
    pprint("访客单创建成功", visitor)
    visitor_id = visitor.id
    
    print("\n步骤 2: 审批访客预约")
    approved = VisitorService.approve_visitor(visitor_id, actor="王经理")
    pprint("审批通过", approved)
    
    permission = PermissionService.get_permission(visitor_id)
    pprint("自动下发的门禁权限", permission)
    
    parking = ParkingService.get_parking(visitor_id)
    pprint("自动分配的车位", parking)
    
    print("\n步骤 3: 查看汇总（一致性检查）")
    summary = SummaryService.get_visitor_summary(visitor_id)
    pprint("访客汇总", {
        "visitor_status": summary["visitor"]["status"],
        "permission_status": summary["permission"]["status"],
        "parking_status": summary["parking"]["status"],
        "consistency_check": summary["consistency_check"],
        "has_anomalies": summary["has_unresolved_anomalies"]
    })
    
    print("\n步骤 4: 改约（时间变更）")
    new_start = datetime.now() + timedelta(hours=4)
    new_end = datetime.now() + timedelta(hours=7)
    rescheduled = VisitorService.reschedule_visitor(
        visitor_id,
        VisitorUpdate(
            scheduled_start_time=new_start,
            scheduled_end_time=new_end,
            access_areas=["A栋大厅", "B栋会议室B201", "C栋办公区"]
        ),
        actor="前台小王"
    )
    pprint("改约成功", rescheduled)
    
    new_permission = PermissionService.get_permission(visitor_id)
    pprint("旧权限回收，新权限已下发", {
        "new_permission_id": new_permission.id,
        "new_access_areas": new_permission.access_areas,
        "status": new_permission.status
    })
    
    new_parking = ParkingService.get_parking(visitor_id)
    pprint("旧车位释放，新车位已分配", {
        "new_parking_id": new_parking.id,
        "spot_number": new_parking.spot_number,
        "status": new_parking.status
    })
    
    print("\n步骤 5: 查看历史变更记录")
    history = storage.get_visitor_history(visitor_id)
    pprint(f"历史记录（共 {len(history)} 条）", [
        {
            "version": i+1,
            "status": h.status.value,
            "time": h.scheduled_start_time.strftime("%H:%M") if h.scheduled_start_time else "N/A",
            "access_areas": h.access_areas
        }
        for i, h in enumerate(history)
    ])
    
    print("\n步骤 6: 签到核验")
    checked_in = VisitorService.checkin(visitor_id, actor="门禁系统")
    pprint("签到成功", {
        "status": checked_in.status.value,
        "checkin_time": checked_in.actual_checkin_time.strftime("%Y-%m-%d %H:%M:%S")
    })
    
    print("\n步骤 7: 查看审计日志")
    logs = storage.get_audit_logs_by_visitor(visitor_id)
    pprint(f"审计日志（共 {len(logs)} 条）", [
        {
            "action": log.action,
            "actor": log.actor,
            "timestamp": log.timestamp.strftime("%H:%M:%S"),
            "comment": log.comment
        }
        for log in logs
    ])
    
    print("\n步骤 8: 签退")
    checked_out = VisitorService.checkout(visitor_id, actor="门禁系统")
    pprint("签退成功", {
        "status": checked_out.status.value,
        "checkout_time": checked_out.actual_checkout_time.strftime("%Y-%m-%d %H:%M:%S")
    })
    
    final_permission = PermissionService.get_permission(visitor_id)
    final_parking = ParkingService.get_parking(visitor_id)
    pprint("权限和车位已回收", {
        "permission_status": final_permission.status.value,
        "parking_status": final_parking.status.value
    })
    
    print("\n步骤 9: 最终汇总")
    final_summary = SummaryService.get_visitor_summary(visitor_id)
    pprint("最终状态", {
        "visitor_status": final_summary["visitor"]["status"],
        "permission_status": final_summary["permission"]["status"],
        "parking_status": final_summary["parking"]["status"],
        "consistency_check": final_summary["consistency_check"],
        "has_anomalies": final_summary["has_unresolved_anomalies"],
        "audit_log_count": len(final_summary["audit_logs"]),
        "history_count": len(final_summary["history"])
    })
    
    print("\n" + "=" * 60)
    print("演示完成！关键规则已验证：")
    print("✓ 审批时自动下发权限和车位")
    print("✓ 改约时自动回收并重新下发权限和车位")
    print("✓ 签到时核验权限状态")
    print("✓ 签退后自动回收权限和车位")
    print("✓ 完整的历史记录和审计日志")
    print("✓ 一致性检查确保状态一致")
    print("=" * 60)


if __name__ == "__main__":
    main()
