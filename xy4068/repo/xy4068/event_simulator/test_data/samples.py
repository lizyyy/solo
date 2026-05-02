import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from event_simulator.models.camera import Camera
from event_simulator.models.area import Area, AreaType
from event_simulator.models.event import Event, EventType, EventSeverity
from event_simulator.models.event_template import EventTemplate, RepeatPattern
from event_simulator.models.jitter_rule import JitterRule, JitterType
from event_simulator.models.scenario import Scenario, ScenarioStatus


def create_sample_camera(
    camera_id: Optional[str] = None,
    name: Optional[str] = None,
    location: str = "门店入口",
    model: str = "HIKVISION DS-2CD3T46WD-I3",
    ip_address: str = "192.168.1.100",
) -> Camera:
    return Camera(
        id=camera_id or f"cam_{uuid.uuid4().hex[:8]}",
        name=name or f"摄像头_{location}",
        location=location,
        ip_address=ip_address,
        model=model,
        resolution="1920x1080",
    )


def create_sample_area(
    area_id: Optional[str] = None,
    name: str = "入口区域",
    area_type: str = AreaType.ENTRANCE,
    camera_id: str = "cam_001",
    bounding_box: tuple = (100, 100, 500, 400),
) -> Area:
    return Area(
        id=area_id or f"area_{uuid.uuid4().hex[:8]}",
        name=name,
        type=area_type,
        camera_id=camera_id,
        bounding_box=bounding_box,
    )


def create_sample_event(
    event_id: Optional[str] = None,
    event_type: str = EventType.PERSON_ENTER,
    timestamp: Optional[datetime] = None,
    camera_id: str = "cam_001",
    area_id: Optional[str] = "area_entrance",
    severity: str = EventSeverity.INFO,
    confidence: float = 0.95,
    payload: Optional[dict] = None,
) -> Event:
    return Event(
        id=event_id or f"evt_{uuid.uuid4().hex[:12]}",
        event_type=event_type,
        timestamp=timestamp or datetime.now(),
        camera_id=camera_id,
        area_id=area_id,
        severity=severity,
        confidence=confidence,
        payload=payload or {"person_count": 1, "direction": "in"},
    )


def create_sample_scenario(
    scenario_id: str = "store_footfall_test",
    name: str = "门店客流测试场景",
    description: str = "模拟门店早高峰客流场景，包含入口进出人流统计",
    tags: Optional[List[str]] = None,
) -> Scenario:
    return Scenario(
        id=scenario_id,
        name=name,
        description=description,
        status=ScenarioStatus.DRAFT,
        version="1.0.0",
        tags=tags or ["客流", "验收", "早高峰"],
        cameras=["cam_entrance", "cam_shelf_a", "cam_shelf_b"],
        areas=["area_entrance", "area_shelf_a_drinks", "area_shelf_b_snacks"],
        duration_seconds=3600,
    )


