"""
Data loaders for Passkey/FIDO2 compatibility checker
"""

import json
import csv
import yaml
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

from .models import (
    RelyingPartyConfig,
    BrowserSupport,
    UserInfo,
    AuthenticatorLogEntry,
)


class DataLoader:
    """Loader for various input data formats"""
    
    @staticmethod
    def load_relying_party_config(file_path: str) -> RelyingPartyConfig:
        """Load relying party configuration from JSON file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return RelyingPartyConfig(
            rp_id=data.get('rp_id', ''),
            rp_name=data.get('rp_name', ''),
            origins=data.get('origins', []),
            resident_key_required=data.get('resident_key_required', False),
            user_verification_required=data.get('user_verification_required', False),
            supported_algorithms=data.get('supported_algorithms', [-7, -257]),
            cross_device_allowed=data.get('cross_device_allowed', True),
        )
    
    @staticmethod
    def load_browser_matrix(file_path: str) -> List[BrowserSupport]:
        """Load browser compatibility matrix from YAML file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        browsers = []
        for browser_data in data.get('browsers', []):
            browsers.append(BrowserSupport(
                browser=browser_data.get('browser', ''),
                version=browser_data.get('version', ''),
                platform=browser_data.get('platform', ''),
                fido2_supported=browser_data.get('fido2_supported', False),
                resident_key_supported=browser_data.get('resident_key_supported', False),
                user_verification_supported=browser_data.get('user_verification_supported', False),
                supported_algorithms=browser_data.get('supported_algorithms', [-7, -257]),
            ))
        
        return browsers
    
    @staticmethod
    def load_users(file_path: str) -> List[UserInfo]:
        """Load user information from CSV file"""
        users = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                users.append(UserInfo(
                    user_id=row.get('user_id', ''),
                    username=row.get('username', ''),
                    display_name=row.get('display_name', ''),
                    email=row.get('email', ''),
                ))
        return users
    
    @staticmethod
    def load_authenticator_logs(file_path: str) -> List[AuthenticatorLogEntry]:
        """Load authenticator logs from JSONL file"""
        logs = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    logs.append(DataLoader._parse_log_entry(data))
                except json.JSONDecodeError:
                    continue
        return logs
    
    @staticmethod
    def _parse_log_entry(data: Dict[str, Any]) -> AuthenticatorLogEntry:
        """Parse a single log entry from JSON data"""
        timestamp_str = data.get('timestamp', '')
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            timestamp = datetime.now()
        
        return AuthenticatorLogEntry(
            credential_id=data.get('credential_id', ''),
            user_id=data.get('user_id', ''),
            rp_id=data.get('rp_id', ''),
            timestamp=timestamp,
            sign_count=data.get('sign_count', 0),
            resident_key=data.get('resident_key', False),
            user_verified=data.get('user_verified', False),
            user_present=data.get('user_present', False),
            algorithm=data.get('algorithm', -7),
            device_id=data.get('device_id', ''),
            browser=data.get('browser', ''),
            browser_version=data.get('browser_version', ''),
            platform=data.get('platform', ''),
            raw_data=data,
        )
    
    @staticmethod
    def validate_input_files(
        rp_path: str,
        logs_path: str,
        matrix_path: str,
        users_path: str
    ) -> Dict[str, bool]:
        """Validate that all input files exist and are readable"""
        results = {
            'relying_party': False,
            'authenticator_logs': False,
            'browser_matrix': False,
            'users': False,
        }
        
        for name, path in [
            ('relying_party', rp_path),
            ('authenticator_logs', logs_path),
            ('browser_matrix', matrix_path),
            ('users', users_path),
        ]:
            file_path = Path(path)
            results[name] = file_path.exists() and file_path.is_file()
        
        return results
