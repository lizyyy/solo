from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from datetime import datetime, time
from typing import List, Dict, Optional, Any
from enum import Enum
import uuid
import pandas as pd
import io
import json
from collections import defaultdict

app = FastAPI(title="IoT设备固件升级台")

class StatusCode(str, Enum):
    SUCCESS = "success"
    PENDING_REVIEW = "pending_review"
    BLOCKED = "blocked"
    RETRYABLE = "retryable"

class FirmwareVersion(BaseModel):
    version: str
    min_hardware: str
    max_hardware: str
    release_date: datetime
    is_stable: bool
    rollback_version: Optional[str] = None

class UpgradeWindow(BaseModel):
    id: str
    name: str
    start_time: time
    end_time: time
    days: List[int]
    max_devices: int

class DeviceBatch(BaseModel):
    batch_id: str
    devices: List[str]
    target_version: str
    current_version: str
    hardware_version: str
    owner: str
    upgrade_window_id: str
    created_at: datetime = Field(default_factory=datetime.now)

class ValidationResult(BaseModel):
    status: StatusCode
    message: str
    details: Dict[str, Any]
    device_count: int
    blocked_reasons: Optional[List[str]] = None
    retry_suggestion: Optional[str] = None

class GrayStrategy(BaseModel):
    id: str
    name: str
    enabled: bool
    percentage: int
    start_date: datetime
    end_date: Optional[datetime] = None
    excluded_devices: List[str] = []
    priority_groups: List[str] = []

class UpgradeRecord(BaseModel):
    record_id: str
    batch_id: str
    device_id: str
    target_version: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    rollback_triggered: bool = False
    gray_applied: bool = False

firmware_versions = {
    "v2.1.0": FirmwareVersion(
        version="v2.1.0",
        min_hardware="hw-v1.2",
        max_hardware="hw-v2.5",
        release_date=datetime(2024, 1, 15),
        is_stable=True,
        rollback_version="v2.0.5"
    ),
    "v2.0.5": FirmwareVersion(
        version="v2.0.5",
        min_hardware="hw-v1.0",
        max_hardware="hw-v2.5",
        release_date=datetime(2023, 11, 20),
        is_stable=True
    ),
    "v3.0.0-beta": FirmwareVersion(
        version="v3.0.0-beta",
        min_hardware="hw-v2.0",
        max_hardware="hw-v3.0",
        release_date=datetime(2024, 3, 1),
        is_stable=False,
        rollback_version="v2.1.0"
    )
}

upgrade_windows = {
    "window-001": UpgradeWindow(
        id="window-001",
        name="凌晨维护窗口",
        start_time=time(2, 0),
        end_time=time(4, 0),
        days=[0, 1, 2, 3, 4, 5, 6],
        max_devices=500
    ),
    "window-002": UpgradeWindow(
        id="window-002",
        name="工作日晚间",
        start_time=time(20, 0),
        end_time=time(23, 0),
        days=[0, 1, 2, 3, 4],
        max_devices=200
    ),
    "window-003": UpgradeWindow(
        id="window-003",
        name="周末批量",
        start_time=time(10, 0),
        end_time=time(18, 0),
        days=[5, 6],
        max_devices=1000
    )
}

gray_strategies = {
    "gray-001": GrayStrategy(
        id="gray-001",
        name="首批10%灰度",
        enabled=True,
        percentage=10,
        start_date=datetime(2024, 1, 1),
        priority_groups=["alpha-testers"]
    )
}

batches: Dict[str, DeviceBatch] = {}
upgrade_records: List[UpgradeRecord] = []
validation_history: List[Dict] = []

def validate_hardware_compatibility(batch: DeviceBatch) -> tuple[bool, Optional[str]]:
    if batch.target_version not in firmware_versions:
        return False, f"固件版本 {batch.target_version} 不存在"
    fw = firmware_versions[batch.target_version]
    if batch.hardware_version < fw.min_hardware:
        return False, f"硬件版本 {batch.hardware_version} 低于最低要求 {fw.min_hardware}"
    if batch.hardware_version > fw.max_hardware:
        return False, f"硬件版本 {batch.hardware_version} 超出最高支持 {fw.max_hardware}"
    return True, None

