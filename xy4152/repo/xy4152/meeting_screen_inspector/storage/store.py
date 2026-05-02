import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field

from meeting_screen_inspector.models.models import (
    DeviceStatus,
    InspectionSession,
    DeviceInspection,
    Risk,
)


class SessionMetadata(BaseModel):
    session_id: str
    name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    total_devices: int = 0
    devices_with_risks: int = 0
    total_risks: int = 0
    confirmed: bool = False
    notes: str = ""


class StorageManager:
    DEFAULT_STORAGE_DIR = "~/.msi_inspector"
    SESSIONS_SUBDIR = "sessions"
    METADATA_FILE = "metadata.json"
    SESSION_DATA_FILE = "session.json"

    def __init__(self, storage_dir: Optional[Path] = None):
        if storage_dir is None:
            storage_dir = Path(self.DEFAULT_STORAGE_DIR).expanduser()
        self.storage_dir = storage_dir
        self.sessions_dir = storage_dir / self.SESSIONS_SUBDIR
        self._ensure_directories()

    def _ensure_directories(self):
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def create_session(self, name: Optional[str] = None) -> str:
        session_id = str(uuid.uuid4())[:8]
        session_dir = self.sessions_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        
        now = datetime.now()
        metadata = SessionMetadata(
            session_id=session_id,
            name=name or f"巡检_{now.strftime('%Y%m%d_%H%M%S')}",
            created_at=now,
            updated_at=now,
        )
        
        metadata_file = session_dir / self.METADATA_FILE
        metadata_file.write_text(
            metadata.model_dump_json(indent=2, default=str),
            encoding='utf-8'
        )
        
        return session_id

    def save_session(self, session: InspectionSession) -> Path:
        session_dir = self.sessions_dir / session.session_id
        
        if not session_dir.exists():
            session_dir.mkdir(parents=True, exist_ok=True)
        
        session_data = self._session_to_dict(session)
        session_file = session_dir / self.SESSION_DATA_FILE
        session_file.write_text(
            json.dumps(session_data, indent=2, ensure_ascii=False, default=str),
            encoding='utf-8'
        )
        
        metadata = self._build_metadata(session)
        metadata_file = session_dir / self.METADATA_FILE
        metadata_file.write_text(
            metadata.model_dump_json(indent=2, default=str),
            encoding='utf-8'
        )
        
        return session_file

    def load_session(self, session_id: str) -> Optional[InspectionSession]:
        session_dir = self.sessions_dir / session_id
        session_file = session_dir / self.SESSION_DATA_FILE
        
        if not session_file.exists():
            return None
        
        content = session_file.read_text(encoding='utf-8')
        data = json.loads(content)
        
        return self._dict_to_session(data)

    def list_sessions(self) -> List[SessionMetadata]:
        sessions: List[SessionMetadata] = []
        
        if not self.sessions_dir.exists():
            return sessions
        
        for session_dir in self.sessions_dir.iterdir():
            if session_dir.is_dir():
                metadata_file = session_dir / self.METADATA_FILE
                if metadata_file.exists():
                    try:
                        content = metadata_file.read_text(encoding='utf-8')
                        data = json.loads(content)
                        metadata = SessionMetadata(**data)
                        sessions.append(metadata)
                    except (json.JSONDecodeError, TypeError):
                        continue
        
        sessions.sort(key=lambda x: x.created_at, reverse=True)
        return sessions

    def delete_session(self, session_id: str) -> bool:
        session_dir = self.sessions_dir / session_id
        if session_dir.exists():
            import shutil
            shutil.rmtree(session_dir)
            return True
        return False

    def confirm_device_status(
        self,
        session_id: str,
        device_id: str,
        confirmed: bool = True,
        confirmed_by: Optional[str] = None,
        notes: str = ""
    ) -> Optional[DeviceStatus]:
        session = self.load_session(session_id)
        if not session:
            return None
        
        if device_id not in session.device_statuses:
            return None
        
        status = session.device_statuses[device_id]
        status.confirmed = confirmed
        status.confirmed_by = confirmed_by
        status.confirmed_at = datetime.now()
        status.notes = notes
        
        self.save_session(session)
        return status

    def confirm_all_devices(
        self,
        session_id: str,
        confirmed: bool = True,
        confirmed_by: Optional[str] = None
    ) -> int:
        session = self.load_session(session_id)
        if not session:
            return 0
        
        count = 0
        for device_id in session.device_statuses:
            status = session.device_statuses[device_id]
            status.confirmed = confirmed
            status.confirmed_by = confirmed_by
            status.confirmed_at = datetime.now()
            count += 1
        
        self.save_session(session)
        return count

    def get_unconfirmed_devices(self, session_id: str) -> List[DeviceStatus]:
        session = self.load_session(session_id)
        if not session:
            return []
        
        return [
            status for status in session.device_statuses.values()
            if not status.confirmed
        ]

    def get_devices_with_risks(self, session_id: str) -> List[DeviceStatus]:
        session = self.load_session(session_id)
        if not session:
            return []
        
        return [
            status for status in session.device_statuses.values()
            if status.risk_count > 0
        ]

    def _session_to_dict(self, session: InspectionSession) -> Dict[str, Any]:
        devices_data = []
        for device in session.devices:
            device_dict = {
                "identity": {
                    "device_type": device.identity.device_type.value,
                    "device_id": device.identity.device_id,
                    "location": device.identity.location,
                    "label": device.identity.label,
                },
                "source_files": device.source_files,
                "collected_at": device.collected_at.isoformat() if device.collected_at else None,
            }
            
            if device.serial_log:
                device_dict["serial_log"] = {
                    "filename": device.serial_log.filename,
                    "raw_content": device.serial_log.raw_content,
                    "entries": [
                        {
                            "timestamp": e.timestamp,
                            "level": e.level,
                            "module": e.module,
                            "message": e.message,
                            "raw_line": e.raw_line,
                            "reboot_indicator": e.reboot_indicator,
                            "version_indicator": e.version_indicator,
                        }
                        for e in device.serial_log.entries
                    ],
                    "detected_version": device.serial_log.detected_version,
                    "reboot_count": device.serial_log.reboot_count,
                    "last_reboot_time": device.serial_log.last_reboot_time,
                }
                if device.serial_log.port_info:
                    device_dict["serial_log"]["port_info"] = {
                        "baud_rate": device.serial_log.port_info.baud_rate,
                        "data_bits": device.serial_log.port_info.data_bits,
                        "parity": device.serial_log.port_info.parity,
                        "stop_bits": device.serial_log.port_info.stop_bits,
                        "detected_baud_rate": device.serial_log.port_info.detected_baud_rate,
                    }
            
            if device.bluetooth_snapshot:
                device_dict["bluetooth_snapshot"] = {
                    "timestamp": device.bluetooth_snapshot.timestamp.isoformat(),
                    "raw_data": device.bluetooth_snapshot.raw_data,
                    "devices": [
                        {
                            "address": d.address,
                            "name": d.name,
                            "rssi": d.rssi,
                            "service_data": d.service_data,
                            "manufacturer_data": d.manufacturer_data,
                        }
                        for d in device.bluetooth_snapshot.devices
                    ],
                }
            
            if device.config:
                device_dict["config"] = {
                    "raw_json": device.config.raw_json,
                    "version": device.config.version,
                    "device_id": device.config.device_id,
                    "network_config": device.config.network_config,
                    "bluetooth_config": device.config.bluetooth_config,
                    "other_settings": device.config.other_settings,
                }
            
            devices_data.append(device_dict)
        
        device_statuses_data = {}
        for device_id, status in session.device_statuses.items():
            device_statuses_data[device_id] = {
                "device_id": status.device_id,
                "device_type": status.device_type.value,
                "location": status.location,
                "version": status.version,
                "confirmed": status.confirmed,
                "confirmed_by": status.confirmed_by,
                "confirmed_at": status.confirmed_at.isoformat() if status.confirmed_at else None,
                "notes": status.notes,
                "risks": [
                    {
                        "risk_type": r.risk_type.value,
                        "level": r.level.value,
                        "description": r.description,
                        "device_id": r.device_id,
                        "device_type": r.device_type.value,
                        "location": r.location,
                        "details": r.details,
                        "suggestion": r.suggestion,
                    }
                    for r in status.risks
                ],
            }
        
        return {
            "session_id": session.session_id,
            "name": session.name,
            "created_at": session.created_at.isoformat(),
            "devices": devices_data,
            "device_statuses": device_statuses_data,
            "summary": session.summary,
        }

    def _dict_to_session(self, data: Dict[str, Any]) -> InspectionSession:
        from meeting_screen_inspector.models.models import (
            DeviceType, RiskLevel, RiskType,
            DeviceInspection, DeviceIdentity, SerialLog,
            SerialLogEntry, SerialPortInfo, BluetoothSnapshot,
            BluetoothDevice, DeviceConfig, DeviceStatus, Risk,
        )
        
        devices: List[DeviceInspection] = []
        for device_data in data.get("devices", []):
            identity = DeviceIdentity(
                device_type=DeviceType(device_data["identity"]["device_type"]),
                device_id=device_data["identity"]["device_id"],
                location=device_data["identity"].get("location"),
                label=device_data["identity"].get("label"),
            )
            
            serial_log = None
            if "serial_log" in device_data:
                sl_data = device_data["serial_log"]
                entries = [
                    SerialLogEntry(
                        timestamp=e.get("timestamp"),
                        level=e.get("level"),
                        module=e.get("module"),
                        message=e["message"],
                        raw_line=e["raw_line"],
                        reboot_indicator=e.get("reboot_indicator", False),
                        version_indicator=e.get("version_indicator"),
                    )
                    for e in sl_data.get("entries", [])
                ]
                
                port_info = None
                if "port_info" in sl_data:
                    pi_data = sl_data["port_info"]
                    port_info = SerialPortInfo(
                        baud_rate=pi_data["baud_rate"],
                        data_bits=pi_data.get("data_bits", 8),
                        parity=pi_data.get("parity", "N"),
                        stop_bits=pi_data.get("stop_bits", 1),
                        detected_baud_rate=pi_data.get("detected_baud_rate"),
                    )
                
                serial_log = SerialLog(
                    filename=sl_data["filename"],
                    raw_content=sl_data["raw_content"],
                    entries=entries,
                    port_info=port_info,
                    detected_version=sl_data.get("detected_version"),
                    reboot_count=sl_data.get("reboot_count", 0),
                    last_reboot_time=sl_data.get("last_reboot_time"),
                )
            
            bluetooth_snapshot = None
            if "bluetooth_snapshot" in device_data:
                bs_data = device_data["bluetooth_snapshot"]
                bt_devices = [
                    BluetoothDevice(
                        address=d["address"],
                        name=d.get("name"),
                        rssi=d.get("rssi"),
                        service_data=d.get("service_data"),
                        manufacturer_data=d.get("manufacturer_data"),
                    )
                    for d in bs_data.get("devices", [])
                ]
                
                bluetooth_snapshot = BluetoothSnapshot(
                    timestamp=datetime.fromisoformat(bs_data["timestamp"]) if bs_data.get("timestamp") else datetime.now(),
                    devices=bt_devices,
                    raw_data=bs_data.get("raw_data", ""),
                )
            
            config = None
            if "config" in device_data:
                c_data = device_data["config"]
                config = DeviceConfig(
                    raw_json=c_data["raw_json"],
                    version=c_data.get("version"),
                    device_id=c_data.get("device_id"),
                    network_config=c_data.get("network_config", {}),
                    bluetooth_config=c_data.get("bluetooth_config", {}),
                    other_settings=c_data.get("other_settings", {}),
                )
            
            device = DeviceInspection(
                identity=identity,
                serial_log=serial_log,
                bluetooth_snapshot=bluetooth_snapshot,
                config=config,
                source_files=device_data.get("source_files", []),
                collected_at=datetime.fromisoformat(device_data["collected_at"]) if device_data.get("collected_at") else datetime.now(),
            )
            devices.append(device)
        
        device_statuses: Dict[str, DeviceStatus] = {}
        for device_id, status_data in data.get("device_statuses", {}).items():
            risks = [
                Risk(
                    risk_type=RiskType(r["risk_type"]),
                    level=RiskLevel(r["level"]),
                    description=r["description"],
                    device_id=r["device_id"],
                    device_type=DeviceType(r["device_type"]),
                    location=r.get("location"),
                    details=r.get("details", {}),
                    suggestion=r.get("suggestion"),
                )
                for r in status_data.get("risks", [])
            ]
            
            status = DeviceStatus(
                device_id=status_data["device_id"],
                device_type=DeviceType(status_data["device_type"]),
                location=status_data.get("location"),
                version=status_data.get("version"),
                risks=risks,
                confirmed=status_data.get("confirmed", False),
                confirmed_by=status_data.get("confirmed_by"),
                confirmed_at=datetime.fromisoformat(status_data["confirmed_at"]) if status_data.get("confirmed_at") else None,
                notes=status_data.get("notes", ""),
            )
            device_statuses[device_id] = status
        
        return InspectionSession(
            session_id=data["session_id"],
            name=data.get("name"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            devices=devices,
            device_statuses=device_statuses,
            summary=data.get("summary", {}),
        )

    def _build_metadata(self, session: InspectionSession) -> SessionMetadata:
        total_devices = len(session.devices)
        devices_with_risks = len([
            s for s in session.device_statuses.values() if s.risk_count > 0
        ])
        total_risks = sum(s.risk_count for s in session.device_statuses.values())
        
        all_confirmed = all(s.confirmed for s in session.device_statuses.values()) if session.device_statuses else False
        
        return SessionMetadata(
            session_id=session.session_id,
            name=session.name,
            created_at=session.created_at,
            updated_at=datetime.now(),
            total_devices=total_devices,
            devices_with_risks=devices_with_risks,
            total_risks=total_risks,
            confirmed=all_confirmed,
        )
