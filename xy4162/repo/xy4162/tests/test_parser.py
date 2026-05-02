import pytest
import pandas as pd
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.parser import DataParser
import config


class TestDataParser:
    def setup_method(self):
        self.parser = DataParser()
    
    def test_parse_cleaning_csv(self):
        sample_csv = os.path.join(config.SAMPLE_DIR, "cleaning_records.csv")
        df = self.parser.parse_cleaning_csv(sample_csv)
        
        assert isinstance(df, pd.DataFrame)
        assert len(df) > 0
        assert "store_name" in df.columns
        assert "machine_id" in df.columns
        assert "cleaning_time" in df.columns
        assert pd.api.types.is_datetime64_any_dtype(df["cleaning_time"])
    
    def test_parse_workorder_json(self):
        sample_json = os.path.join(config.SAMPLE_DIR, "work_orders.json")
        df = self.parser.parse_workorder_json(sample_json)
        
        assert isinstance(df, pd.DataFrame)
        assert len(df) > 0
        assert "workorder_id" in df.columns
        assert "store_name" in df.columns
        assert "machine_id" in df.columns
        assert "status" in df.columns
    
    def test_parse_volume_csv(self):
        sample_csv = os.path.join(config.SAMPLE_DIR, "volume_records.csv")
        df = self.parser.parse_volume_csv(sample_csv)
        
        assert isinstance(df, pd.DataFrame)
        assert len(df) > 0
        assert "store_name" in df.columns
        assert "machine_id" in df.columns
        assert "record_time" in df.columns
        assert "cup_count" in df.columns
        assert pd.api.types.is_datetime64_any_dtype(df["record_time"])
    
    def test_get_summary(self):
        sample_csv = os.path.join(config.SAMPLE_DIR, "cleaning_records.csv")
        self.parser.parse_cleaning_csv(sample_csv)
        
        summary = self.parser.get_summary()
        
        assert isinstance(summary, dict)
        assert "cleaning_records" in summary
        assert summary["cleaning_records"] > 0
        assert "stores" in summary
        assert "machines" in summary
    
    def test_load_sample_data(self):
        results = self.parser.load_sample_data()
        
        assert isinstance(results, dict)
        assert "cleaning" in results
        assert "workorders" in results
        assert "volume" in results
