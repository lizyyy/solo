from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json

from database import SessionLocal, engine
import models
from services import QueueService

models.Base.metadata.create_all(bind=engine)


def test_recovery_order_and_expiry():
    print("=" * 60)
    print("测试: 恢复下发顺序 & 过期丢弃链路验证")
    print("=" * 60)
    
    db = SessionLocal()
    service = QueueService(db)
    
    try:
        device = db.query(models.GatewayDevice).filter(
            models.GatewayDevice.device_id == "GW-TEST-001"
        ).first()
        if not device:
            device = models.GatewayDevice(
                device_id="GW-TEST-001",
                name="测试网关A"
            )
            db.add(device)
            db.commit()
            db.refresh(device)
        
        print(f"\n1. 将设备设为离线状态...")
        service.update_device_status(device.id, "offline")
        device = db.query(models.GatewayDevice).get(device.id)
        print(f"   设备状态: {device.status}, 离线窗口ID: {device.offline_window_id}")
        
        print(f"\n2. 创建离线指令 (按不同优先级, 期望 sequence 按创建顺序递增)...")
        commands_info = [
            ("SEQ-01-LOW_PRIO", 0, 48, "低优先级,应该先执行"),
            ("SEQ-02-HIGH_PRIO", 5, 48, "高优先级,但sequence=2,应该后执行"),
            ("SEQ-03-NORMAL", 2, 48, "普通优先级,sequence=3"),
            ("SEQ-04-EXPIRING", 0, 1, "短过期时间"),
        ]
        
        created_commands = []
        for cmd_type, priority, expire_hours, desc in commands_info:
            cmd = service.create_command(
                device_id=device.id,
                command_type=cmd_type,
                payload=json.dumps({"desc": desc}),
                priority=priority,
                expire_hours=expire_hours
            )
            created_commands.append(cmd)
            print(f"   创建: {cmd.command_id}, 类型: {cmd_type}, 优先级: {priority}, sequence: {cmd.sequence}")
        
        print(f"\n3. 手动设置一个指令为已过期状态 (用于测试)...")
        import time
        last_cmd = created_commands[-1]
        last_cmd.expire_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
        
        print(f"\n4. 查询异常队列 (应包含已过期但仍queued的指令)...")
        abnormal = service.get_abnormal_commands()
        print(f"   异常指令数: {len(abnormal)}")
        for cmd in abnormal:
            print(f"   - {cmd.command_id}: {cmd.status}, expire_at={cmd.expire_at}")
        
        expiring_in_abnormal = any(
            cmd.command_type == "SEQ-04-EXPIRING" for cmd in abnormal
        )
        print(f"   过期指令是否在异常队列: {'✅ 是' if expiring_in_abnormal else '❌ 否'}")
        
        print(f"\n5. 将设备恢复在线 (触发恢复下发)...")
        service.update_device_status(device.id, "online")
        
        print(f"\n6. 验证恢复下发顺序 (应按 sequence 严格递增)...")
        history = db.query(models.CommandHistory).filter(
            models.CommandHistory.description.like("Recovery:%")
        ).order_by(models.CommandHistory.timestamp.asc()).all()
        
        print(f"   状态变更记录:")
        last_sequence = 0
        order_correct = True
        for h in history:
            cmd = db.query(models.ControlCommand).get(h.command_id)
            if cmd and "Dispatching" in h.description:
                print(f"   - {cmd.command_id}: sequence={cmd.sequence}, 优先级={cmd.priority}")
                if cmd.sequence <= last_sequence and last_sequence > 0:
                    order_correct = False
                last_sequence = cmd.sequence
        
        print(f"   下发顺序是否正确: {'✅ 是 (按 sequence 递增)' if order_correct else '❌ 否 (顺序混乱)'}")
        
        print(f"\n7. 验证过期指令是否被标记为 expired...")
        expired_cmd = db.query(models.ControlCommand).filter(
            models.ControlCommand.command_type == "SEQ-04-EXPIRING"
        ).first()
        if expired_cmd:
            print(f"   {expired_cmd.command_id}: status={expired_cmd.status}")
            exp_marked = expired_cmd.status == "expired"
            print(f"   过期指令是否被标记: {'✅ 是' if exp_marked else '❌ 否'}")
        
        print(f"\n" + "=" * 60)
        print("测试完成!")
        print("=" * 60)
        
    finally:
        db.close()


if __name__ == "__main__":
    test_recovery_order_and_expiry()
