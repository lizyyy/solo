ROOMS_DATA = {
    "rooms": [
        {
            "id": "A1",
            "name": "灌装间",
            "area": 20.0,
            "height": 2.8,
            "volume": 56.0,
            "adjacent_rooms": ["A2", "C1"],
            "classification": "Grade A",
            "required_pressure_diff": 15.0,
            "required_ach": 40.0
        },
        {
            "id": "A2",
            "name": "分装间",
            "area": 15.0,
            "height": 2.8,
            "volume": 42.0,
            "adjacent_rooms": ["A1", "B1", "C1"],
            "classification": "Grade A",
            "required_pressure_diff": 15.0,
            "required_ach": 40.0
        },
        {
            "id": "B1",
            "name": "更衣室",
            "area": 10.0,
            "height": 2.8,
            "volume": 28.0,
            "adjacent_rooms": ["A2", "C1", "C2"],
            "classification": "Grade B",
            "required_pressure_diff": 12.0,
            "required_ach": 30.0
        },
        {
            "id": "C1",
            "name": "洁净走廊",
            "area": 30.0,
            "height": 2.8,
            "volume": 84.0,
            "adjacent_rooms": ["A1", "A2", "B1", "C2", "D1"],
            "classification": "Grade C",
            "required_pressure_diff": 10.0,
            "required_ach": 20.0
        },
        {
            "id": "C2",
            "name": "物料准备间",
            "area": 25.0,
            "height": 2.8,
            "volume": 70.0,
            "adjacent_rooms": ["B1", "C1", "D1"],
            "classification": "Grade C",
            "required_pressure_diff": 10.0,
            "required_ach": 20.0
        },
        {
            "id": "D1",
            "name": "非洁净区",
            "area": 50.0,
            "height": 2.8,
            "volume": 140.0,
            "adjacent_rooms": ["C1", "C2"],
            "classification": "Non-Grade",
            "required_pressure_diff": 0.0,
            "required_ach": 10.0
        }
    ]
}


PRESSURE_CSV_CONTENT = """timestamp,room_id,pressure,unit,status
2026-05-03 08:00:00,A1,15.2,Pa,ok
2026-05-03 08:00:00,A2,14.8,Pa,ok
2026-05-03 08:00:00,B1,10.5,Pa,ok
2026-05-03 08:00:00,C1,8.2,Pa,ok
2026-05-03 08:00:00,C2,7.5,Pa,ok
2026-05-03 08:00:00,D1,0.0,Pa,ok
2026-05-03 08:05:00,A1,15.0,Pa,ok
2026-05-03 08:05:00,A2,14.5,Pa,ok
2026-05-03 08:05:00,B1,10.3,Pa,ok
2026-05-03 08:05:00,C1,8.0,Pa,ok
2026-05-03 08:05:00,C2,7.3,Pa,ok
2026-05-03 08:05:00,D1,0.0,Pa,ok
2026-05-03 08:10:00,A1,14.8,Pa,ok
2026-05-03 08:10:00,A2,14.2,Pa,ok
2026-05-03 08:10:00,B1,10.0,Pa,ok
2026-05-03 08:10:00,C1,7.8,Pa,ok
2026-05-03 08:10:00,C2,7.0,Pa,ok
2026-05-03 08:10:00,D1,0.0,Pa,ok
2026-05-03 08:15:00,A1,14.5,Pa,ok
2026-05-03 08:15:00,A2,13.8,Pa,ok
2026-05-03 08:15:00,B1,9.5,Pa,ok
2026-05-03 08:15:00,C1,7.5,Pa,ok
2026-05-03 08:15:00,C2,6.8,Pa,ok
2026-05-03 08:15:00,D1,0.0,Pa,ok
2026-05-03 08:20:00,A1,14.2,Pa,ok
2026-05-03 08:20:00,A2,13.5,Pa,ok
2026-05-03 08:20:00,B1,9.2,Pa,ok
2026-05-03 08:20:00,C1,7.2,Pa,ok
2026-05-03 08:20:00,C2,6.5,Pa,ok
2026-05-03 08:20:00,D1,0.0,Pa,ok
2026-05-03 08:25:00,A1,14.0,Pa,ok
2026-05-03 08:25:00,A2,13.0,Pa,ok
2026-05-03 08:25:00,B1,8.8,Pa,ok
2026-05-03 08:25:00,C1,7.0,Pa,ok
2026-05-03 08:25:00,C2,6.2,Pa,ok
2026-05-03 08:25:00,D1,0.0,Pa,ok
2026-05-03 08:30:00,A1,13.8,Pa,ok
2026-05-03 08:30:00,A2,12.5,Pa,ok
2026-05-03 08:30:00,B1,8.5,Pa,ok
2026-05-03 08:30:00,C1,6.8,Pa,ok
2026-05-03 08:30:00,C2,6.0,Pa,ok
2026-05-03 08:30:00,D1,0.0,Pa,ok
"""


AIRFLOW_YAML_CONTENT = """setpoints:
  A1:
    supply_air: 2400
    exhaust_air: 800
    supply_unit: "m3/h"
    exhaust_unit: "m3/h"
  A2:
    supply_air: 1800
    exhaust_air: 600
    supply_unit: "m3/h"
    exhaust_unit: "m3/h"
  B1:
    supply_air: 900
    exhaust_air: 300
    supply_unit: "m3/h"
    exhaust_unit: "m3/h"
  C1:
    supply_air: 1800
    exhaust_air: 600
    supply_unit: "m3/h"
    exhaust_unit: "m3/h"
  C2:
    supply_air: 1400
    exhaust_air: 480
    supply_unit: "m3/h"
    exhaust_unit: "m3/h"
  D1:
    supply_air: 800
    exhaust_air: 400
    supply_unit: "m3/h"
    exhaust_unit: "m3/h"
"""


DOOR_JSONL_CONTENT = """{"timestamp": "2026-05-03 08:05:30", "room_id": "B1", "event_type": "open", "duration": 8.5}
{"timestamp": "2026-05-03 08:05:45", "room_id": "B1", "event_type": "close"}
{"timestamp": "2026-05-03 08:12:20", "room_id": "C1", "event_type": "open", "duration": 12.0}
{"timestamp": "2026-05-03 08:12:35", "room_id": "C1", "event_type": "close"}
{"timestamp": "2026-05-03 08:18:45", "room_id": "A1", "event_type": "open", "duration": 5.5}
{"timestamp": "2026-05-03 08:18:55", "room_id": "A1", "event_type": "close"}
{"timestamp": "2026-05-03 08:22:10", "room_id": "C2", "event_type": "open", "duration": 15.0}
{"timestamp": "2026-05-03 08:22:30", "room_id": "C2", "event_type": "close"}
{"timestamp": "2026-05-03 08:28:00", "room_id": "B1", "event_type": "open", "duration": 6.0}
{"timestamp": "2026-05-03 08:28:10", "room_id": "B1", "event_type": "close"}
"""
