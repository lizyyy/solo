from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json

from database import SessionLocal, engine
import models
from services import QueueService

models.Base.metadata.create_all(bind=engine)


def init_demo_data():
    db = SessionLocal()
    service = QueueService(db)
    
    try:
        devices_data = [
            {"device_id": "GW-STORE-001", "name": "北京门店A网关"},
            {"device_id": "GW-STORE-002", "name": "上海门店B网关"},
            {"device_id": "GW-STORE-003", "name": "广州门店C网关"},
            {"device_id": "GW-STORE-004", "name": "深圳门店D网关"},
        ]
        
        devices = []
        for d in devices_data:
            existing = db.query(models.GatewayDevice).filter(
                models.GatewayDevice.device_id == d["device_id"]
            ).first()
            if not existing:
                device = models.GatewayDevice(**d)
                db.add(device)
                db.flush()
                devices.append(device)
            else:
                devices.append(existing)
        
        db.commit()
        for d in devices:
            db.refresh(d)
        
        service.update_device_status(devices[1].id, "offline")
        service.update_device_status(devices[3].id, "offline")
        
        db.commit()
        devices = db.query(models.GatewayDevice).all()
        
        commands_demo = [
            {"device_idx": 0, "type": "REFRESH_CONFIG", "payload": json.dumps({"interval": 300}), "priority": 2},
            {"device_idx": 0, "type": "REBOOT", "payload": json.dumps({"delay": 10}), "priority": 1},
            {"device_idx": 1, "type": "UPDATE_FIRMWARE", "payload": json.dumps({"version": "v2.1.0"}), "priority": 3},
            {"device_idx": 1, "type": "SET_THRESHOLD", "payload": json.dumps({"temp": 25, "humidity": 60}), "priority": 1},
            {"device_idx": 1, "type": "SYNC_TIME", "payload": json.dumps({"ntp": "pool.ntp.org"}), "priority": 0},
            {"device_idx": 2, "type": "REFRESH_CONFIG", "payload": json.dumps({"interval": 600}), "priority": 2},
            {"device_idx": 3, "type": "BACKUP_DATA", "payload": json.dumps({"target": "cloud"}), "priority": 1},
            {"device_idx": 3, "type": "CLEAR_CACHE", "payload": json.dumps({"type": "all"}), "priority": 0},
        ]
        
        for cmd_data in commands_demo:
            device = devices[cmd_data["device_idx"]]
            try:
                service.create_command(
                    device_id=device.id,
                    command_type=cmd_data["type"],
                    payload=cmd_data["payload"],
                    priority=cmd_data["priority"],
                    expire_hours=48
                )
            except:
                pass
        
        queued_cmds = db.query(models.ControlCommand).filter(
            models.ControlCommand.status == "queued"
        ).all()
        
        for i, cmd in enumerate(queued_cmds[:2]):
            service.process_command_execution(cmd.id, False, f"模拟执行失败: 网络超时 {i}")
        
        for cmd in queued_cmds[2:3]:
            cmd.expire_at = datetime.utcnow() - timedelta(hours=1)
            db.commit()
        
        service.cleanup_expired_commands()
        
        for cmd in db.query(models.ControlCommand).filter(
            models.ControlCommand.status == "pending"
        ).limit(2).all():
            service.process_command_execution(cmd.id, True)
            service.submit_receipt(
                command_id=cmd.id,
                device_id=cmd.device_id,
                receipt_code=f"RCV-{cmd.command_id}",
                receipt_data=json.dumps({"status": "ok", "timestamp": datetime.now().isoformat()})
            )
        
        print("演示数据初始化完成！")
        print(f"设备数量: {len(devices)}")
        print(f"指令总数: {db.query(models.ControlCommand).count()}")
        
    finally:
        db.close()


if __name__ == "__main__":
    init_demo_data()
