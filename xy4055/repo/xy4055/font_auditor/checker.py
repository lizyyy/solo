from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from enum import Enum

from pydantic import BaseModel, Field

from .config import AuditConfig, Client, Project, FontLicense
from .scanner import FontUsageResult


class ViolationType(str, Enum):
    UNKNOWN_FONT = "unknown_font"
    EXPIRED_LICENSE = "expired_license"
    USAGE_MISMATCH = "usage_mismatch"
    REGION_MISMATCH = "region_mismatch"
    HASH_MISMATCH = "hash_mismatch"
    MISSING_ALTERNATIVE = "missing_alternative"
    BLACKLISTED = "blacklisted"
    UNREGISTERED = "unregistered"


class Violation(BaseModel):
    font_name: str
    violation_type: ViolationType
    message: str
    file_path: str
    page: Optional[str] = None
    severity: str = "high"
    details: Dict[str, Any] = Field(default_factory=dict)
    detected_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class Warning(BaseModel):
    font_name: str
    message: str
    file_path: str
    page: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class CheckResult(BaseModel):
    compliant: List[FontUsageResult] = Field(default_factory=list)
    violations: List[Violation] = Field(default_factory=list)
    warnings: List[Warning] = Field(default_factory=list)
    checked_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class FontNameNormalizer:
    @staticmethod
    def normalize(name: str) -> str:
        if not name:
            return name
        
        name = name.strip()
        
        suffixes_to_remove = [
            " Bold", " Italic", " Regular", " Medium", " Light",
            " Black", " Thin", " ExtraBold", " Semibold", " UltraBold",
            " Condensed", " Extended", " Oblique",
            "-Bold", "-Italic", "-Regular", "-Medium", "-Light",
            "-Black", "-Thin", "-ExtraBold", "-Semibold", "-UltraBold",
            "-Condensed", "-Extended", "-Oblique",
        ]
        
        for suffix in suffixes_to_remove:
            if name.endswith(suffix):
                name = name[:-len(suffix)]
                break
        
        name = name.replace(" ", "").replace("-", "").lower()
        
        return name
    
    @staticmethod
    def match(font1: str, font2: str) -> bool:
        norm1 = FontNameNormalizer.normalize(font1)
        norm2 = FontNameNormalizer.normalize(font2)
        return norm1 == norm2 or norm1 in norm2 or norm2 in norm1