def create_sample_event_stream(
    start_time: Optional[datetime] = None,
    duration_minutes: int = 10,
    event_interval_seconds: int = 30,
    camera_ids: Optional[List[str]] = None,
) -> List[Event]:
    if start_time is None:
        start_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
    
    if camera_ids is None:
        camera_ids = ["cam_entrance", "cam_shelf_a"]
    
    events: List[Event] = []
    current_time = start_time
    end_time = start_time + timedelta(minutes=duration_minutes)
    
    event_counter = 0
    
    while current_time < end_time:
        for cam_idx, camera_id in enumerate(camera_ids):
            if camera_id == "cam_entrance":
                event_type = EventType.PERSON_ENTER if event_counter % 2 == 0 else EventType.PERSON_EXIT
                area_id = "area_entrance"
                payload = {
                    "person_count": 1 if event_counter % 3 != 0 else 2,
                    "direction": "in" if event_type == EventType.PERSON_ENTER else "out",
                    "age_group": "adult",
                }
                severity = EventSeverity.INFO
                confidence = 0.92 + (event_counter % 10) * 0.008
            
            elif camera_id == "cam_shelf_a":
                is_out_of_stock = event_counter % 15 == 0
                event_type = EventType.SHELF_OUT_OF_STOCK if is_out_of_stock else EventType.SHELF_LOW_STOCK
                area_id = "area_shelf_a_drinks"
                payload = {
                    "sku": "DRK_" + str(1001 + (event_counter % 10)),
                    "product_name": "矿泉水" if event_counter % 2 == 0 else "可乐",
                    "stock_level": 0 if is_out_of_stock else 3 + (event_counter % 5),
                    "threshold": 5,
                }
                severity = EventSeverity.HIGH if is_out_of_stock else EventSeverity.MEDIUM
                confidence = 0.85 if is_out_of_stock else 0.78
            
            else:
                event_type = EventType.MOTION_DETECTED
                area_id = f"area_{camera_id}"
                payload = {"motion_score": 0.6 + (event_counter % 4) * 0.1}
                severity = EventSeverity.LOW
                confidence = 0.8
            
            event = Event(
                id=f"evt_{current_time.strftime('%Y%m%d%H%M%S')}_{event_counter:04d}",
                event_type=event_type,
                timestamp=current_time + timedelta(seconds=cam_idx * 2),
                camera_id=camera_id,
                area_id=area_id,
                severity=severity,
                confidence=confidence,
                payload=payload,
            )
            events.append(event)
            event_counter += 1
        
        current_time += timedelta(seconds=event_interval_seconds)
    
    obstruction_time = start_time + timedelta(minutes=5)
    obstruction_event = Event(
        id=f"evt_obstruction_{obstruction_time.strftime('%Y%m%d%H%M%S')}",
        event_type=EventType.OBSTRUCTION_DETECTED,
        timestamp=obstruction_time,
        camera_id="cam_shelf_a",
        area_id="area_shelf_a_drinks",
        severity=EventSeverity.CRITICAL,
        confidence=0.99,
        payload={
            "obstruction_type": "partial",
            "coverage_percent": 45,
            "duration_estimate_seconds": 120,
        },
    )
    events.append(obstruction_event)
    
    jitter_time = start_time + timedelta(minutes=7)
    jitter_event = Event(
        id=f"evt_jitter_{jitter_time.strftime('%Y%m%d%H%M%S')}",
        event_type=EventType.NETWORK_JITTER,
        timestamp=jitter_time,
        camera_id="cam_entrance",
        area_id=None,
        severity=EventSeverity.MEDIUM,
        confidence=1.0,
        payload={
            "latency_ms": 350,
            "packet_loss_percent": 12,
            "jitter_ms": 85,
        },
    )
    events.append(jitter_event)
    
    events.sort(key=lambda e: e.timestamp)
    
    return events


def create_sample_jitter_rules() -> List[JitterRule]:
    return [
        JitterRule(
            id="jitter_network_delay",
            name="网络延迟模拟",
            description="模拟网络不稳定导致的事件延迟",
            jitter_type=JitterType.NETWORK_DELAY,
            probability=0.15,
            severity="medium",
            delay_min_ms=100,
            delay_max_ms=2000,
            target_cameras=["cam_entrance"],
            target_event_types=[EventType.PERSON_ENTER, EventType.PERSON_EXIT],
        ),
        JitterRule(
            id="jitter_packet_loss",
            name="数据包丢失",
            description="模拟网络丢包场景",
            jitter_type=JitterType.PACKET_LOSS,
            probability=0.05,
            severity="high",
            loss_percentage=0.08,
            time_windows=[
                {"start_offset": 300, "end_offset": 600},
            ],
        ),
        JitterRule(
            id="jitter_timestamp_drift",
            name="时间戳漂移",
            description="模拟设备时钟不同步导致的时间戳漂移",
            jitter_type=JitterType.TIMESTAMP_DRIFT,
            probability=0.08,
            severity="medium",
            drift_seconds=5,
        ),
        JitterRule(
            id="jitter_duplicate",
            name="事件重复发送",
            description="模拟网络重试导致的重复事件",
            jitter_type=JitterType.DUPLICATE,
            probability=0.03,
            severity="low",
            duplicate_count=2,
        ),
    ]