def validate_upgrade_window(batch: DeviceBatch) -> tuple[bool, Optional[str]]:
    if batch.upgrade_window_id not in upgrade_windows:
        return False, f"升级窗口 {batch.upgrade_window_id} 不存在"
    window = upgrade_windows[batch.upgrade_window_id]
    current_devices = sum(1 for r in upgrade_records 
                         if r.batch_id != batch.batch_id and r.status == "pending")
    if current_devices + len(batch.devices) > window.max_devices:
        return False, f"升级窗口设备超限，当前已占用 {current_devices}，最大 {window.max_devices}"
    return True, None

def validate_rollback_safety(batch: DeviceBatch) -> tuple[bool, Optional[str]]:
    fw = firmware_versions[batch.target_version]
    if not fw.rollback_version:
        return False, "目标固件无回滚版本，风险过高"
    if fw.rollback_version not in firmware_versions:
        return False, f"回滚版本 {fw.rollback_version} 无效"
    recent_failures = sum(1 for r in upgrade_records[-100:] 
                         if r.error_message and not r.rollback_triggered)
    if recent_failures > 5:
        return False, f"近期失败率过高: {recent_failures} 次，建议先排查问题"
    return True, None

def validate_batch(batch: DeviceBatch) -> ValidationResult:
    blocked_reasons = []
    warnings = []
    
    hw_ok, hw_msg = validate_hardware_compatibility(batch)
    if not hw_ok:
        blocked_reasons.append(hw_msg)
    
    window_ok, window_msg = validate_upgrade_window(batch)
    if not window_ok:
        blocked_reasons.append(window_msg)
    
    rollback_ok, rollback_msg = validate_rollback_safety(batch)
    if not rollback_ok:
        blocked_reasons.append(rollback_msg)
    
    if len(batch.devices) > 1000:
        warnings.append("批次设备数超过1000，建议拆分")
    
    if not firmware_versions[batch.target_version].is_stable:
        warnings.append("目标固件为测试版本，需谨慎发布")
    
    if blocked_reasons:
        return ValidationResult(
            status=StatusCode.BLOCKED,
            message="批次校验失败，已拦截",
            details={"blocked_count": len(batch.devices), "blocked_reasons": blocked_reasons},
            device_count=len(batch.devices),
            blocked_reasons=blocked_reasons
        )
    
    if warnings:
        return ValidationResult(
            status=StatusCode.PENDING_REVIEW,
            message="批次有警告，待人工复核",
            details={"warnings": warnings, "device_count": len(batch.devices)},
            device_count=len(batch.devices)
        )
    
    return ValidationResult(
        status=StatusCode.SUCCESS,
        message="批次校验通过",
        details={"ready_for_upgrade": True},
        device_count=len(batch.devices)
    )

@app.post("/api/batches/validate", response_model=ValidationResult)
async def validate_batch_endpoint(batch: DeviceBatch):
    result = validate_batch(batch)
    validation_history.append({
        "batch_id": batch.batch_id,
        "timestamp": datetime.now().isoformat(),
        "status": result.status,
        "owner": batch.owner
    })
    return result

@app.post("/api/batches/")
async def create_batch(batch: DeviceBatch):
    validation = validate_batch(batch)
    if validation.status == StatusCode.BLOCKED:
        raise HTTPException(status_code=400, detail={
            "status": StatusCode.BLOCKED,
            "message": "批次被拦截",
            "reasons": validation.blocked_reasons
        })
    batches[batch.batch_id] = batch
    return {"status": "created", "validation": validation, "batch": batch}

