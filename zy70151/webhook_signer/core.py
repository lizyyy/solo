import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any


class SignatureStatus(Enum):
    VALID = "valid"
    INVALID = "invalid"
    EXPIRED = "expired"
    REPLAYED = "replayed"
    IDEMPOTENT_CONFLICT = "idempotent_conflict"


class KeyStatus(Enum):
    ACTIVE = "active"
    ROTATING = "rotating"
    DEPRECATED = "deprecated"
    REVOKED = "revoked"


@dataclass
class SigningKey:
    key_id: str
    secret: str
    status: KeyStatus
    created_at: datetime
    expires_at: Optional[datetime] = None


@dataclass
class SignatureResult:
    success: bool
    status: SignatureStatus
    key_id: Optional[str]
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class IdempotentRecord:
    idempotency_key: str
    request_hash: str
    amount: Optional[float]
    quantity: Optional[int]
    slots: Optional[int]
    created_at: datetime
    result: Dict[str, Any]


@dataclass
class AuditLog:
    event_id: str
    timestamp: datetime
    action: str
    status: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DeveloperReport:
    total_requests: int = 0
    valid_signatures: int = 0
    invalid_signatures: int = 0
    replay_attacks: int = 0
    idempotent_conflicts: int = 0
    rotated_key_usage: int = 0
    deprecated_key_usage: int = 0
    recent_audits: List[AuditLog] = field(default_factory=list)