def create_sample_event_templates() -> List[EventTemplate]:
    return [
        EventTemplate(
            id="tpl_person_enter_interval",
            name="定时人流进入",
            description="每30秒生成一个人员进入事件",
            event_type=EventType.PERSON_ENTER,
            camera_id="cam_entrance",
            area_id="area_entrance",
            severity=EventSeverity.INFO,
            confidence_range={"min": 0.85, "max": 0.98},
            payload_template={
                "person_count": 1,
                "direction": "in",
                "timestamp": "{timestamp}",
            },
            repeat_pattern=RepeatPattern.INTERVAL,
            repeat_interval=30,
            repeat_count=10,
            start_offset=0,
        ),
        EventTemplate(
            id="tpl_shelf_out_of_stock",
            name="货架缺货检测",
            description="单次缺货事件模板",
            event_type=EventType.SHELF_OUT_OF_STOCK,
            camera_id="cam_shelf_a",
            area_id="area_shelf_a_drinks",
            severity=EventSeverity.HIGH,
            confidence_range={"min": 0.7, "max": 0.95},
            payload_template={
                "sku": "DRK_1001",
                "product_name": "矿泉水",
                "stock_level": 0,
                "threshold": 5,
            },
            repeat_pattern=RepeatPattern.ONCE,
            start_offset=600,
            jitter_rules=["jitter_network_delay"],
        ),
    ]


def generate_sample_csv(file_path: str, event_count: int = 50):
    import csv
    from datetime import datetime, timedelta
    
    start_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
    
    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "id", "event_type", "timestamp", "camera_id", "area_id",
            "severity", "confidence", "payload"
        ])
        
        for i in range(event_count):
            event_time = start_time + timedelta(seconds=i * 15)
            event_type = "person_enter" if i % 2 == 0 else "person_exit"
            camera_id = "cam_entrance"
            
            payload = {
                "person_count": 1 if i % 3 != 0 else 2,
                "direction": "in" if event_type == "person_enter" else "out",
            }
            
            writer.writerow([
                f"evt_sample_{i:04d}",
                event_type,
                event_time.isoformat(),
                camera_id,
                "area_entrance",
                "info",
                f"{0.85 + (i % 15) * 0.01:.2f}",
                str(payload).replace("'", '"'),
            ])


def generate_sample_json(file_path: str, event_count: int = 50):
    import json
    from datetime import datetime, timedelta
    
    start_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
    
    events = []
    for i in range(event_count):
        event_time = start_time + timedelta(seconds=i * 15)
        
        if i % 10 == 0 and i > 0:
            event_type = "shelf_out_of_stock"
            camera_id = "cam_shelf_a"
            area_id = "area_shelf_a_drinks"
            severity = "high"
            payload = {
                "sku": f"DRK_{1000 + i}",
                "product_name": "矿泉水",
                "stock_level": 0,
                "threshold": 5,
            }
        else:
            event_type = "person_enter" if i % 2 == 0 else "person_exit"
            camera_id = "cam_entrance"
            area_id = "area_entrance"
            severity = "info"
            payload = {
                "person_count": 1 if i % 3 != 0 else 2,
                "direction": "in" if event_type == "person_enter" else "out",
            }
        
        events.append({
            "id": f"evt_json_{i:04d}",
            "event_type": event_type,
            "timestamp": event_time.isoformat(),
            "camera_id": camera_id,
            "area_id": area_id,
            "severity": severity,
            "confidence": round(0.85 + (i % 15) * 0.01, 2),
            "payload": payload,
        })
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump({"events": events}, f, indent=2, ensure_ascii=False)
