from __future__ import annotations
from typing import Dict, List
from datetime import datetime, timedelta
from core.models import (
    Room, Valve, FanCurve, FanCurvePoint, AccessLog, ParticleCount,
    Adjacency, RoomTopology, ProjectData
)


def create_sample_project() -> ProjectData:
    rooms: Dict[str, Room] = {}
    supply_valves: Dict[str, Valve] = {}
    return_valves: Dict[str, Valve] = {}
    adjacencies: List[Adjacency] = []
    access_logs: List[AccessLog] = []
    particle_counts: List[ParticleCount] = []
    
    rooms["R001"] = Room(
        id="R001",
        name="灌装间",
        volume=120,
        area=40,
        height=3,
        target_pressure=15,
        target_air_change_rate=50,
        cleanliness_class="A级",
        room_type="critical"
    )
    
    rooms["R002"] = Room(
        id="R002",
        name="称量间",
        volume=90,
        area=30,
        height=3,
        target_pressure=10,
        target_air_change_rate=40,
        cleanliness_class="B级",
        room_type="production"
    )
    
    rooms["R003"] = Room(
        id="R003",
        name="气闸间",
        volume=30,
        area=10,
        height=3,
        target_pressure=12,
        target_air_change_rate=60,
        cleanliness_class="B级",
        room_type="airlock"
    )
    
    rooms["R004"] = Room(
        id="R004",
        name="走廊",
        volume=80,
        area=26.7,
        height=3,
        target_pressure=8,
        target_air_change_rate=30,
        cleanliness_class="C级",
        room_type="corridor"
    )
    
    rooms["R005"] = Room(
        id="R005",
        name="更衣间",
        volume=45,
        area=15,
        height=3,
        target_pressure=5,
        target_air_change_rate=25,
        cleanliness_class="D级",
        room_type="gowning"
    )
    
    supply_valves["S_R001"] = Valve(
        id="S_R001",
        room_id="R001",
        valve_type="supply",
        current_opening=55,
        rated_flow=5000,
        kv_value=80
    )
    
    supply_valves["S_R002"] = Valve(
        id="S_R002",
        room_id="R002",
        valve_type="supply",
        current_opening=60,
        rated_flow=3500,
        kv_value=60
    )
    
    supply_valves["S_R003"] = Valve(
        id="S_R003",
        room_id="R003",
        valve_type="supply",
        current_opening=70,
        rated_flow=1800,
        kv_value=35
    )
    
    supply_valves["S_R004"] = Valve(
        id="S_R004",
        room_id="R004",
        valve_type="supply",
        current_opening=45,
        rated_flow=2500,
        kv_value=45
    )
    
    supply_valves["S_R005"] = Valve(
        id="S_R005",
        room_id="R005",
        valve_type="supply",
        current_opening=35,
        rated_flow=1200,
        kv_value=25
    )
    
    return_valves["R_R001"] = Valve(
        id="R_R001",
        room_id="R001",
        valve_type="return",
        current_opening=40,
        rated_flow=4000,
        kv_value=70
    )
    
    return_valves["R_R002"] = Valve(
        id="R_R002",
        room_id="R002",
        valve_type="return",
        current_opening=50,
        rated_flow=2800,
        kv_value=50
    )
    
    return_valves["R_R003"] = Valve(
        id="R_R003",
        room_id="R003",
        valve_type="return",
        current_opening=65,
        rated_flow=1500,
        kv_value=30
    )
    
    return_valves["R_R004"] = Valve(
        id="R_R004",
        room_id="R004",
        valve_type="return",
        current_opening=55,
        rated_flow=2000,
        kv_value=40
    )
    
    return_valves["R_R005"] = Valve(
        id="R_R005",
        room_id="R005",
        valve_type="return",
        current_opening=45,
        rated_flow=1000,
        kv_value=22
    )
    
    adjacencies.append(Adjacency(
        room_a="R001",
        room_b="R003",
        pressure_direction="a_to_b",
        required_differential=3,
        door_area=2.0,
        leakage_coefficient=0.08
    ))
    
    adjacencies.append(Adjacency(
        room_a="R002",
        room_b="R003",
        pressure_direction="a_to_b",
        required_differential=2,
        door_area=2.0,
        leakage_coefficient=0.08
    ))
    
    adjacencies.append(Adjacency(
        room_a="R003",
        room_b="R004",
        pressure_direction="a_to_b",
        required_differential=4,
        door_area=2.0,
        leakage_coefficient=0.08
    ))
    
    adjacencies.append(Adjacency(
        room_a="R004",
        room_b="R005",
        pressure_direction="a_to_b",
        required_differential=3,
        door_area=2.0,
        leakage_coefficient=0.08
    ))
    
    adjacencies.append(Adjacency(
        room_a="R001",
        room_b="R002",
        pressure_direction="a_to_b",
        required_differential=5,
        door_area=1.5,
        leakage_coefficient=0.05
    ))
    
    fan_curve_points = [
        FanCurvePoint(flow_rate=0, static_pressure=800, efficiency=60, power=1.5),
        FanCurvePoint(flow_rate=5000, static_pressure=700, efficiency=75, power=1.8),
        FanCurvePoint(flow_rate=10000, static_pressure=550, efficiency=82, power=2.2),
        FanCurvePoint(flow_rate=15000, static_pressure=350, efficiency=78, power=2.5),
        FanCurvePoint(flow_rate=20000, static_pressure=100, efficiency=65, power=2.8),
    ]
    
    fan_curves: Dict[str, FanCurve] = {}
    fan_curves["F001"] = FanCurve(
        id="F001",
        name="送风风机1",
        supply_rooms=["R001", "R002", "R003", "R004", "R005"],
        return_rooms=[],
        curve_points=fan_curve_points,
        current_frequency=48,
        max_frequency=60,
        min_frequency=30,
        design_static_pressure=600
    )
    
    fan_curves["F002"] = FanCurve(
        id="F002",
        name="回风风机1",
        supply_rooms=[],
        return_rooms=["R001", "R002", "R003", "R004", "R005"],
        curve_points=fan_curve_points,
        current_frequency=45,
        max_frequency=60,
        min_frequency=30,
        design_static_pressure=400
    )
    
    base_time = datetime.now() - timedelta(hours=4)
    
    access_logs.append(AccessLog(
        id="AL001",
        room_id="R005",
        timestamp=base_time,
        door_id="D001",
        door_type="gowning",
        duration=15,
        adjacent_room=None,
        pressure_difference_during_open=3
    ))
    
    access_logs.append(AccessLog(
        id="AL002",
        room_id="R004",
        timestamp=base_time + timedelta(minutes=5),
        door_id="D002",
        door_type="corridor",
        duration=8,
        adjacent_room="R005",
        pressure_difference_during_open=2
    ))
    
    access_logs.append(AccessLog(
        id="AL003",
        room_id="R003",
        timestamp=base_time + timedelta(minutes=15),
        door_id="D003",
        door_type="airlock",
        duration=25,
        adjacent_room="R004",
        pressure_difference_during_open=1
    ))
    
    access_logs.append(AccessLog(
        id="AL004",
        room_id="R003",
        timestamp=base_time + timedelta(minutes=18),
        door_id="D004",
        door_type="airlock",
        duration=20,
        adjacent_room="R001",
        pressure_difference_during_open=0.5
    ))
    
    access_logs.append(AccessLog(
        id="AL005",
        room_id="R001",
        timestamp=base_time + timedelta(hours=1),
        door_id="D004",
        door_type="airlock",
        duration=12,
        adjacent_room="R003",
        pressure_difference_during_open=2
    ))
    
    particle_counts.append(ParticleCount(
        id="PC001",
        room_id="R001",
        timestamp=base_time,
        particle_size=0.5,
        concentration=3000,
        limit_value=3520,
        is_pass=True
    ))
    
    particle_counts.append(ParticleCount(
        id="PC002",
        room_id="R001",
        timestamp=base_time,
        particle_size=5.0,
        concentration=15,
        limit_value=29,
        is_pass=True
    ))
    
    particle_counts.append(ParticleCount(
        id="PC003",
        room_id="R002",
        timestamp=base_time + timedelta(minutes=30),
        particle_size=0.5,
        concentration=25000,
        limit_value=352000,
        is_pass=True
    ))
    
    particle_counts.append(ParticleCount(
        id="PC004",
        room_id="R002",
        timestamp=base_time + timedelta(minutes=30),
        particle_size=5.0,
        concentration=200,
        limit_value=2900,
        is_pass=True
    ))
    
    particle_counts.append(ParticleCount(
        id="PC005",
        room_id="R003",
        timestamp=base_time + timedelta(hours=1),
        particle_size=0.5,
        concentration=50000,
        limit_value=352000,
        is_pass=True
    ))
    
    particle_counts.append(ParticleCount(
        id="PC006",
        room_id="R004",
        timestamp=base_time + timedelta(hours=1, minutes=30),
        particle_size=0.5,
        concentration=400000,
        limit_value=3520000,
        is_pass=True
    ))
    
    particle_counts.append(ParticleCount(
        id="PC007",
        room_id="R005",
        timestamp=base_time + timedelta(hours=2),
        particle_size=0.5,
        concentration=3500000,
        limit_value=35200000,
        is_pass=True
    ))
    
    topology = RoomTopology(
        rooms=rooms,
        adjacencies=adjacencies,
        supply_valves=supply_valves,
        return_valves=return_valves,
        fan_curves=fan_curves,
        access_logs=access_logs,
        particle_counts=particle_counts
    )
    
    project = ProjectData(
        project_name="示范制药车间洁净室系统",
        project_id="PRJ-DEMO-2026-001",
        topology=topology,
        optimization_results=None
    )
    
    return project


def create_sample_with_issues() -> ProjectData:
    project = create_sample_project()
    
    project.topology.supply_valves["S_R001"].current_opening = 40
    project.topology.return_valves["R_R001"].current_opening = 55
    project.topology.supply_valves["S_R003"].current_opening = 50
    project.topology.return_valves["R_R003"].current_opening = 80
    
    return project
