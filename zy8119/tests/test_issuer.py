import pytest
import tempfile
import os
import json
from datetime import datetime

from access_gate_cli.issuer.package_generator import (
    PackageIssuer,
    DevicePackage,
    AccessEntry,
    AccessType,
    generate_hmac,
    verify_hmac,
    generate_package_hash
)


class TestHmacFunctions:
    def test_generate_hmac(self):
        data = "test data for hmac"
        key = "secret_key_123"
        
        signature1 = generate_hmac(data, key)
        signature2 = generate_hmac(data, key)
        
        assert signature1 == signature2
        assert len(signature1) == 64
    
    def test_verify_hmac_valid(self):
        data = "test data"
        key = "test_key"
        
        signature = generate_hmac(data, key)
        assert verify_hmac(data, signature, key) is True
    
    def test_verify_hmac_invalid(self):
        data = "test data"
        key = "test_key"
        
        signature = generate_hmac(data, key)
        assert verify_hmac("different data", signature, key) is False
        assert verify_hmac(data, signature, "wrong_key") is False
    
    def test_generate_package_hash(self):
        data = '{"key": "value"}'
        
        hash1 = generate_package_hash(data)
        hash2 = generate_package_hash(data)
        
        assert hash1 == hash2
        assert len(hash1) == 64


class TestAccessEntry:
    def test_access_entry_creation(self):
        entry = AccessEntry(
            personnel_id="P001",
            name="张三",
            card_id="CARD001",
            role="engineer",
            zone_id="Z001",
            access_type=AccessType.GRANT,
            start_time="2024-05-15T09:00:00",
            end_time="2024-05-15T18:00:00",
            request_id="REQ001",
            priority=0
        )
        
        assert entry.personnel_id == "P001"
        assert entry.name == "张三"
        assert entry.access_type == AccessType.GRANT
        assert entry.priority == 0


class TestPackageIssuer:
    def test_create_device_package(self):
        hmac_keys = {"DEV001": "test_key_001"}
        issuer = PackageIssuer(hmac_keys=hmac_keys)
        
        entries = [
            AccessEntry(
                personnel_id="P001",
                name="张三",
                card_id="CARD001",
                role="engineer",
                zone_id="Z001",
                access_type=AccessType.GRANT,
                start_time="2024-05-15T09:00:00",
                end_time="2024-05-15T18:00:00",
                request_id="REQ001"
            )
        ]
        
        package = issuer.create_device_package("DEV001", entries)
        
        assert package.device_id == "DEV001"
        assert len(package.access_entries) == 1
        assert package.version == "1.0.0"
        assert package.package_hash != ""
        assert package.hmac_signature != ""
        assert len(package.hmac_signature) == 64
        assert len(package.package_hash) == 64
    
    def test_verify_device_package(self):
        hmac_keys = {"DEV001": "test_key_001"}
        issuer = PackageIssuer(hmac_keys=hmac_keys)
        
        entries = [
            AccessEntry(
                personnel_id="P001",
                name="张三",
                card_id="CARD001",
                role="engineer",
                zone_id="Z001",
                access_type=AccessType.GRANT,
                start_time="2024-05-15T09:00:00",
                end_time="2024-05-15T18:00:00",
                request_id="REQ001"
            )
        ]
        
        package = issuer.create_device_package("DEV001", entries)
        
        assert issuer.verify_device_package(package) is True
    
    def test_verify_device_package_tampered(self):
        hmac_keys = {"DEV001": "test_key_001"}
        issuer = PackageIssuer(hmac_keys=hmac_keys)
        
        entries = [
            AccessEntry(
                personnel_id="P001",
                name="张三",
                card_id="CARD001",
                role="engineer",
                zone_id="Z001",
                access_type=AccessType.GRANT,
                start_time="2024-05-15T09:00:00",
                end_time="2024-05-15T18:00:00",
                request_id="REQ001"
            )
        ]
        
        package = issuer.create_device_package("DEV001", entries)
        original_signature = package.hmac_signature
        original_hash = package.package_hash
        
        tampered_entries = [
            AccessEntry(
                personnel_id="P001",
                name="张三",
                card_id="CARD001",
                role="engineer",
                zone_id="Z002",
                access_type=AccessType.GRANT,
                start_time="2024-05-15T09:00:00",
                end_time="2024-05-15T18:00:00",
                request_id="REQ001"
            )
        ]
        
        package.access_entries = tampered_entries
        
        assert issuer.verify_device_package(package) is False
    
    def test_export_import_package(self):
        hmac_keys = {"DEV001": "test_key_001"}
        issuer = PackageIssuer(hmac_keys=hmac_keys)
        
        entries = [
            AccessEntry(
                personnel_id="P001",
                name="张三",
                card_id="CARD001",
                role="engineer",
                zone_id="Z001",
                access_type=AccessType.GRANT,
                start_time="2024-05-15T09:00:00",
                end_time="2024-05-15T18:00:00",
                request_id="REQ001"
            ),
            AccessEntry(
                personnel_id="P002",
                name="李四",
                card_id="CARD002",
                role="security",
                zone_id="Z001",
                access_type=AccessType.REVOKE,
                start_time="2024-05-15T10:00:00",
                end_time="2024-05-15T16:00:00",
                request_id="REQ002"
            )
        ]
        
        original_package = issuer.create_device_package("DEV001", entries)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            temp_path = f.name
        
        try:
            issuer.export_package_to_file(original_package, temp_path)
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            assert data['device_id'] == "DEV001"
            assert len(data['access_entries']) == 2
            assert data['access_entries'][0]['access_type'] == "grant"
            assert data['access_entries'][1]['access_type'] == "revoke"
            assert 'hmac_signature' in data
            assert 'package_hash' in data
            
            imported_package = issuer.import_package_from_file(temp_path)
            
            assert imported_package.device_id == original_package.device_id
            assert len(imported_package.access_entries) == len(original_package.access_entries)
            assert imported_package.hmac_signature == original_package.hmac_signature
            assert imported_package.package_hash == original_package.package_hash
            
            assert issuer.verify_device_package(imported_package) is True
            
        finally:
            os.unlink(temp_path)
    
    def test_create_package_without_key_raises_error(self):
        hmac_keys = {"DEV001": "test_key_001"}
        issuer = PackageIssuer(hmac_keys=hmac_keys)
        
        entries = []
        
        with pytest.raises(ValueError) as exc_info:
            issuer.create_device_package("DEV002", entries)
        
        assert "No HMAC key configured" in str(exc_info.value)
