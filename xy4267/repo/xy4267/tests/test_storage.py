import pytest
import tempfile
import os
from datetime import datetime
from src.storage import DataStore
from src.models import Sample, Fridge, Rack, HandoverRecord, DutyNote, SampleType, HandoverStatus


class TestDataStore:
    
    def test_store_creation(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            assert len(store.samples) == 0
            assert len(store.fridges) == 0
            assert len(store.alerts) == 0
    
    def test_add_sample(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            sample = Sample(
                sample_id="BL001",
                sample_type=SampleType.BLOOD,
                rack_id="RACK01",
                position="A01",
                scan_time=datetime.now()
            )
            
            result = store.add_sample(sample)
            assert result == True
            assert len(store.samples) == 1
    
    def test_add_duplicate_sample(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            sample1 = Sample(
                sample_id="BL001",
                sample_type=SampleType.BLOOD,
                rack_id="RACK01",
                position="A01",
                scan_time=datetime.now()
            )
            
            sample2 = Sample(
                sample_id="BL001",
                sample_type=SampleType.REAGENT,
                rack_id="RACK02",
                position="B01",
                scan_time=datetime.now()
            )
            
            store.add_sample(sample1)
            result = store.add_sample(sample2)
            assert result == False
            assert len(store.samples) == 1
    
    def test_get_sample(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            sample = Sample(
                sample_id="BL001",
                sample_type=SampleType.BLOOD,
                rack_id="RACK01",
                position="A01",
                scan_time=datetime.now()
            )
            
            store.add_sample(sample)
            
            found = store.get_sample("BL001")
            assert found is not None
            assert found.sample_id == "BL001"
            
            not_found = store.get_sample("NOT_EXIST")
            assert not_found is None
    
    def test_add_fridge(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            fridge = Fridge(
                fridge_id="FRIDGE01",
                name="测试冰箱",
                min_temp=2.0,
                max_temp=8.0
            )
            
            result = store.add_fridge(fridge)
            assert result == True
            assert len(store.fridges) == 1
    
    def test_add_rack(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            rack = Rack(
                rack_id="RACK01",
                fridge_id="FRIDGE01",
                capacity=20
            )
            
            result = store.add_rack(rack)
            assert result == True
            assert len(store.racks) == 1
    
    def test_add_handover(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            record = HandoverRecord(
                record_id="HO001",
                sample_id="BL001",
                from_operator="张医生",
                to_operator="李医生",
                handover_time=datetime.now()
            )
            
            result = store.add_handover(record)
            assert result == True
            assert len(store.handovers) == 1
    
    def test_add_duty_note(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            note = DutyNote(
                note_id="NOTE001",
                shift_date=datetime.now(),
                operator_name="张医生",
                content="测试备注",
                created_time=datetime.now()
            )
            
            result = store.add_duty_note(note)
            assert result == True
            assert len(store.duty_notes) == 1
    
    def test_save_and_load(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store1 = DataStore(data_dir=temp_dir)
            
            sample = Sample(
                sample_id="BL001",
                sample_type=SampleType.BLOOD,
                rack_id="RACK01",
                position="A01",
                scan_time=datetime.now()
            )
            
            fridge = Fridge(
                fridge_id="FRIDGE01",
                name="测试冰箱",
                min_temp=2.0,
                max_temp=8.0
            )
            
            store1.add_sample(sample)
            store1.add_fridge(fridge)
            store1.save_all()
            
            store2 = DataStore(data_dir=temp_dir)
            
            assert len(store2.samples) == 1
            assert len(store2.fridges) == 1
            assert store2.samples[0].sample_id == "BL001"
            assert store2.fridges[0].fridge_id == "FRIDGE01"
    
    def test_get_context(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            sample = Sample(
                sample_id="BL001",
                sample_type=SampleType.BLOOD,
                rack_id="RACK01",
                position="A01",
                scan_time=datetime.now()
            )
            
            store.add_sample(sample)
            
            context = store.get_context()
            assert "samples" in context
            assert len(context["samples"]) == 1
            assert "fridges" in context
            assert "racks" in context
            assert "handover_records" in context
            assert "temperature_records" in context
            assert "current_time" in context
    
    def test_clear_all(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            store = DataStore(data_dir=temp_dir)
            
            sample = Sample(
                sample_id="BL001",
                sample_type=SampleType.BLOOD,
                rack_id="RACK01",
                position="A01",
                scan_time=datetime.now()
            )
            
            fridge = Fridge(
                fridge_id="FRIDGE01",
                name="测试冰箱",
                min_temp=2.0,
                max_temp=8.0
            )
            
            store.add_sample(sample)
            store.add_fridge(fridge)
            
            store.clear_all()
            
            assert len(store.samples) == 0
            assert len(store.fridges) == 0
