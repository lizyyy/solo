import platform
import hashlib
import json
import socket
import uuid
from pathlib import Path


class FingerprintGenerator:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def get_system_info(self):
        try:
            mac_address = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                                   for elements in range(0, 8*6, 8)][::-1])
        except Exception:
            mac_address = "unknown"
        
        try:
            hostname = socket.gethostname()
        except Exception:
            hostname = "unknown"
        
        info = {
            "os": platform.system(),
            "os_version": platform.version(),
            "architecture": platform.machine(),
            "hostname": hostname,
            "mac_address": mac_address,
            "processor": platform.processor(),
            "python_version": platform.python_version(),
        }
        return info

    def generate_fingerprint(self, machine_id: str = None):
        if machine_id:
            return {
                "machine_id": machine_id,
                "fingerprint": hashlib.sha256(machine_id.encode()).hexdigest(),
                "generated_at": platform.node(),
                "timestamp": __import__('datetime').datetime.now().isoformat()
            }
        
        info = self.get_system_info()
        fingerprint_str = f"{info['os']}|{info['os_version']}|{info['architecture']}|{info['hostname']}|{info['mac_address']}|{info['processor']}"
        return {
            "machine_id": info["hostname"],
            "fingerprint": hashlib.sha256(fingerprint_str.encode()).hexdigest(),
            "system_info": info,
            "timestamp": __import__('datetime').datetime.now().isoformat()
        }

    def save_fingerprint(self, output_file: str = None, machine_id: str = None):
        fingerprint_data = self.generate_fingerprint(machine_id)
        if not output_file:
            output_file = f"{fingerprint_data['machine_id']}_fingerprint.json"
        file_path = self.output_dir / output_file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(fingerprint_data, f, indent=2, ensure_ascii=False)
        return file_path, fingerprint_data
