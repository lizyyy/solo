from typing import List, Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum

class RiskLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"

    @classmethod
    def from_string(cls, level: str) -> 'RiskLevel':
        mapping = {
            "critical": cls.CRITICAL,
            "high": cls.HIGH,
            "medium": cls.MEDIUM,
            "low": cls.LOW
        }
        return mapping.get(level.lower(), cls.UNKNOWN)

    def get_priority(self) -> int:
        priorities = {
            "critical": 4,
            "high": 3,
            "medium": 2,
            "low": 1,
            "unknown": 0
        }
        return priorities.get(self.value, 0)

@dataclass
class RiskRule:
    id: str
    name: str
    description: str
    level: RiskLevel
    check_function: Callable[[Any], bool]
    enabled: bool = True

@dataclass
class RiskResult:
    rule_id: str
    rule_name: str
    risk_level: RiskLevel
    triggered: bool
    reason: str

class RiskEngine:
    def __init__(self):
        self.rules: List[RiskRule] = []
        self._register_default_rules()

    def _register_default_rules(self) -> None:
        self._register_executable_rules()
        self._register_signature_rules()
        self._register_file_type_rules()
        self._register_hash_rules()

    def _register_executable_rules(self) -> None:
        self.rules.append(RiskRule(
            id="EXEC-001",
            name="Mach-O Binary Detected",
            description="File is a Mach-O executable binary",
            level=RiskLevel.MEDIUM,
            check_function=lambda f: "Mach-O" in f.file_type
        ))
        self.rules.append(RiskRule(
            id="EXEC-002",
            name="ELF Binary Detected",
            description="File is an ELF executable binary",
            level=RiskLevel.MEDIUM,
            check_function=lambda f: "ELF" in f.file_type
        ))
        self.rules.append(RiskRule(
            id="EXEC-003",
            name="PE/COFF Binary Detected",
            description="File is a Windows PE/COFF executable",
            level=RiskLevel.HIGH,
            check_function=lambda f: "PE/COFF" in f.file_type
        ))
        self.rules.append(RiskRule(
            id="EXEC-004",
            name="WebAssembly Binary",
            description="File is a WebAssembly binary",
            level=RiskLevel.LOW,
            check_function=lambda f: "WebAssembly" in f.file_type
        ))
        self.rules.append(RiskRule(
            id="EXEC-005",
            name="Java Class File",
            description="File is a Java class file",
            level=RiskLevel.LOW,
            check_function=lambda f: "Java Class" in f.file_type
        ))

    def _register_signature_rules(self) -> None:
        self.rules.append(RiskRule(
            id="SIG-001",
            name="Unsigned Executable",
            description="Executable binary has no code signature",
            level=RiskLevel.CRITICAL,
            check_function=lambda f: self._is_executable(f) and not f.signature_info.get("has_signature", False)
        ))
        self.rules.append(RiskRule(
            id="SIG-002",
            name="Invalid Signature",
            description="Code signature verification failed",
            level=RiskLevel.HIGH,
            check_function=lambda f: f.signature_info.get("has_signature", False) and not f.signature_info.get("signature_valid", False)
        ))
        self.rules.append(RiskRule(
            id="SIG-003",
            name="Ad-hoc Signed",
            description="Binary is ad-hoc signed (no developer identity)",
            level=RiskLevel.HIGH,
            check_function=lambda f: self._is_adhoc_signed(f)
        ))
        self.rules.append(RiskRule(
            id="SIG-004",
            name="Unknown Signing Authority",
            description="Signing authority not in known trusted list",
            level=RiskLevel.MEDIUM,
            check_function=lambda f: self._has_unknown_authority(f)
        ))

    def _register_file_type_rules(self) -> None:
        self.rules.append(RiskRule(
            id="TYPE-001",
            name="Unknown File Type",
            description="File type could not be identified by magic bytes",
            level=RiskLevel.MEDIUM,
            check_function=lambda f: f.file_type == "Unknown" and f.file_size > 0
        ))
        self.rules.append(RiskRule(
            id="TYPE-002",
            name="Mismatched Extension",
            description="File extension does not match detected file type",
            level=RiskLevel.MEDIUM,
            check_function=lambda f: self._extension_mismatch(f)
        ))
        self.rules.append(RiskRule(
            id="TYPE-003",
            name="Empty File",
            description="File has zero bytes",
            level=RiskLevel.LOW,
            check_function=lambda f: f.file_size == 0
        ))
        self.rules.append(RiskRule(
            id="TYPE-004",
            name="Encrypted/Compressed File",
            description="File appears to be encrypted or heavily compressed",
            level=RiskLevel.MEDIUM,
            check_function=lambda f: self._is_likely_encrypted(f)
        ))

    def _register_hash_rules(self) -> None:
        pass

    def _is_executable(self, file_info: Any) -> bool:
        executable_types = ["Mach-O", "ELF", "PE/COFF"]
        return any(etype in file_info.file_type for etype in executable_types)

    def _is_adhoc_signed(self, file_info: Any) -> bool:
        authority = file_info.signature_info.get("authority", [])
        if not authority:
            return False
        return any("adhoc" in str(auth).lower() for auth in authority) or len(authority) == 0

    def _has_unknown_authority(self, file_info: Any) -> bool:
        authority = file_info.signature_info.get("authority", [])
        if not authority:
            return False
        trusted_keywords = ["Apple", "Developer ID", "Distribution", "Mac App Store"]
        return not any(keyword in str(auth) for auth in authority for keyword in trusted_keywords)

    def _extension_mismatch(self, file_info: Any) -> bool:
        ext_map = {
            'Mach-O': ['.app', '.dylib', '.o', '.so', '.a', '.framework', ''],
            'ELF': ['.so', '.o', '.a', ''],
            'PE/COFF': ['.exe', '.dll', '.ocx', '.sys', '.scr'],
            'PNG Image': ['.png'],
            'JPEG Image': ['.jpg', '.jpeg', '.jpe'],
            'GIF Image': ['.gif'],
            'ZIP Archive': ['.zip', '.jar', '.war', '.ear', '.ipa', '.apk'],
            'PDF Document': ['.pdf'],
        }
        
        import os
        ext = os.path.splitext(file_info.file_name)[1].lower()
        
        for ftype, exts in ext_map.items():
            if ftype in file_info.file_type:
                return ext not in exts
        
        return False

    def _is_likely_encrypted(self, file_info: Any) -> bool:
        if file_info.file_type != "Unknown":
            return False
        if file_info.file_size < 64:
            return False
        return True

    def evaluate_file(self, file_info: Any) -> Dict[str, Any]:
        results: List[RiskResult] = []
        
        for rule in self.rules:
            if not rule.enabled:
                continue
            try:
                triggered = rule.check_function(file_info)
                if triggered:
                    results.append(RiskResult(
                        rule_id=rule.id,
                        rule_name=rule.name,
                        risk_level=rule.level,
                        triggered=True,
                        reason=rule.description
                    ))
            except Exception:
                continue
        
        overall_level = self._calculate_overall_risk(results)
        
        return {
            "overall_risk": overall_level.value,
            "risk_results": [
                {
                    "rule_id": r.rule_id,
                    "rule_name": r.rule_name,
                    "risk_level": r.risk_level.value,
                    "reason": r.reason
                } for r in results
            ],
            "risk_reasons": [r.reason for r in results]
        }

    def _calculate_overall_risk(self, results: List[RiskResult]) -> RiskLevel:
        if not results:
            return RiskLevel.UNKNOWN
        
        max_priority = -1
        overall_level = RiskLevel.UNKNOWN
        
        for result in results:
            priority = result.risk_level.get_priority()
            if priority > max_priority:
                max_priority = priority
                overall_level = result.risk_level
        
        return overall_level

    def add_custom_rule(self, rule: RiskRule) -> None:
        self.rules.append(rule)

    def disable_rule(self, rule_id: str) -> bool:
        for rule in self.rules:
            if rule.id == rule_id:
                rule.enabled = False
                return True
        return False

    def enable_rule(self, rule_id: str) -> bool:
        for rule in self.rules:
            if rule.id == rule_id:
                rule.enabled = True
                return True
        return False

    def get_rule_descriptions(self) -> List[Dict[str, str]]:
        return [
            {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "level": rule.level.value,
                "enabled": str(rule.enabled)
            }
            for rule in sorted(self.rules, key=lambda r: r.id)
        ]
