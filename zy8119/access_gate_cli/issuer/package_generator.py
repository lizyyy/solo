import json
import hmac
import hashlib
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum


class AccessType(str, Enum):
    GRANT = "grant"
    REVOKE = "revoke"


@dataclass
class AccessEntry:
    personnel_id: str
    name: str
    card_id: str
    role: str
    zone_id: str
    access_type: AccessType
    start_time: str
    end_time: str
    request_id: str
    priority: int = 0


@dataclass
class DevicePackage:
    version: str
    device_id: str
    generated_at: str
    access_entries: List[AccessEntry]
    hmac_signature: str = ""
    package_hash: str = ""


def generate_hmac(data: str, key: str) -> str:
    return hmac.new(
        key.encode('utf-8'),
        data.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()


def verify_hmac(data: str, signature: str, key: str) -> bool:
    expected_signature = generate_hmac(data, key)
    return hmac.compare_digest(expected_signature, signature)


def generate_package_hash(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


class PackageIssuer:
    def __init__(self, hmac_keys: Dict[str, str], version: str = "1.0.0"):
        self.hmac_keys = hmac_keys
        self.version = version
        self.device_packages: Dict[str, DevicePackage] = {}
    
    def create_device_package(
        self,
        device_id: str,
        access_entries: List[AccessEntry]
    ) -> DevicePackage:
        if device_id not in self.hmac_keys:
            raise ValueError(f"No HMAC key configured for device {device_id}")
        
        package = DevicePackage(
            version=self.version,
            device_id=device_id,
            generated_at=datetime.now().isoformat(),
            access_entries=access_entries,
            hmac_signature="",
            package_hash=""
        )
        
        package_dict = asdict(package)
        del package_dict['hmac_signature']
        del package_dict['package_hash']
        
        package_json = json.dumps(package_dict, ensure_ascii=False, sort_keys=True)
        package.package_hash = generate_package_hash(package_json)
        
        signature_data = package_json + package.package_hash
        package.hmac_signature = generate_hmac(signature_data, self.hmac_keys[device_id])
        
        self.device_packages[device_id] = package
        return package
    
    def verify_device_package(
        self,
        package: DevicePackage,
        hmac_key: Optional[str] = None
    ) -> bool:
        key = hmac_key or self.hmac_keys.get(package.device_id)
        if not key:
            return False
        
        package_dict = asdict(package)
        stored_signature = package_dict.pop('hmac_signature')
        stored_hash = package_dict.pop('package_hash')
        
        package_json = json.dumps(package_dict, ensure_ascii=False, sort_keys=True)
        expected_hash = generate_package_hash(package_json)
        
        if not hmac.compare_digest(stored_hash, expected_hash):
            return False
        
        signature_data = package_json + stored_hash
        return verify_hmac(signature_data, stored_signature, key)
    
    def get_package_for_export(self, package: DevicePackage) -> Dict[str, Any]:
        package_dict = asdict(package)
        access_entries_dicts = []
        for entry in package_dict['access_entries']:
            if isinstance(entry, AccessEntry):
                entry_dict = asdict(entry)
                entry_dict['access_type'] = entry_dict['access_type'].value
                access_entries_dicts.append(entry_dict)
            else:
                access_entries_dicts.append(entry)
        package_dict['access_entries'] = access_entries_dicts
        return package_dict
    
    def export_package_to_file(
        self,
        package: DevicePackage,
        file_path: str
    ):
        package_dict = self.get_package_for_export(package)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(package_dict, f, ensure_ascii=False, indent=2)
    
    def import_package_from_file(
        self,
        file_path: str
    ) -> DevicePackage:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        access_entries = []
        for entry_data in data.get('access_entries', []):
            entry = AccessEntry(
                personnel_id=entry_data['personnel_id'],
                name=entry_data['name'],
                card_id=entry_data['card_id'],
                role=entry_data['role'],
                zone_id=entry_data['zone_id'],
                access_type=AccessType(entry_data['access_type']),
                start_time=entry_data['start_time'],
                end_time=entry_data['end_time'],
                request_id=entry_data['request_id'],
                priority=entry_data.get('priority', 0)
            )
            access_entries.append(entry)
        
        return DevicePackage(
            version=data['version'],
            device_id=data['device_id'],
            generated_at=data['generated_at'],
            access_entries=access_entries,
            hmac_signature=data['hmac_signature'],
            package_hash=data['package_hash']
        )
