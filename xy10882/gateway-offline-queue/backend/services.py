from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
import uuid
import models
import schemas


class QueueService:
    def __init__(self, db: Session):
        self.db = db

    def create_command(self, command_data=None, **kwargs) -> models.ControlCommand:
        if command_data is None:
            command_data = schemas.ControlCommandCreate(
                device_id=kwargs.get('device_id'),
                command_type=kwargs.get('command_type'),
                payload=kwargs.get('payload', '{}'),
                priority=kwargs.get('priority', 0),
                expire_hours=kwargs.get('expire_hours', 24)
            )
        device = self.db.query(models.GatewayDevice).filter(
            models.GatewayDevice.id == command_data.device_id
        ).first()
        
        if not device:
            raise ValueError("Device not found")

        expire_at = datetime.utcnow() + timedelta(hours=command_data.expire_hours)
        
        command_id = f"CMD-{uuid.uuid4().hex[:8].upper()}"
        
        sequence = 0
        if device.status == "offline" and device.offline_window_id:
            max_seq = self.db.query(models.ControlCommand).filter(
                models.ControlCommand.offline_window_id == device.offline_window_id
            ).count()
            sequence = max_seq + 1
        
        command = models.ControlCommand(
            command_id=command_id,
            device_id=command_data.device_id,
            offline_window_id=device.offline_window_id if device.status == "offline" else None,
            command_type=command_data.command_type,
            payload=command_data.payload,
            priority=command_data.priority,
            sequence=sequence,
            status="queued" if device.status == "offline" else "pending",
            expire_at=expire_at
        )
        
        self.db.add(command)
        self.db.flush()
        
        self._add_history(command.id, None, command.status, 
                         "Command created, added to offline queue" if device.status == "offline" else "Command created")
        
        if device.status == "offline" and device.offline_window_id:
            window = self.db.query(models.OfflineWindow).filter(
                models.OfflineWindow.id == device.offline_window_id
            ).first()
            if window:
                window.command_count += 1
        
        self.db.commit()
        self.db.refresh(command)
        return command

    def update_device_status(self, device_id: int, status: str) -> models.GatewayDevice:
        device = self.db.query(models.GatewayDevice).filter(
            models.GatewayDevice.id == device_id
        ).first()
        
        if not device:
            raise ValueError("Device not found")
        
        old_status = device.status
        device.status = status
        device.last_heartbeat = datetime.utcnow()
        
        if status == "offline" and old_status == "online":
            window = models.OfflineWindow(
                device_id=device.id,
                is_active=True
            )
            self.db.add(window)
            self.db.flush()
            device.offline_window_id = window.id
            
        elif status == "online" and old_status == "offline":
            if device.offline_window_id:
                window = self.db.query(models.OfflineWindow).filter(
                    models.OfflineWindow.id == device.offline_window_id
                ).first()
                if window:
                    window.is_active = False
                    window.end_time = datetime.utcnow()
                device.offline_window_id = None
                
                self._trigger_recovery(device.id)
        
        self.db.commit()
        self.db.refresh(device)
        return device

    def _trigger_recovery(self, device_id: int):
        expired_commands = self.db.query(models.ControlCommand).filter(
            and_(
                models.ControlCommand.device_id == device_id,
                models.ControlCommand.status == "queued",
                models.ControlCommand.expire_at < datetime.utcnow()
            )
        ).all()
        
        for cmd in expired_commands:
            self._update_command_status(cmd, "expired", "Recovery: Command expired during offline")
        
        pending_commands = self.db.query(models.ControlCommand).filter(
            and_(
                models.ControlCommand.device_id == device_id,
                models.ControlCommand.status == "queued",
                models.ControlCommand.expire_at > datetime.utcnow()
            )
        ).order_by(
            models.ControlCommand.sequence.asc(),
            models.ControlCommand.created_at.asc()
        ).all()
        
        for cmd in pending_commands:
            self._update_command_status(cmd, "dispatching", "Recovery: Dispatching queued command")
    
    def _update_command_status(self, command: models.ControlCommand, new_status: str, description: str = None):
        old_status = command.status
        command.status = new_status
        
        if new_status == "executed":
            command.executed_at = datetime.utcnow()
        
        self._add_history(command.id, old_status, new_status, description)
        self.db.commit()

    def _add_history(self, command_id: int, old_status: str, new_status: str, description: str = None):
        history = models.CommandHistory(
            command_id=command_id,
            old_status=old_status,
            new_status=new_status,
            description=description
        )
        self.db.add(history)

    def process_command_execution(self, command_id: int, success: bool, error_msg: str = None) -> models.ControlCommand:
        command = self.db.query(models.ControlCommand).filter(
            models.ControlCommand.id == command_id
        ).first()
        
        if not command:
            raise ValueError("Command not found")
        
        if success:
            self._update_command_status(command, "executed", "Command executed successfully")
        else:
            command.error_message = error_msg
            self._update_command_status(command, "failed", f"Command failed: {error_msg}")
        
        self.db.refresh(command)
        return command

    def submit_receipt(self, receipt_data: schemas.ReceiptRecordCreate) -> models.ReceiptRecord:
        receipt = models.ReceiptRecord(
            command_id=receipt_data.command_id,
            device_id=receipt_data.device_id,
            receipt_code=receipt_data.receipt_code,
            receipt_data=receipt_data.receipt_data,
            is_success=receipt_data.is_success
        )
        self.db.add(receipt)
        self.db.commit()
        self.db.refresh(receipt)
        
        if receipt_data.is_success:
            command = self.db.query(models.ControlCommand).filter(
                models.ControlCommand.id == receipt_data.command_id
            ).first()
            if command:
                self._update_command_status(command, "confirmed", "Receipt confirmed")
        
        return receipt

    def cleanup_expired_commands(self):
        expired = self.db.query(models.ControlCommand).filter(
            and_(
                models.ControlCommand.expire_at < datetime.utcnow(),
                models.ControlCommand.status.in_(["pending", "queued", "dispatching"])
            )
        ).all()
        
        for cmd in expired:
            self._update_command_status(cmd, "expired", "Command expired, discarded")
        
        return len(expired)

    def get_abnormal_commands(self):
        return self.db.query(models.ControlCommand).filter(
            or_(
                models.ControlCommand.status == "failed",
                models.ControlCommand.status == "expired",
                and_(
                    models.ControlCommand.status == "queued",
                    models.ControlCommand.expire_at < datetime.utcnow()
                ),
                and_(
                    models.ControlCommand.status == "dispatching",
                    models.ControlCommand.executed_at < (datetime.utcnow() - timedelta(minutes=30))
                )
            )
        ).order_by(models.ControlCommand.created_at.desc()).all()

    def retry_command(self, command_id: int) -> models.ControlCommand:
        command = self.db.query(models.ControlCommand).filter(
            models.ControlCommand.id == command_id
        ).first()
        
        if not command:
            raise ValueError("Command not found")
        
        command.error_message = None
        self._update_command_status(command, "pending", "Manual retry initiated")
        
        self.db.refresh(command)
        return command

    def discard_command(self, command_id: int) -> models.ControlCommand:
        command = self.db.query(models.ControlCommand).filter(
            models.ControlCommand.id == command_id
        ).first()
        
        if not command:
            raise ValueError("Command not found")
        
        self._update_command_status(command, "discarded", "Manual discard")
        
        self.db.refresh(command)
        return command
