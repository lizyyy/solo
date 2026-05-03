import pytest
from datetime import datetime, timedelta

from cleanroom_verifier.parser import Room, PressureReading, AirflowSetpoint, DoorEvent
from cleanroom_verifier.calculator import Calculator, PressureGradient, ACHResult, DoorImpact, INH2O_TO_PA


class TestCalculator:
    def setup_method(self):
        self.calculator = Calculator()
    
    def test_convert_to_pa(self):
        assert self.calculator.convert_to_pa(1.0, "Pa") == 1.0
        assert self.calculator.convert_to_pa(1.0, "inH2O") == pytest.approx(248.84)
        assert self.calculator.convert_to_pa(1.0, "in H2O") == pytest.approx(248.84)
        assert self.calculator.convert_to_pa(1.0, "in.wc") == pytest.approx(248.84)
    
    def test_convert_to_inh2o(self):
        assert self.calculator.convert_to_inh2o(248.84, "Pa") == pytest.approx(1.0)
        assert self.calculator.convert_to_inh2o(1.0, "inH2O") == 1.0
    
    def test_normalize_pressure(self):
        readings = [
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R1",
                pressure=1.0,
                unit="inH2O",
                is_valid=True
            ),
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 5),
                room_id="R1",
                pressure=15.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        normalized = self.calculator.normalize_pressure(readings, "Pa")
        
        assert len(normalized) == 2
        assert normalized[0].pressure == pytest.approx(248.84)
        assert normalized[0].unit == "Pa"
        assert normalized[1].pressure == 15.0
        assert normalized[1].unit == "Pa"
    
    def test_get_latest_pressure_by_room(self):
        readings = [
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R1",
                pressure=10.0,
                unit="Pa",
                is_valid=True
            ),
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 5),
                room_id="R1",
                pressure=12.0,
                unit="Pa",
                is_valid=True
            ),
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 10),
                room_id="R2",
                pressure=5.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        latest = self.calculator.get_latest_pressure_by_room(readings)
        
        assert "R1" in latest
        assert "R2" in latest
        assert latest["R1"][0] == 12.0
        assert latest["R2"][0] == 5.0
    
    def test_get_latest_pressure_skips_invalid(self):
        readings = [
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R1",
                pressure=10.0,
                unit="Pa",
                is_valid=True
            ),
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 5),
                room_id="R1",
                pressure=12.0,
                unit="Pa",
                is_valid=False
            )
        ]
        
        latest = self.calculator.get_latest_pressure_by_room(readings)
        
        assert latest["R1"][0] == 10.0
    
    def test_calculate_pressure_gradients_valid(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=["R2"], required_pressure_diff=10.0
            ),
            "R2": Room(
                id="R2", name="Room 2", area=15.0, height=2.8, volume=42.0,
                adjacent_rooms=["R1"], required_pressure_diff=5.0
            )
        }
        
        readings = [
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R1",
                pressure=15.0,
                unit="Pa",
                is_valid=True
            ),
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R2",
                pressure=5.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        gradients = self.calculator.calculate_pressure_gradients(rooms, readings)
        
        assert len(gradients) == 2
        
        r1_to_r2 = [g for g in gradients if g.room_id == "R1" and g.adjacent_room_id == "R2"][0]
        assert r1_to_r2.measured_diff == 10.0
        assert r1_to_r2.required_diff == 10.0
        assert r1_to_r2.is_valid == True
        
        r2_to_r1 = [g for g in gradients if g.room_id == "R2" and g.adjacent_room_id == "R1"][0]
        assert r2_to_r1.measured_diff == -10.0
        assert r2_to_r1.required_diff == 5.0
        assert r2_to_r1.is_valid == True
    
    def test_calculate_pressure_gradients_missing_data(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=["R2"], required_pressure_diff=10.0
            ),
            "R2": Room(
                id="R2", name="Room 2", area=15.0, height=2.8, volume=42.0,
                adjacent_rooms=["R1"], required_pressure_diff=5.0
            )
        }
        
        readings = [
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R1",
                pressure=15.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        gradients = self.calculator.calculate_pressure_gradients(rooms, readings)
        
        r1_to_r2 = [g for g in gradients if g.room_id == "R1" and g.adjacent_room_id == "R2"][0]
        assert r1_to_r2.is_valid == False
        
        r2_to_r1 = [g for g in gradients if g.room_id == "R2" and g.adjacent_room_id == "R1"][0]
        assert r2_to_r1.is_valid == False
    
    def test_calculate_ach_valid(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=[], required_pressure_diff=10.0, required_ach=40.0
            )
        }
        
        setpoints = {
            "R1": AirflowSetpoint(
                room_id="R1",
                supply_air=2400.0,
                exhaust_air=800.0
            )
        }
        
        results = self.calculator.calculate_ach(rooms, setpoints)
        
        assert len(results) == 1
        assert results[0].ach == pytest.approx(2400.0 / 56.0)
        assert results[0].required_ach == 40.0
        assert results[0].is_valid == True
    
    def test_calculate_ach_missing_setpoint(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=[], required_pressure_diff=10.0, required_ach=40.0
            )
        }
        
        setpoints = {}
        
        results = self.calculator.calculate_ach(rooms, setpoints)
        
        assert len(results) == 1
        assert results[0].is_valid == False
    
    def test_calculate_ach_invalid_volume(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=0.0,
                adjacent_rooms=[], required_pressure_diff=10.0, required_ach=40.0
            )
        }
        
        setpoints = {
            "R1": AirflowSetpoint(
                room_id="R1",
                supply_air=2400.0,
                exhaust_air=800.0
            )
        }
        
        results = self.calculator.calculate_ach(rooms, setpoints)
        
        assert results[0].is_valid == False
    
    def test_analyze_door_impacts(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=["R2"], required_pressure_diff=10.0
            ),
            "R2": Room(
                id="R2", name="Room 2", area=15.0, height=2.8, volume=42.0,
                adjacent_rooms=["R1"], required_pressure_diff=5.0
            )
        }
        
        base_time = datetime(2026, 5, 3, 8, 0)
        readings = []
        
        for i in range(20):
            readings.append(PressureReading(
                timestamp=base_time + timedelta(seconds=i * 10),
                room_id="R1",
                pressure=15.0 if i < 5 else 12.0 if i < 10 else 15.0,
                unit="Pa",
                is_valid=True
            ))
            readings.append(PressureReading(
                timestamp=base_time + timedelta(seconds=i * 10),
                room_id="R2",
                pressure=5.0,
                unit="Pa",
                is_valid=True
            ))
        
        door_events = [
            DoorEvent(
                timestamp=base_time + timedelta(seconds=50),
                room_id="R1",
                event_type="open",
                duration=10.0
            )
        ]
        
        impacts = self.calculator.analyze_door_impacts(
            rooms, readings, door_events,
            window_before=30, window_after=30, transient_threshold=5.0
        )
        
        assert len(impacts) > 0
    
    def test_calculate_all(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=["R2"], required_pressure_diff=10.0, required_ach=40.0
            ),
            "R2": Room(
                id="R2", name="Room 2", area=15.0, height=2.8, volume=42.0,
                adjacent_rooms=["R1"], required_pressure_diff=5.0, required_ach=30.0
            )
        }
        
        readings = [
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R1",
                pressure=15.0,
                unit="Pa",
                is_valid=True
            ),
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R2",
                pressure=5.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        setpoints = {
            "R1": AirflowSetpoint(room_id="R1", supply_air=2400.0, exhaust_air=800.0),
            "R2": AirflowSetpoint(room_id="R2", supply_air=1500.0, exhaust_air=500.0)
        }
        
        door_events = []
        
        results = self.calculator.calculate_all(rooms, readings, setpoints, door_events)
        
        assert "pressure_gradients" in results
        assert "ach_results" in results
        assert "door_impacts" in results
        assert len(results["pressure_gradients"]) == 2
        assert len(results["ach_results"]) == 2
        assert len(results["door_impacts"]) == 0
