import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from .crypto import CryptoManager


class LicenseManager:
    STATUS_VALID = "valid"
    STATUS_EXPIRED = "expired"
    STATUS_REVOKED = "revoked"
    STATUS_INACTIVE = "inactive"
    
    def __init__(self, license_dir: Path, key_dir: Path):
        self.license_dir = license_dir
        self.license_dir.mkdir(parents=True, exist_ok=True)
        self.crypto = CryptoManager(key_dir)
        self.issued_licenses_file = license_dir / "issued_licenses.json"
        self.revoked_licenses_file = license_dir / "revoked_licenses.json"
        self.audit_log_file = license_dir / "audit_log.json"
        self._ensure_storage_files()

    def _ensure_storage_files(self):
        for file_path in [self.issued_licenses_file, self.revoked_licenses_file, self.audit_log_file]:
            if not file_path.exists():
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump([], f, indent=2)

    def _load_json(self, file_path: Path) -> List:
        if not file_path.exists():
            return []
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_json(self, file_path: Path, data: List):
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _generate_license_id(self) -> str:
        return f"LIC-{uuid.uuid4().hex[:8].upper()}"

    def _add_audit_log(self, action: str, details: Dict):
        logs = self._load_json(self.audit_log_file)
        logs.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details
        })
        self._save_json(self.audit_log_file, logs)

    def _get_customer_licenses(self, customer_id: str) -> List[Dict]:
        issued = self._load_json(self.issued_licenses_file)
        return [lic for lic in issued if lic.get("customer_id") == customer_id]

    def _get_activated_machines(self, customer_id: str) -> List[str]:
        customer_licenses = self._get_customer_licenses(customer_id)
        activated = set()
        for lic in customer_licenses:
            if lic.get("activated_machine_fingerprint"):
                activated.add(lic["activated_machine_fingerprint"])
        return list(activated)

    def issue_license(
        self,
        customer_id: str,
        customer_name: str,
        features: List[str],
        max_machines: int,
        validity_days: int,
        license_type: str = "standard"
    ) -> Dict:
        now = datetime.now()
        license_id = self._generate_license_id()
        valid_from = now
        valid_until = now + timedelta(days=validity_days)
        
        license_data = {
            "license_id": license_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "license_type": license_type,
            "features": features,
            "max_machines": max_machines,
            "valid_from": valid_from.isoformat(),
            "valid_until": valid_until.isoformat(),
            "issued_at": now.isoformat(),
            "status": self.STATUS_INACTIVE,
            "activated_machine_fingerprint": None,
            "activated_at": None,
            "renewal_history": [],
            "version": 1
        }
        
        license_str = json.dumps(license_data, sort_keys=True)
        signature = self.crypto.sign(license_str)
        
        signed_license = {
            "data": license_data,
            "signature": signature
        }
        
        issued = self._load_json(self.issued_licenses_file)
        issued.append(license_data)
        self._save_json(self.issued_licenses_file, issued)
        
        self._add_audit_log("issue", {
            "license_id": license_id,
            "customer_id": customer_id,
            "customer_name": customer_name
        })
        
        return signed_license

    def save_license(self, signed_license: Dict, output_file: str = None) -> Path:
        if not output_file:
            output_file = f"{signed_license['data']['license_id']}.json"
        file_path = self.license_dir / output_file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(signed_license, f, indent=2, ensure_ascii=False)
        return file_path

    def load_license(self, file_path: Path) -> Dict:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def verify_license_signature(self, signed_license: Dict) -> bool:
        data = signed_license["data"]
        signature = signed_license["signature"]
        license_str = json.dumps(data, sort_keys=True)
        return self.crypto.verify(license_str, signature)

    def is_revoked(self, license_id: str) -> bool:
        revoked = self._load_json(self.revoked_licenses_file)
        return any(r["license_id"] == license_id for r in revoked)

    def check_machine_limit(self, customer_id: str, max_machines: int, current_fingerprint: str) -> bool:
        activated = self._get_activated_machines(customer_id)
        if current_fingerprint in activated:
            return True
        return len(activated) < max_machines

    def activate_license(
        self,
        signed_license: Dict,
        machine_fingerprint: str,
        machine_id: str
    ) -> Dict:
        license_data = signed_license["data"]
        license_id = license_data["license_id"]
        
        if not self.verify_license_signature(signed_license):
            raise ValueError("许可证签名验证失败，可能被篡改。请让售后重新签发许可证。")
        
        if self.is_revoked(license_id):
            raise ValueError("许可证已被吊销，无法激活。请联系售后重新签发。")
        
        if license_data.get("status") == self.STATUS_REVOKED:
            raise ValueError("许可证已被吊销，无法激活。请联系售后重新签发。")
        
        now = datetime.now()
        valid_until = datetime.fromisoformat(license_data["valid_until"])
        
        if now > valid_until:
            raise ValueError("许可证已过期。请联系售后办理续期。")
        
        activated_fingerprint = license_data.get("activated_machine_fingerprint")
        if activated_fingerprint:
            if activated_fingerprint == machine_fingerprint:
                license_data["status"] = self.STATUS_VALID
                license_str = json.dumps(license_data, sort_keys=True)
                signature = self.crypto.sign(license_str)
                return {"data": license_data, "signature": signature}
            else:
                raise ValueError("机器指纹不匹配。此许可证已绑定到其他机器，请让客户在正确的机器上激活，或让售后重新签发新许可证。")
        
        if not self.check_machine_limit(
            license_data["customer_id"],
            license_data["max_machines"],
            machine_fingerprint
        ):
            raise ValueError(f"客户已达到最大授权机器数量限制 ({license_data['max_machines']} 台)。请联系售后升级授权或吊销不再使用的许可证。")
        
        license_data["status"] = self.STATUS_VALID
        license_data["activated_machine_fingerprint"] = machine_fingerprint
        license_data["activated_machine_id"] = machine_id
        license_data["activated_at"] = now.isoformat()
        
        license_str = json.dumps(license_data, sort_keys=True)
        signature = self.crypto.sign(license_str)
        
        activated_license = {
            "data": license_data,
            "signature": signature
        }
        
        issued = self._load_json(self.issued_licenses_file)
        for i, lic in enumerate(issued):
            if lic["license_id"] == license_id:
                issued[i] = license_data
                break
        self._save_json(self.issued_licenses_file, issued)
        
        self._add_audit_log("activate", {
            "license_id": license_id,
            "machine_id": machine_id,
            "machine_fingerprint": machine_fingerprint
        })
        
        return activated_license

    def check_license_status(self, signed_license: Dict, machine_fingerprint: str = None) -> Dict:
        license_data = signed_license["data"]
        license_id = license_data["license_id"]
        
        status_info = {
            "license_id": license_id,
            "customer_id": license_data["customer_id"],
            "customer_name": license_data["customer_name"],
            "valid_from": license_data["valid_from"],
            "valid_until": license_data["valid_until"],
            "features": license_data["features"],
            "status": license_data.get("status", self.STATUS_INACTIVE)
        }
        
        if not self.verify_license_signature(signed_license):
            status_info["status"] = "invalid"
            status_info["error"] = "签名验证失败"
            status_info["action"] = "请让售后重新签发许可证"
            return status_info
        
        if self.is_revoked(license_id):
            status_info["status"] = self.STATUS_REVOKED
            status_info["error"] = "许可证已被吊销"
            status_info["action"] = "请联系售后重新签发"
            return status_info
        
        now = datetime.now()
        valid_until = datetime.fromisoformat(license_data["valid_until"])
        valid_from = datetime.fromisoformat(license_data["valid_from"])
        
        if now < valid_from:
            status_info["status"] = "not_yet_active"
            status_info["error"] = "许可证尚未生效"
            status_info["action"] = "请等待许可证生效日期"
            return status_info
        
        if now > valid_until:
            status_info["status"] = self.STATUS_EXPIRED
            days_expired = (now - valid_until).days
            status_info["error"] = f"许可证已过期 {days_expired} 天"
            status_info["action"] = "请联系售后办理续期"
            return status_info
        
        activated_fingerprint = license_data.get("activated_machine_fingerprint")
        if machine_fingerprint and activated_fingerprint:
            if activated_fingerprint != machine_fingerprint:
                status_info["status"] = "fingerprint_mismatch"
                status_info["error"] = "机器指纹不匹配"
                status_info["action"] = "请在正确的机器上使用，或让售后重新签发许可证"
                return status_info
        
        days_remaining = (valid_until - now).days
        status_info["days_remaining"] = days_remaining
        
        return status_info

    def renew_license(
        self,
        signed_license: Dict,
        additional_days: int
    ) -> Dict:
        license_data = signed_license["data"]
        license_id = license_data["license_id"]
        
        if not self.verify_license_signature(signed_license):
            raise ValueError("许可证签名验证失败，可能被篡改。请让售后重新签发许可证。")
        
        if self.is_revoked(license_id):
            raise ValueError("许可证已被吊销，无法续期。请联系售后重新签发。")
        
        now = datetime.now()
        valid_until = datetime.fromisoformat(license_data["valid_until"])
        
        if additional_days <= 0:
            raise ValueError("续期天数必须为正数。")
        
        license_data["renewal_history"].append({
            "renewed_at": now.isoformat(),
            "previous_valid_until": license_data["valid_until"],
            "additional_days": additional_days
        })
        
        if now > valid_until:
            new_valid_until = now + timedelta(days=additional_days)
        else:
            new_valid_until = valid_until + timedelta(days=additional_days)
        
        license_data["valid_until"] = new_valid_until.isoformat()
        license_data["version"] += 1
        
        license_str = json.dumps(license_data, sort_keys=True)
        signature = self.crypto.sign(license_str)
        
        renewed_license = {
            "data": license_data,
            "signature": signature
        }
        
        issued = self._load_json(self.issued_licenses_file)
        for i, lic in enumerate(issued):
            if lic["license_id"] == license_id:
                issued[i] = license_data
                break
        self._save_json(self.issued_licenses_file, issued)
        
        self._add_audit_log("renew", {
            "license_id": license_id,
            "additional_days": additional_days,
            "new_valid_until": new_valid_until.isoformat()
        })
        
        return renewed_license

    def revoke_license(self, license_id: str, reason: str = "未提供原因") -> Dict:
        issued = self._load_json(self.issued_licenses_file)
        license_found = None
        
        for lic in issued:
            if lic["license_id"] == license_id:
                license_found = lic
                break
        
        if not license_found:
            raise ValueError(f"未找到许可证 {license_id}")
        
        if self.is_revoked(license_id):
            raise ValueError(f"许可证 {license_id} 已经被吊销")
        
        now = datetime.now()
        license_found["status"] = self.STATUS_REVOKED
        license_found["revoked_at"] = now.isoformat()
        license_found["revocation_reason"] = reason
        
        revoked = self._load_json(self.revoked_licenses_file)
        revoked.append({
            "license_id": license_id,
            "customer_id": license_found["customer_id"],
            "customer_name": license_found["customer_name"],
            "revoked_at": now.isoformat(),
            "reason": reason,
            "original_license": license_found
        })
        self._save_json(self.revoked_licenses_file, revoked)
        
        for i, lic in enumerate(issued):
            if lic["license_id"] == license_id:
                issued[i] = license_found
                break
        self._save_json(self.issued_licenses_file, issued)
        
        self._add_audit_log("revoke", {
            "license_id": license_id,
            "reason": reason
        })
        
        return license_found

    def export_audit_report(self, output_file: str = None) -> Path:
        if not output_file:
            output_file = f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        issued = self._load_json(self.issued_licenses_file)
        revoked = self._load_json(self.revoked_licenses_file)
        audit_logs = self._load_json(self.audit_log_file)
        
        report = {
            "report_generated_at": datetime.now().isoformat(),
            "summary": {
                "total_licenses_issued": len(issued),
                "active_licenses": sum(1 for l in issued if l.get("status") == self.STATUS_VALID),
                "inactive_licenses": sum(1 for l in issued if l.get("status") == self.STATUS_INACTIVE),
                "expired_licenses": sum(1 for l in issued if l.get("status") == self.STATUS_EXPIRED),
                "revoked_licenses": len(revoked),
                "total_audit_logs": len(audit_logs)
            },
            "issued_licenses": issued,
            "revoked_licenses": revoked,
            "audit_logs": audit_logs
        }
        
        file_path = self.license_dir / output_file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        self._add_audit_log("export_audit_report", {
            "report_file": output_file
        })
        
        return file_path

    def list_licenses(self, customer_id: str = None, status: str = None) -> List[Dict]:
        issued = self._load_json(self.issued_licenses_file)
        
        if customer_id:
            issued = [lic for lic in issued if lic.get("customer_id") == customer_id]
        
        if status:
            issued = [lic for lic in issued if lic.get("status") == status]
        
        return issued