@app.post("/api/batches/import")
async def import_batches(file: UploadFile = File(...)):
    content = await file.read()
    df = pd.read_excel(io.BytesIO(content)) if file.filename.endswith('.xlsx') else pd.read_csv(io.BytesIO(content))
    
    results = []
    for _, row in df.iterrows():
        try:
            devices = str(row.get('devices', '')).split(',') if pd.notna(row.get('devices')) else []
            batch = DeviceBatch(
                batch_id=str(row.get('batch_id', f"batch-{uuid.uuid4()[:8]}")),
                devices=[d.strip() for d in devices if d.strip()],
                target_version=str(row.get('target_version', '')),
                current_version=str(row.get('current_version', '')),
                hardware_version=str(row.get('hardware_version', '')),
                owner=str(row.get('owner', 'unknown')),
                upgrade_window_id=str(row.get('upgrade_window_id', ''))
            )
            validation = validate_batch(batch)
            if validation.status != StatusCode.BLOCKED:
                batches[batch.batch_id] = batch
            results.append({
                "row": _,
                "batch_id": batch.batch_id,
                "status": validation.status,
                "message": validation.message
            })
        except Exception as e:
            results.append({
                "row": _,
                "status": StatusCode.RETRYABLE,
                "message": f"解析失败: {str(e)}",
                "retry_suggestion": "检查字段格式"
            })
    
    return {"imported": len([r for r in results if r['status'] == StatusCode.SUCCESS]), "results": results}

@app.post("/api/batches/{batch_id}/execute")
async def execute_batch(batch_id: str, apply_gray: bool = True):
    if batch_id not in batches:
        raise HTTPException(status_code=404, detail="批次不存在")
    batch = batches[batch_id]
    strategy = gray_strategies.get("gray-001")
    
    executed = []
    for i, device_id in enumerate(batch.devices):
        in_gray = apply_gray and strategy and strategy.enabled and i < len(batch.devices) * strategy.percentage // 100
        record = UpgradeRecord(
            record_id=str(uuid.uuid4()),
            batch_id=batch_id,
            device_id=device_id,
            target_version=batch.target_version,
            status="in_progress" if in_gray or not apply_gray else "queued",
            gray_applied=in_gray
        )
        upgrade_records.append(record)
        executed.append({"device_id": device_id, "status": record.status, "gray_applied": in_gray})
    
    return {"batch_id": batch_id, "executed": len(executed), "details": executed}

@app.get("/api/statistics/")
async def get_statistics():
    stats = defaultdict(lambda: defaultdict(int))
    for record in upgrade_records:
        stats[record.batch_id][record.status] += 1
    
    gray_stats = {
        "gray_applied": sum(1 for r in upgrade_records if r.gray_applied),
        "non_gray": sum(1 for r in upgrade_records if not r.gray_applied),
        "rollback_triggered": sum(1 for r in upgrade_records if r.rollback_triggered)
    }
    
    return {"by_batch": dict(stats), "gray_statistics": gray_stats}

@app.get("/api/export/")
async def export_data(group_by: str = "owner"):
    grouped = defaultdict(list)
    
    for batch_id, batch in batches.items():
        records = [r for r in upgrade_records if r.batch_id == batch_id]
        if group_by == "owner":
            key = batch.owner
        elif group_by == "window":
            window = upgrade_windows.get(batch.upgrade_window_id, {"name": "未知窗口"})
            key = window.name if hasattr(window, 'name') else "未知窗口"
        elif group_by == "date":
            key = batch.created_at.strftime("%Y-%m-%d")
        else:
            key = "default"
        
        grouped[key].append({
            "batch_id": batch.batch_id,
            "device_count": len(batch.devices),
            "target_version": batch.target_version,
            "upgrade_window": upgrade_windows.get(batch.upgrade_window_id, {}).name if upgrade_windows.get(batch.upgrade_window_id) else "未知",
            "success_count": sum(1 for r in records if r.status == "completed"),
            "failed_count": sum(1 for r in records if r.error_message),
            "gray_count": sum(1 for r in records if r.gray_applied)
        })
    
    return {"group_by": group_by, "data": dict(grouped)}

@app.get("/api/firmware/")
async def list_firmware():
    return list(firmware_versions.values())

@app.get("/api/windows/")
async def list_windows():
    return list(upgrade_windows.values())

@app.get("/api/gray-strategies/")
async def list_gray_strategies():
    return list(gray_strategies.values())

@app.get("/")
async def root():
    return FileResponse("static/index.html")

app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