class WebhookSignatureManager:
    def __init__(self, replay_window_seconds: int = 300, rotation_grace_seconds: int = 3600):
        self.keys: Dict[str, SigningKey] = {}
        self.nonce_cache: Dict[str, datetime] = {}
        self.idempotent_cache: Dict[str, IdempotentRecord] = {}
        self.audit_logs: List[AuditLog] = []
        self.replay_window_seconds = replay_window_seconds
        self.rotation_grace_seconds = rotation_grace_seconds

    def add_key(self, secret: str, status: KeyStatus = KeyStatus.ACTIVE, key_id: Optional[str] = None, expires_at: Optional[datetime] = None) -> str:
        key_id = key_id or f"key_{uuid.uuid4().hex[:8]}"
        self.keys[key_id] = SigningKey(
            key_id=key_id,
            secret=secret,
            status=status,
            created_at=datetime.now(),
            expires_at=expires_at
        )
        self._audit("key_added", "success", f"密钥 {key_id} 已添加，状态: {status.value}")
        return key_id

    def rotate_key(self, old_key_id: str, new_secret: str) -> str:
        if old_key_id not in self.keys:
            raise ValueError(f"密钥 {old_key_id} 不存在")

        old_key = self.keys[old_key_id]
        old_key.status = KeyStatus.ROTATING
        old_key.expires_at = datetime.now() + timedelta(seconds=self.rotation_grace_seconds)

        new_key_id = self.add_key(new_secret, KeyStatus.ACTIVE)

        self._audit("key_rotated", "success", f"密钥轮换完成: {old_key_id} -> {new_key_id}，过渡期 {self.rotation_grace_seconds} 秒")
        return new_key_id

    def deprecate_key(self, key_id: str):
        if key_id not in self.keys:
            raise ValueError(f"密钥 {key_id} 不存在")
        self.keys[key_id].status = KeyStatus.DEPRECATED
        self._audit("key_deprecated", "success", f"密钥 {key_id} 已标记为废弃")

    def revoke_key(self, key_id: str):
        if key_id not in self.keys:
            raise ValueError(f"密钥 {key_id} 不存在")
        self.keys[key_id].status = KeyStatus.REVOKED
        self._audit("key_revoked", "success", f"密钥 {key_id} 已吊销")

    def get_valid_keys(self) -> List[SigningKey]:
        now = datetime.now()
        valid_keys = []
        for key in self.keys.values():
            if key.status == KeyStatus.REVOKED:
                continue
            if key.expires_at and key.expires_at < now:
                continue
            valid_keys.append(key)
        return valid_keys

    def _compute_signature(self, secret: str, payload: str, timestamp: str, nonce: str) -> str:
        message = f"{timestamp}.{nonce}.{payload}"
        return hmac.new(
            secret.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

    def _verify_signature(self, key: SigningKey, signature: str, payload: str, timestamp: str, nonce: str) -> bool:
        expected = self._compute_signature(key.secret, payload, timestamp, nonce)
        return hmac.compare_digest(expected, signature)

    def _check_replay(self, nonce: str, timestamp_str: str) -> SignatureResult:
        try:
            timestamp = int(timestamp_str)
        except ValueError:
            return SignatureResult(False, SignatureStatus.INVALID, None, "时间戳格式无效")

        now = int(time.time())
        if abs(now - timestamp) > self.replay_window_seconds:
            return SignatureResult(False, SignatureStatus.EXPIRED, None, f"请求已过期，时间窗口 {self.replay_window_seconds} 秒")

        if nonce in self.nonce_cache:
            return SignatureResult(False, SignatureStatus.REPLAYED, None, "检测到重放攻击，该请求已被处理过")

        self.nonce_cache[nonce] = datetime.now()
        return SignatureResult(True, SignatureStatus.VALID, None, "重放检查通过")

    def _cleanup_nonce_cache(self):
        cutoff = datetime.now() - timedelta(seconds=self.replay_window_seconds * 2)
        expired = [k for k, v in self.nonce_cache.items() if v < cutoff]
        for k in expired:
            del self.nonce_cache[k]

    def _check_idempotency(self, idempotency_key: Optional[str], payload: str, amount: Optional[float], quantity: Optional[int], slots: Optional[int]) -> Optional[SignatureResult]:
        if not idempotency_key:
            return None

        request_hash = hashlib.sha256(payload.encode('utf-8')).hexdigest()

        if idempotency_key in self.idempotent_cache:
            record = self.idempotent_cache[idempotency_key]

            if record.request_hash != request_hash:
                return SignatureResult(
                    False,
                    SignatureStatus.IDEMPOTENT_CONFLICT,
                    None,
                    "幂等冲突：相同幂等键但请求内容不一致",
                    {"stored_hash": record.request_hash, "current_hash": request_hash}
                )

            amount_ok = (amount is None and record.amount is None) or (amount == record.amount)
            quantity_ok = (quantity is None and record.quantity is None) or (quantity == record.quantity)
            slots_ok = (slots is None and record.slots is None) or (slots == record.slots)

            if not (amount_ok and quantity_ok and slots_ok):
                return SignatureResult(
                    False,
                    SignatureStatus.IDEMPOTENT_CONFLICT,
                    None,
                    "幂等冲突：金额/数量/名额口径不一致",
                    {
                        "stored": {"amount": record.amount, "quantity": record.quantity, "slots": record.slots},
                        "current": {"amount": amount, "quantity": quantity, "slots": slots}
                    }
                )

            return SignatureResult(
                True,
                SignatureStatus.VALID,
                None,
                "幂等请求，返回之前的结果",
                {"cached_result": record.result, "first_processed_at": record.created_at.isoformat()}
            )

        return None

    def _record_idempotency(self, idempotency_key: Optional[str], payload: str, amount: Optional[float], quantity: Optional[int], slots: Optional[int], result: Dict[str, Any]):
        if not idempotency_key:
            return

        request_hash = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        self.idempotent_cache[idempotency_key] = IdempotentRecord(
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            amount=amount,
            quantity=quantity,
            slots=slots,
            created_at=datetime.now(),
            result=result
        )

    def verify(self, signature: str, payload: str, timestamp: str, nonce: str, key_id: Optional[str] = None, idempotency_key: Optional[str] = None, amount: Optional[float] = None, quantity: Optional[int] = None, slots: Optional[int] = None) -> SignatureResult:
        self._cleanup_nonce_cache()

        try:
            parsed_payload = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            parsed_payload = {}

        if amount is None and isinstance(parsed_payload, dict):
            amount = parsed_payload.get('amount')
        if quantity is None and isinstance(parsed_payload, dict):
            quantity = parsed_payload.get('quantity')
        if slots is None and isinstance(parsed_payload, dict):
            slots = parsed_payload.get('slots')

        idempotent_check = self._check_idempotency(idempotency_key, payload, amount, quantity, slots)
        if idempotent_check:
            if idempotent_check.success:
                self._audit("idempotent_replay", "success", f"幂等请求成功: {idempotency_key}")
                return idempotent_check
            else:
                self._audit("idempotent_conflict", "failed", f"幂等冲突: {idempotency_key}")
                return idempotent_check

        replay_result = self._check_replay(nonce, timestamp)
        if not replay_result.success:
            self._audit("replay_detected", "failed", replay_result.message)
            return replay_result

        keys_to_try = []
        if key_id:
            if key_id in self.keys:
                keys_to_try.append(self.keys[key_id])
        else:
            keys_to_try = self.get_valid_keys()

        if not keys_to_try:
            result = SignatureResult(False, SignatureStatus.INVALID, None, "没有可用的签名密钥")
            self._audit("verify_failed", "failed", result.message)
            return result

        for key in keys_to_try:
            if self._verify_signature(key, signature, payload, timestamp, nonce):
                result = SignatureResult(
                    True,
                    SignatureStatus.VALID,
                    key.key_id,
                    f"签名验证通过，使用密钥: {key.key_id} (状态: {key.status.value})",
                    {
                        "key_status": key.status.value,
                        "key_age_seconds": (datetime.now() - key.created_at).total_seconds()
                    }
                )

                final_result = {
                    "success": True,
                    "key_id": key.key_id,
                    "timestamp": timestamp
                }

                self._record_idempotency(idempotency_key, payload, amount, quantity, slots, final_result)

                if key.status == KeyStatus.ROTATING:
                    result.details["rotation_grace_remaining"] = (key.expires_at - datetime.now()).total_seconds() if key.expires_at else None
                    self._audit("verify_rotating_key", "warning", f"使用轮换中的密钥: {key.key_id}")
                elif key.status == KeyStatus.DEPRECATED:
                    self._audit("verify_deprecated_key", "warning", f"使用废弃密钥: {key.key_id}")
                else:
                    self._audit("verify_success", "success", f"签名验证通过，密钥: {key.key_id}")

                return result

        result = SignatureResult(False, SignatureStatus.INVALID, None, "签名验证失败，所有密钥均不匹配")
        self._audit("verify_failed", "failed", result.message)
        return result

    def sign(self, payload: str, key_id: Optional[str] = None) -> Dict[str, Any]:
        valid_keys = self.get_valid_keys()
        if not valid_keys:
            raise ValueError("没有可用的签名密钥")

        if key_id:
            if key_id not in self.keys or self.keys[key_id].status == KeyStatus.REVOKED:
                raise ValueError(f"密钥 {key_id} 不可用")
            key = self.keys[key_id]
        else:
            active_keys = [k for k in valid_keys if k.status == KeyStatus.ACTIVE]
            key = active_keys[0] if active_keys else valid_keys[0]

        timestamp = str(int(time.time()))
        nonce = uuid.uuid4().hex[:16]
        signature = self._compute_signature(key.secret, payload, timestamp, nonce)

        return {
            "signature": signature,
            "timestamp": timestamp,
            "nonce": nonce,
            "key_id": key.key_id
        }

    def _audit(self, action: str, status: str, message: str, details: Dict[str, Any] = None):
        self.audit_logs.append(AuditLog(
            event_id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            action=action,
            status=status,
            message=message,
            details=details or {}
        ))

        if len(self.audit_logs) > 1000:
            self.audit_logs = self.audit_logs[-500:]

    def generate_developer_report(self) -> DeveloperReport:
        report = DeveloperReport()

        for audit in self.audit_logs:
            report.total_requests += 1

            if audit.action == "verify_success":
                report.valid_signatures += 1
            elif audit.action == "verify_failed":
                report.invalid_signatures += 1
            elif audit.action == "replay_detected":
                report.replay_attacks += 1
            elif audit.action == "idempotent_conflict":
                report.idempotent_conflicts += 1
            elif audit.action == "verify_rotating_key":
                report.rotated_key_usage += 1
                report.valid_signatures += 1
            elif audit.action == "verify_deprecated_key":
                report.deprecated_key_usage += 1
                report.valid_signatures += 1

        report.recent_audits = self.audit_logs[-20:]

        return report

    def list_keys(self) -> List[Dict[str, Any]]:
        return [
            {
                "key_id": k.key_id,
                "status": k.status.value,
                "created_at": k.created_at.isoformat(),
                "expires_at": k.expires_at.isoformat() if k.expires_at else None
            }
            for k in self.keys.values()
        ]