class LicenseChecker:
    def __init__(self, config: AuditConfig, project: Optional[Project] = None):
        self.config = config
        self.project = project
        self.client: Optional[Client] = None
        
        if project:
            for client_id, client in config.clients.items():
                if client_id == project.client_id:
                    self.client = client
                    break
    
    def check_font(self, usage: FontUsageResult) -> Tuple[Optional[Violation], Optional[Warning], bool]:
        font_name = usage.font_name
        font_license = self._find_license(font_name)
        
        if self._is_blacklisted(font_name):
            violation = Violation(
                font_name=font_name,
                violation_type=ViolationType.BLACKLISTED,
                message=f"字体 '{font_name}' 在客户黑名单中",
                file_path=usage.file_path,
                page=usage.page,
                severity="high",
                details={
                    "client": self.client.client_name if self.client else "N/A",
                    "font_name": font_name,
                },
            )
            return violation, None, False
        
        if font_license is None:
            if not self._is_default_allowed(font_name):
                violation = Violation(
                    font_name=font_name,
                    violation_type=ViolationType.UNKNOWN_FONT,
                    message=f"字体 '{font_name}' 未在授权台账中注册",
                    file_path=usage.file_path,
                    page=usage.page,
                    severity="high",
                    details={
                        "font_name": font_name,
                        "file_path": usage.file_path,
                    },
                )
                return violation, None, False
        
        if font_license:
            if not self._check_license_expiry(font_license):
                violation = Violation(
                    font_name=font_name,
                    violation_type=ViolationType.EXPIRED_LICENSE,
                    message=f"字体 '{font_name}' 的授权已过期",
                    file_path=usage.file_path,
                    page=usage.page,
                    severity="high",
                    details={
                        "end_date": font_license.end_date,
                        "is_perpetual": font_license.is_perpetual,
                    },
                )
                return violation, None, False
            
            if not self._check_usage_permission(font_license, usage):
                project_usage = self.project.usage_type if self.project else ["unknown"]
                violation = Violation(
                    font_name=font_name,
                    violation_type=ViolationType.USAGE_MISMATCH,
                    message=f"字体 '{font_name}' 的授权不允许当前用途",
                    file_path=usage.file_path,
                    page=usage.page,
                    severity="medium",
                    details={
                        "allowed_usage": font_license.allowed_usage,
                        "project_usage": project_usage,
                    },
                )
                return violation, None, False
            
            if not self._check_region_permission(font_license):
                project_region = self.project.region if self.project else "CN"
                violation = Violation(
                    font_name=font_name,
                    violation_type=ViolationType.REGION_MISMATCH,
                    message=f"字体 '{font_name}' 的授权不允许在当前区域使用",
                    file_path=usage.file_path,
                    page=usage.page,
                    severity="medium",
                    details={
                        "allowed_regions": font_license.allowed_regions,
                        "project_region": project_region,
                    },
                )
                return violation, None, False
        
        warning = None
        if font_license and font_license.font_hash:
            actual_hash = usage.metadata.get("font_hash")
            if actual_hash and actual_hash != font_license.font_hash:
                warning = Warning(
                    font_name=font_name,
                    message=f"字体 '{font_name}' 的哈希值与授权记录不一致，可能是不同版本",
                    file_path=usage.file_path,
                    page=usage.page,
                    details={
                        "expected_hash": font_license.font_hash,
                        "actual_hash": actual_hash,
                    },
                )
        
        return None, warning, True
    
    def _find_license(self, font_name: str) -> Optional[FontLicense]:
        for registered_name, license_info in self.config.fonts.items():
            if FontNameNormalizer.match(registered_name, font_name):
                return license_info
        return None
    
    def _is_blacklisted(self, font_name: str) -> bool:
        blacklist = self.config.default_blacklisted_fonts
        
        if self.client:
            blacklist = self.client.blacklisted_fonts + blacklist
        
        for blacklisted in blacklist:
            if FontNameNormalizer.match(blacklisted, font_name):
                return True
        return False
    
    def _is_default_allowed(self, font_name: str) -> bool:
        for allowed in self.config.default_allowed_fonts:
            if FontNameNormalizer.match(allowed, font_name):
                return True
        return False
    
    def _check_license_expiry(self, license_info: FontLicense) -> bool:
        if license_info.is_perpetual:
            return True
        
        if not license_info.end_date:
            return True
        
        try:
            end_date = datetime.strptime(license_info.end_date, "%Y-%m-%d")
            now = datetime.now()
            return end_date >= now
        except ValueError:
            return True
    
    def _check_usage_permission(self, license_info: FontLicense, usage: FontUsageResult) -> bool:
        if not self.project:
            return True
        
        allowed = license_info.allowed_usage
        project_usage = self.project.usage_type
        
        if not allowed or "all" in [u.lower() for u in allowed]:
            return True
        
        for usage_type in project_usage:
            usage_type_lower = usage_type.lower()
            for allowed_type in allowed:
                allowed_lower = allowed_type.lower()
                if usage_type_lower == allowed_lower or allowed_lower == "all":
                    return True
        
        return False
    
    def _check_region_permission(self, license_info: FontLicense) -> bool:
        if not self.project:
            return True
        
        allowed = license_info.allowed_regions
        project_region = self.project.region.upper()
        
        if not allowed or "GLOBAL" in [r.upper() for r in allowed]:
            return True
        
        for allowed_region in allowed:
            if allowed_region.upper() == project_region or allowed_region.upper() == "GLOBAL":
                return True
        
        return False


def check_font_usage(
    font_usages: List[FontUsageResult],
    config: AuditConfig,
    project: Optional[Project] = None,
) -> CheckResult:
    result = CheckResult()
    checker = LicenseChecker(config, project)
    
    for usage in font_usages:
        violation, warning, is_compliant = checker.check_font(usage)
        
        if violation:
            result.violations.append(violation)
        elif is_compliant:
            result.compliant.append(usage)
        
        if warning:
            result.warnings.append(warning)
    
    return result
