import pytest
import tempfile
import csv
from pathlib import Path
from datetime import datetime
from water_quality_simulator.parser import CSVLoader, DataValidator, ValidationError
from water_quality_simulator.models import PondConfig, PondState


class TestCSVLoader:
    def test_load_pond_config(self):
        loader = CSVLoader()
        config = loader.load_pond_config("examples/pond_config.csv")
        
        assert config is not None
        assert config.pond_id == "pond_001"
        assert config.pond_name == "南美白对虾育苗池1号"
        assert config.volume == 100.0
        assert config.area == 50.0
        assert config.depth == 2.0
        assert config.species == "南美白对虾"
        assert config.stage == "仔虾期(P1-P5)"
        assert config.stocking_density == 5000

    def test_load_water_quality_state(self):
        loader = CSVLoader()
        state = loader.load_water_quality_state("examples/water_quality.csv", "pond_001")
        
        assert state is not None
        assert state.pond_id == "pond_001"
        assert state.temperature == 29.0
        assert state.ph == 8.0
        assert state.ammonia_nitrogen == 0.78
        assert state.nitrite == 0.28
        assert state.salinity == 25.0
        assert state.dissolved_oxygen == 4.5

    def test_load_sensor_records(self):
        loader = CSVLoader()
        sensor_data = loader.load_sensor_records("examples/sensor_records.csv", "pond_001")
        
        assert sensor_data is not None
        assert len(sensor_data.records) > 0

    def test_load_invalid_file(self):
        loader = CSVLoader()
        config = loader.load_pond_config("nonexistent_file.csv")
        assert config is None
        assert len(loader.validation_errors) > 0

    def test_create_temp_csv_and_load(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            writer = csv.writer(f)
            writer.writerow([
                'pond_id', 'pond_name', 'volume', 'area', 'depth',
                'species', 'stage', 'stocking_density', 'notes'
            ])
            writer.writerow([
                'test_001', '测试池', '80', '40', '2.0',
                '测试品种', '测试阶段', '3000', '测试备注'
            ])
            temp_path = f.name
        
        try:
            loader = CSVLoader()
            config = loader.load_pond_config(temp_path)
            
            assert config is not None
            assert config.pond_id == "test_001"
            assert config.pond_name == "测试池"
            assert config.volume == 80.0
            assert config.area == 40.0
            assert config.species == "测试品种"
            assert config.stocking_density == 3000
        finally:
            Path(temp_path).unlink()


class TestDataValidator:
    def test_validate_pond_config_valid(self):
        validator = DataValidator()
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
            species="南美白对虾",
            stage="仔虾期",
            stocking_density=5000,
        )
        result = validator.validate_pond_config(config)
        
        assert result.is_valid is True
        assert len(result.errors) == 0

    def test_validate_pond_config_invalid(self):
        validator = DataValidator()
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=-100.0,
            area=-50.0,
            depth=-2.0,
            species="南美白对虾",
            stage="仔虾期",
            stocking_density=5000,
        )
        result = validator.validate_pond_config(config)
        
        assert result.is_valid is False
        assert len(result.errors) > 0

    def test_validate_pond_state_valid(self):
        validator = DataValidator()
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.5,
            nitrite=0.15,
            salinity=25.0,
            dissolved_oxygen=5.0,
        )
        result = validator.validate_pond_state(state)
        
        assert result.is_valid is True

    def test_validate_pond_state_invalid_ph(self):
        validator = DataValidator()
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=28.5,
            ph=15.0,
            ammonia_nitrogen=0.5,
            nitrite=0.15,
            salinity=25.0,
            dissolved_oxygen=5.0,
        )
        result = validator.validate_pond_state(state)
        
        assert result.is_valid is False
        assert len(result.warnings) > 0

    def test_validate_complete_data(self):
        validator = DataValidator()
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.5,
            nitrite=0.15,
            salinity=25.0,
            dissolved_oxygen=5.0,
        )
        result = validator.validate_complete_data(config, state)
        
        assert result.is_valid is True

    def test_validation_result_combination(self):
        from water_quality_simulator.parser.validator import ValidationResult
        
        result = ValidationResult()
        assert result.is_valid is True
        
        result.add_error("测试错误")
        assert result.is_valid is False
        assert len(result.errors) == 1
        
        result.add_warning("测试警告")
        assert len(result.warnings) == 1

    def test_validate_pond_state_negative_values(self):
        validator = DataValidator()
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=-5.0,
            ph=8.2,
            ammonia_nitrogen=-0.5,
            nitrite=-0.15,
            salinity=-25.0,
            dissolved_oxygen=-5.0,
        )
        result = validator.validate_pond_state(state)
        
        assert result.is_valid is False
        assert len(result.errors) >= 4

    def test_validate_pond_state_extreme_temperature(self):
        validator = DataValidator()
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=45.0,
            ph=8.2,
            ammonia_nitrogen=0.5,
            nitrite=0.15,
            salinity=25.0,
            dissolved_oxygen=5.0,
        )
        result = validator.validate_pond_state(state)
        
        assert result.is_valid is False
        assert len(result.warnings) > 0
