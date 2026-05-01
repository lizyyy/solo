import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .config import Config
from .manifest import PackageManifest
from .utils import calculate_sha256


@dataclass
class ValidationIssue:
    code: str
    message: str
    severity: str = "error"
    details: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "code": self.code,
            "message": self.message,
            "severity": self.severity,
            "details": self.details
        }


@dataclass
class ValidationResult:
    valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    package_dir: Optional[Path] = None
    manifest: Optional[PackageManifest] = None
    
    def has_errors(self) -> bool:
        return any(i.severity == "error" for i in self.issues)
    
    def has_warnings(self) -> bool:
        return any(i.severity == "warning" for i in self.issues)
    
    def to_dict(self) -> Dict:
        return {
            "valid": self.valid,
            "issues": [i.to_dict() for i in self.issues],
            "package_dir": str(self.package_dir) if self.package_dir else None,
            "manifest": self.manifest.to_dict() if self.manifest else None
        }


class PackageValidator:
    def __init__(self, config: Config):
        self.config = config
    
    def validate_package(self, package_dir: Path) -> ValidationResult:
        result = ValidationResult(valid=True, package_dir=package_dir)
        
        manifest_path = package_dir / "manifest.json"
        if not manifest_path.exists():
            result.issues.append(ValidationIssue(
                code="MISSING_MANIFEST",
                message="manifest.json 不存在",
                details={"path": str(manifest_path)}
            ))
            result.valid = False
            return result
        
        try:
            manifest = PackageManifest.from_file(manifest_path)
            result.manifest = manifest
        except Exception as e:
            result.issues.append(ValidationIssue(
                code="INVALID_MANIFEST",
                message=f"manifest.json 解析失败: {e}",
                details={"error": str(e)}
            ))
            result.valid = False
            return result
        
        self._validate_manifest_version(manifest, result)
        self._validate_device_models(manifest, result)
        self._validate_files(package_dir, manifest, result)
        self._validate_calibration_validity(manifest, result)
        self._validate_signature(manifest, result)
        
        result.valid = not result.has_errors()
        return result
    
    def _validate_manifest_version(self, manifest: PackageManifest, result: ValidationResult):
        if manifest.manifest_version != self.config.manifest_version:
            result.issues.append(ValidationIssue(
                code="MANIFEST_VERSION_MISMATCH",
                message=f"Manifest版本不兼容: 期望 {self.config.manifest_version}, 实际 {manifest.manifest_version}",
                severity="error",
                details={
                    "expected": self.config.manifest_version,
                    "actual": manifest.manifest_version
                }
            ))
    
    def _validate_device_models(self, manifest: PackageManifest, result: ValidationResult):
        allowed_models = self.config.device_models
        target_models = manifest.target_device_models
        
        for model in target_models:
            if allowed_models and model not in allowed_models:
                result.issues.append(ValidationIssue(
                    code="UNSUPPORTED_DEVICE_MODEL",
                    message=f"不支持的设备型号: {model}",
                    severity="error",
                    details={
                        "model": model,
                        "allowed_models": allowed_models
                    }
                ))
    
    def _validate_files(self, package_dir: Path, manifest: PackageManifest, result: ValidationResult):
        files_to_check = manifest.get_all_files()
        
        for file_entry in files_to_check:
            file_path = package_dir / file_entry.filename
            
            if not file_path.exists():
                result.issues.append(ValidationIssue(
                    code="MISSING_FILE",
                    message=f"文件不存在: {file_entry.filename}",
                    severity="error",
                    details={
                        "filename": file_entry.filename,
                        "expected_path": str(file_path)
                    }
                ))
                continue
            
            actual_hash = calculate_sha256(file_path)
            if actual_hash != file_entry.sha256:
                result.issues.append(ValidationIssue(
                    code="HASH_MISMATCH",
                    message=f"文件哈希不匹配: {file_entry.filename}",
                    severity="error",
                    details={
                        "filename": file_entry.filename,
                        "expected_hash": file_entry.sha256,
                        "actual_hash": actual_hash
                    }
                ))
            
            actual_size = file_path.stat().st_size
            if file_entry.size > 0 and actual_size != file_entry.size:
                result.issues.append(ValidationIssue(
                    code="SIZE_MISMATCH",
                    message=f"文件大小不匹配: {file_entry.filename}",
                    severity="warning",
                    details={
                        "filename": file_entry.filename,
                        "expected_size": file_entry.size,
                        "actual_size": actual_size
                    }
                ))
    
    def _validate_calibration_validity(self, manifest: PackageManifest, result: ValidationResult):
        if not manifest.calibration or not manifest.calibration_date:
            return
        
        calibration_date = manifest.calibration_date
        validity_days = manifest.calibration_validity_days or self.config.calibration_validity_days
        expiry_date = calibration_date + timedelta(days=validity_days)
        now = datetime.now(timezone.utc)
        
        if expiry_date.tzinfo is None:
            expiry_date = expiry_date.replace(tzinfo=timezone.utc)
        
        if now > expiry_date:
            result.issues.append(ValidationIssue(
                code="CALIBRATION_EXPIRED",
                message=f"校准包已过期: 过期日期 {expiry_date}",
                severity="error",
                details={
                    "calibration_date": calibration_date.isoformat(),
                    "expiry_date": expiry_date.isoformat(),
                    "validity_days": validity_days
                }
            ))
        else:
            days_remaining = (expiry_date - now).days
            if days_remaining < 30:
                result.issues.append(ValidationIssue(
                    code="CALIBRATION_EXPIRING_SOON",
                    message=f"校准包即将过期: 剩余 {days_remaining} 天",
                    severity="warning",
                    details={
                        "expiry_date": expiry_date.isoformat(),
                        "days_remaining": days_remaining
                    }
                ))
    
    def _validate_signature(self, manifest: PackageManifest, result: ValidationResult):
        if not manifest.signature:
            result.issues.append(ValidationIssue(
                code="NO_SIGNATURE",
                message="Manifest未签名",
                severity="warning"
            ))
            return
        
        if not self.config.public_key:
            result.issues.append(ValidationIssue(
                code="NO_PUBLIC_KEY",
                message="配置中未设置公钥，无法验证签名",
                severity="warning"
            ))
            return
        
        try:
            from .signature import SignatureVerifier
            verifier = SignatureVerifier(public_key_pem=self.config.public_key)
            
            valid = verifier.verify_manifest_signature(
                manifest.to_dict(),
                manifest.signature
            )
            
            if not valid:
                result.issues.append(ValidationIssue(
                    code="INVALID_SIGNATURE",
                    message="Manifest签名验证失败",
                    severity="error"
                ))
        except Exception as e:
            result.issues.append(ValidationIssue(
                code="SIGNATURE_VERIFICATION_ERROR",
                message=f"签名验证过程出错: {e}",
                severity="warning",
                details={"error": str(e)}
            ))
