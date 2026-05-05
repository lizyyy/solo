import pytest
import os
import sys
import tempfile
import json
import csv
import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.database import Base, engine, SessionLocal
from backend.app.services.data_import_service import DataImportService


class TestDataImportService:
    
    def setup_method(self):
        Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()
        self.service = DataImportService(self.db)
    
    def teardown_method(self):
        self.db.close()
    
    def test_validate_map_file_valid(self):
        valid_map = {
            "name": "Test Warehouse",
            "width": 10,
            "height": 10,
            "grid_size": 1,
            "shelves": [],
            "stations": [],
            "charging_stations": []
        }
        
        is_valid, messages = self.service.validate_map_file(valid_map)
        
        assert is_valid == True
        assert len(messages) >= 0
    
    def test_validate_map_file_missing_fields(self):
        invalid_map = {
            "name": "Test Warehouse"
        }
        
        is_valid, messages = self.service.validate_map_file(invalid_map)
        
        assert is_valid == False
        assert len(messages) > 0
    
    def test_validate_robots_file_valid(self):
        valid_robots = [
            {
                "id": "R001",
                "name": "Test Robot",
                "x": 0,
                "y": 0,
                "status": "idle",
                "battery": 100.0,
                "max_speed": 1.5,
                "payload_capacity": 50.0
            }
        ]
        
        is_valid, messages = self.service.validate_robots_file(valid_robots)
        
        assert is_valid == True
    
    def test_validate_robots_file_missing_id(self):
        invalid_robots = [
            {
                "name": "Test Robot",
                "x": 0,
                "y": 0
            }
        ]
        
        is_valid, messages = self.service.validate_robots_file(invalid_robots)
        
        assert is_valid == False
        assert len(messages) > 0
    
    def test_validate_orders_file_valid(self):
        valid_orders = [
            {
                "id": "ORD001",
                "priority": 1,
                "pickup_x": 0,
                "pickup_y": 0,
                "dropoff_x": 10,
                "dropoff_y": 10,
                "cargo_weight": 10.0
            }
        ]
        
        is_valid, messages = self.service.validate_orders_file(valid_orders)
        
        assert is_valid == True
    
    def test_validate_orders_file_missing_id(self):
        invalid_orders = [
            {
                "priority": 1,
                "pickup_x": 0,
                "pickup_y": 0,
                "dropoff_x": 10,
                "dropoff_y": 10
            }
        ]
        
        is_valid, messages = self.service.validate_orders_file(invalid_orders)
        
        assert is_valid == False
        assert len(messages) > 0
    
    def test_analyze_map_data(self):
        map_data = {
            "width": 40,
            "height": 30,
            "grid_size": 1,
            "shelves": [{"id": "S001"}, {"id": "S002"}],
            "stations": [{"id": "P001"}, {"id": "D001"}],
            "charging_stations": [{"id": "C001"}],
            "aisles": [{"id": "A001"}, {"id": "A002"}],
            "narrow_passages": [{"id": "N001"}],
            "obstacles": [{"id": "O001"}]
        }
        
        stats = self.service._analyze_map_data(map_data)
        
        assert stats["total_shelves"] == 2
        assert stats["total_stations"] == 2
        assert stats["total_charging_stations"] == 1
        assert stats["total_aisles"] == 2
        assert stats["total_narrow_passages"] == 1
        assert stats["total_obstacles"] == 1
        assert stats["map_dimensions"]["width"] == 40
        assert stats["map_dimensions"]["height"] == 30
    
    def test_analyze_map_data_empty(self):
        map_data = {
            "width": 10,
            "height": 10,
            "grid_size": 1
        }
        
        stats = self.service._analyze_map_data(map_data)
        
        assert stats["total_shelves"] == 0
        assert stats["total_stations"] == 0
        assert stats["total_charging_stations"] == 0
