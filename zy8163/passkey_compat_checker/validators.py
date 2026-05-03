"""
Validators for Passkey/FIDO2 compatibility checks
"""

import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from .models import (
    RelyingPartyConfig,
    BrowserSupport,
    UserInfo,
    AuthenticatorLogEntry,
    CredentialState,
    Issue,
    IssueSeverity,
    IssueCategory,
    CounterRegression,
    CompatibilityReport,
)


# COSE algorithm identifiers
COSE_ALGORITHMS = {
    -7: 'ES256 (ECDSA w/ SHA-256)',
    -8: 'EdDSA',
    -35: 'ES384',
    -36: 'ES512',
    -37: 'PS256 (RSASSA-PSS w/ SHA-256)',
    -38: 'PS384',
    -39: 'PS512',
    -257: 'RS256 (RSASSA-PKCS1-v1_5 w/ SHA-256)',
    -258: 'RS384',
    -259: 'RS512',
    -65535: 'RS1',
}


class CompatibilityValidator:
    """Core validator for Passkey/FIDO2 compatibility checks"""
    
    def __init__(
        self,
        rp_config: RelyingPartyConfig,
        browser_matrix: List[BrowserSupport],
        users: List[UserInfo],
        logs: List[AuthenticatorLogEntry],
    ):
        self.rp_config = rp_config
        self.browser_matrix = browser_matrix
        self.users = users
        self.logs = logs
        self.credential_states: Dict[str, CredentialState] = {}
        self.issues: List[Issue] = []
        self.issue_counter = 0
    
    def validate_all(self) -> CompatibilityReport:
        """Run all validation checks"""
        self._build_credential_states()
        self._validate_rp_ids()
        self._validate_resident_key()
        self._validate_uv_up()
        self._validate_algorithms()
        self._validate_sign_counters()
        self._detect_cross_device_sync_risks()
        
        return self._generate_report()
    
    def _build_credential_states(self):
        """Build credential states from log entries"""
        credential_logs: Dict[str, List[AuthenticatorLogEntry]] = defaultdict(list)
        for log in self.logs:
            if log.credential_id:
                credential_logs[log.credential_id].append(log)
        
        for cred_id, logs in credential_logs.items():
            sorted_logs = sorted(logs, key=lambda x: x.timestamp)
            
            state = CredentialState(
                credential_id=cred_id,
                user_id=sorted_logs[0].user_id,
                rp_id=sorted_logs[0].rp_id,
            )
            
            sign_counts: Dict[str, List[Tuple[int, datetime]]] = defaultdict(list)
            all_devices = set()
            all_browsers = set()
            
            for log in sorted_logs:
                sign_counts[log.device_id].append((log.sign_count, log.timestamp))
                all_devices.add(log.device_id)
                all_browsers.add(log.browser)
                state.timestamps.append(log.timestamp)
                
                if state.resident_key is None:
                    state.resident_key = log.resident_key
                if state.user_verified is None:
                    state.user_verified = log.user_verified
                if state.algorithm is None:
                    state.algorithm = log.algorithm
            
            state.sign_counts = {
                device: max(counts, key=lambda x: x[1])[0]
                for device, counts in sign_counts.items()
            }
            state.latest_sign_count = max(state.sign_counts.values()) if state.sign_counts else 0
            state.devices = list(all_devices)
            state.browsers = list(all_browsers)
            
            self.credential_states[cred_id] = state
    
    def _validate_rp_ids(self):
        """Validate RP IDs against expected config"""
        expected_rp_id = self.rp_config.rp_id
        invalid_credentials = []
        invalid_users = set()
        
        for cred_id, state in self.credential_states.items():
            if state.rp_id != expected_rp_id:
                invalid_credentials.append(cred_id)
                invalid_users.add(state.user_id)
        
        if invalid_credentials:
            self._add_issue(
                category=IssueCategory.RP_ID,
                severity=IssueSeverity.HIGH,
                title="Mismatched RP ID",
                description=f"Found credentials with RP ID different from expected '{expected_rp_id}'. "
                           f"This can cause authentication failures across different origins.",
                affected_credential_ids=invalid_credentials,
                affected_user_ids=list(invalid_users),
            )
    
    def _validate_resident_key(self):
        """Validate resident key requirements"""
        if not self.rp_config.resident_key_required:
            return
        
        non_resident_credentials = []
        affected_users = set()
        
        for cred_id, state in self.credential_states.items():
            if state.resident_key is False:
                non_resident_credentials.append(cred_id)
                affected_users.add(state.user_id)
        
        if non_resident_credentials:
            self._add_issue(
                category=IssueCategory.RESIDENT_KEY,
                severity=IssueSeverity.MEDIUM,
                title="Non-Resident Key Credentials",
                description="RP requires resident keys (discoverable credentials), but found "
                           f"{len(non_resident_credentials)} credentials without resident key flag. "
                           "These credentials may not work with username-less authentication.",
                affected_credential_ids=non_resident_credentials,
                affected_user_ids=list(affected_users),
            )
    
    def _validate_uv_up(self):
        """Validate user verification and presence flags"""
        uv_required = self.rp_config.user_verification_required
        
        credentials_without_uv = []
        credentials_without_up = []
        affected_users_uv = set()
        affected_users_up = set()
        
        for cred_id, state in self.credential_states.items():
            if uv_required and state.user_verified is False:
                credentials_without_uv.append(cred_id)
                affected_users_uv.add(state.user_id)
        
        for log in self.logs:
            if not log.user_present:
                credentials_without_up.append(log.credential_id)
                affected_users_up.add(log.user_id)
        
        if credentials_without_uv:
            self._add_issue(
                category=IssueCategory.UV_UP,
                severity=IssueSeverity.HIGH,
                title="Missing User Verification",
                description=f"RP requires user verification (UV), but found {len(credentials_without_uv)} "
                           "credentials without UV flag. This indicates authentication may have bypassed "
                           "biometric/PIN verification.",
                affected_credential_ids=list(set(credentials_without_uv)),
                affected_user_ids=list(affected_users_uv),
            )
        
        if credentials_without_up:
            self._add_issue(
                category=IssueCategory.UV_UP,
                severity=IssueSeverity.MEDIUM,
                title="Missing User Presence",
                description=f"Found {len(credentials_without_up)} authentications without user presence (UP) flag. "
                           "User presence is typically required for FIDO2 operations.",
                affected_credential_ids=list(set(credentials_without_up)),
                affected_user_ids=list(affected_users_up),
            )
    
    def _validate_algorithms(self):
        """Validate algorithm support"""
        supported_algorithms = set(self.rp_config.supported_algorithms)
        algorithm_usage: Dict[int, int] = defaultdict(int)
        unknown_algorithms: Dict[int, List[str]] = defaultdict(list)
        unsupported_algorithms: Dict[int, List[str]] = defaultdict(list)
        
        for log in self.logs:
            algorithm_usage[log.algorithm] += 1
            
            if log.algorithm not in COSE_ALGORITHMS:
                unknown_algorithms[log.algorithm].append(log.credential_id)
            
            if log.algorithm not in supported_algorithms:
                unsupported_algorithms[log.algorithm].append(log.credential_id)
        
        if unknown_algorithms:
            for alg, creds in unknown_algorithms.items():
                unique_creds = list(set(creds))
                self._add_issue(
                    category=IssueCategory.UNKNOWN_ALGORITHM,
                    severity=IssueSeverity.MEDIUM,
                    title=f"Unknown Algorithm: {alg}",
                    description=f"Found credentials using unknown COSE algorithm {alg}. "
                               "This may indicate a non-standard authenticator or misconfiguration. "
                               "The algorithm is not in the standard COSE registry.",
                    affected_credential_ids=unique_creds,
                    additional_info={
                        'algorithm': alg,
                        'occurrences': len(creds),
                        'unique_credentials': len(unique_creds),
                    },
                )
        
        for alg, creds in unsupported_algorithms.items():
            if alg in unknown_algorithms:
                continue
            
            unique_creds = list(set(creds))
            alg_name = COSE_ALGORITHMS.get(alg, str(alg))
            self._add_issue(
                category=IssueCategory.ALGORITHM,
                severity=IssueSeverity.HIGH,
                title=f"Unsupported Algorithm: {alg_name}",
                description=f"RP supports algorithms {supported_algorithms}, but found credentials "
                           f"using {alg_name}. This may cause authentication failures or fallback issues.",
                affected_credential_ids=unique_creds,
                additional_info={
                    'algorithm': alg,
                    'algorithm_name': alg_name,
                    'occurrences': len(creds),
                    'unique_credentials': len(unique_creds),
                },
            )
    
    def _validate_sign_counters(self):
        """Validate signature counters for regression"""
        all_regressions: List[CounterRegression] = []
        
        for cred_id, state in self.credential_states.items():
            regressions = self._check_counter_regressions(cred_id)
            all_regressions.extend(regressions)
        
        if all_regressions:
            cross_device_regressions = [r for r in all_regressions if r.is_cross_device]
            same_device_regressions = [r for r in all_regressions if not r.is_cross_device]
            
            if same_device_regressions:
                self._add_issue(
                    category=IssueCategory.COUNTER,
                    severity=IssueSeverity.CRITICAL,
                    title="Signature Counter Regression (Same Device)",
                    description=f"Found {len(same_device_regressions)} signature counter regressions on the same device. "
                               "This is a strong indicator of cloned credentials or authenticator compromise. "
                               "Each authentication should strictly increase the signature counter.",
                    affected_credential_ids=list(set([r.credential_id for r in same_device_regressions])),
                    additional_info={
                        'regression_count': len(same_device_regressions),
                        'details': [
                            {
                                'credential_id': r.credential_id,
                                'device': r.from_device,
                                'from_count': r.from_count,
                                'to_count': r.to_count,
                                'delta': r.from_count - r.to_count,
                            }
                            for r in same_device_regressions
                        ],
                    },
                )
            
            if cross_device_regressions:
                self._add_issue(
                    category=IssueCategory.COUNTER,
                    severity=IssueSeverity.HIGH,
                    title="Signature Counter Regression (Cross-Device)",
                    description=f"Found {len(cross_device_regressions)} signature counter regressions across different devices. "
                               "This may indicate credential synchronization issues or potential cloning. "
                               f"Credentials appeared on {len(set([r.from_device for r in cross_device_regressions]))} different devices.",
                    affected_credential_ids=list(set([r.credential_id for r in cross_device_regressions])),
                    affected_devices=list(set(
                        [r.from_device for r in cross_device_regressions] +
                        [r.to_device for r in cross_device_regressions]
                    )),
                    additional_info={
                        'regression_count': len(cross_device_regressions),
                        'details': [
                            {
                                'credential_id': r.credential_id,
                                'from_device': r.from_device,
                                'to_device': r.to_device,
                                'from_count': r.from_count,
                                'to_count': r.to_count,
                                'delta': r.from_count - r.to_count,
                            }
                            for r in cross_device_regressions
                        ],
                    },
                )
    
    def _check_counter_regressions(self, credential_id: str) -> List[CounterRegression]:
        """Check for counter regressions in a credential's history"""
        regressions: List[CounterRegression] = []
        state = self.credential_states.get(credential_id)
        
        if not state or len(state.sign_counts) < 1:
            return regressions
        
        credential_logs = [
            log for log in self.logs if log.credential_id == credential_id
        ]
        credential_logs.sort(key=lambda x: x.timestamp)
        
        for i in range(len(credential_logs) - 1):
            current = credential_logs[i]
            next_log = credential_logs[i + 1]
            
            if next_log.sign_count < current.sign_count:
                is_cross_device = current.device_id != next_log.device_id
                regressions.append(CounterRegression(
                    credential_id=credential_id,
                    from_device=current.device_id,
                    to_device=next_log.device_id,
                    from_count=current.sign_count,
                    to_count=next_log.sign_count,
                    from_timestamp=current.timestamp,
                    to_timestamp=next_log.timestamp,
                    is_cross_device=is_cross_device,
                ))
        
        if len(state.devices) > 1:
            devices = list(state.sign_counts.keys())
            for i in range(len(devices)):
                for j in range(i + 1, len(devices)):
                    device1 = devices[i]
                    device2 = devices[j]
                    count1 = state.sign_counts[device1]
                    count2 = state.sign_counts[device2]
                    
                    if count1 != count2:
                        device_logs1 = [
                            log for log in credential_logs if log.device_id == device1
                        ]
                        device_logs2 = [
                            log for log in credential_logs if log.device_id == device2
                        ]
                        
                        if device_logs1 and device_logs2:
                            latest1 = max(device_logs1, key=lambda x: x.timestamp)
                            latest2 = max(device_logs2, key=lambda x: x.timestamp)
                            
                            if latest2.timestamp > latest1.timestamp and latest2.sign_count < latest1.sign_count:
                                regressions.append(CounterRegression(
                                    credential_id=credential_id,
                                    from_device=device1,
                                    to_device=device2,
                                    from_count=latest1.sign_count,
                                    to_count=latest2.sign_count,
                                    from_timestamp=latest1.timestamp,
                                    to_timestamp=latest2.timestamp,
                                    is_cross_device=True,
                                ))
        
        return regressions
    
    def _detect_cross_device_sync_risks(self):
        """Detect potential cross-device synchronization risks"""
        if self.rp_config.cross_device_allowed:
            return
        
        cross_device_credentials = []
        affected_users = set()
        
        for cred_id, state in self.credential_states.items():
            if len(state.devices) > 1:
                cross_device_credentials.append(cred_id)
                affected_users.add(state.user_id)
        
        if cross_device_credentials:
            self._add_issue(
                category=IssueCategory.SYNC_RISK,
                severity=IssueSeverity.MEDIUM,
                title="Cross-Device Sync Detected",
                description=f"RP does not allow cross-device sync, but found {len(cross_device_credentials)} "
                           f"credentials used across {len(set().union(*[self.credential_states[c].devices for c in cross_device_credentials]))} devices. "
                           "This may indicate platform sync (e.g., iCloud Keychain, Google Password Manager) "
                           "or credential sharing.",
                affected_credential_ids=cross_device_credentials,
                affected_user_ids=list(affected_users),
                additional_info={
                    'credentials_with_multiple_devices': len(cross_device_credentials),
                },
            )
    
    def _add_issue(
        self,
        category: IssueCategory,
        severity: IssueSeverity,
        title: str,
        description: str,
        affected_credential_ids: List[str] = None,
        affected_user_ids: List[str] = None,
        affected_devices: List[str] = None,
        additional_info: Dict[str, Any] = None,
        timestamp: datetime = None,
    ):
        """Add an issue to the list"""
        self.issue_counter += 1
        issue_id = f"ISS-{self.issue_counter:04d}"
        
        issue = Issue(
            issue_id=issue_id,
            category=category,
            severity=severity,
            title=title,
            description=description,
            affected_credential_ids=affected_credential_ids or [],
            affected_user_ids=affected_user_ids or [],
            affected_devices=affected_devices or [],
            additional_info=additional_info or {},
            timestamp=timestamp or datetime.now(),
        )
        
        self.issues.append(issue)
    
    def _generate_report(self) -> CompatibilityReport:
        """Generate final compatibility report"""
        algorithm_usage: Dict[int, int] = defaultdict(int)
        for log in self.logs:
            algorithm_usage[log.algorithm] += 1
        
        unique_users = set(log.user_id for log in self.logs)
        unique_credentials = set(log.credential_id for log in self.logs if log.credential_id)
        
        severity_counts = defaultdict(int)
        category_counts = defaultdict(int)
        for issue in self.issues:
            severity_counts[issue.severity.value] += 1
            category_counts[issue.category.value] += 1
        
        browser_stats = defaultdict(lambda: {'count': 0, 'credentials': set()})
        for log in self.logs:
            browser_stats[log.browser]['count'] += 1
            browser_stats[log.browser]['credentials'].add(log.credential_id)
        
        browser_compatibility = {}
        for browser, stats in browser_stats.items():
            browser_support = [
                b for b in self.browser_matrix
                if b.browser.lower() == browser.lower()
            ]
            browser_compatibility[browser] = {
                'usage_count': stats['count'],
                'unique_credentials': len(stats['credentials']),
                'supported': any(b.fido2_supported for b in browser_support) if browser_support else None,
                'resident_key_supported': any(b.resident_key_supported for b in browser_support) if browser_support else None,
                'uv_supported': any(b.user_verification_supported for b in browser_support) if browser_support else None,
            }
        
        return CompatibilityReport(
            total_users=len(unique_users),
            total_credentials=len(unique_credentials),
            total_log_entries=len(self.logs),
            issues=self.issues,
            summary={
                'severity_distribution': dict(severity_counts),
                'category_distribution': dict(category_counts),
                'total_issues': len(self.issues),
            },
            browser_compatibility=browser_compatibility,
            algorithm_usage=dict(algorithm_usage),
            generated_at=datetime.now(),
        )
