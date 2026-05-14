from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import json
import hashlib
from database import (
    ClientApplication, UserConsent, AccessToken, RefreshToken,
    RevocationEvent, BackgroundTask, RequestLog,
    AuthorizationStatus, TokenStatus, TaskStatus, RevocationStatus,
    get_db
)


def generate_id():
    return str(uuid.uuid4())


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthorizationStateMachine:
    VALID_TRANSITIONS = {
        AuthorizationStatus.ACTIVE: [
            AuthorizationStatus.PENDING_REVOCATION,
            AuthorizationStatus.EXPIRED
        ],
        AuthorizationStatus.PENDING_REVOCATION: [
            AuthorizationStatus.REVOKED,
            AuthorizationStatus.COMPENSATED,
            AuthorizationStatus.FAILED
        ],
        AuthorizationStatus.REVOKED: [
            AuthorizationStatus.COMPENSATED
        ],
        AuthorizationStatus.EXPIRED: [],
        AuthorizationStatus.COMPENSATED: [],
        AuthorizationStatus.FAILED: [
            AuthorizationStatus.PENDING_REVOCATION
        ]
    }

    @classmethod
    def can_transition(cls, current_status: AuthorizationStatus, target_status: AuthorizationStatus) -> bool:
        return target_status in cls.VALID_TRANSITIONS.get(current_status, [])

    @classmethod
    def transition(cls, db: Session, consent: UserConsent, target_status: AuthorizationStatus,
                   reason: str = None) -> bool:
        if not cls.can_transition(consent.status, target_status):
            raise ValueError(
                f"Invalid state transition: {consent.status} -> {target_status}"
            )
        consent.status = target_status
        if target_status == AuthorizationStatus.REVOKED:
            consent.revoked_at = datetime.utcnow()
        return True


class TokenRevocationService:
    @staticmethod
    def revoke_tokens_by_consent(db: Session, consent_id: str) -> int:
        tokens = db.query(AccessToken).filter(
            AccessToken.consent_id == consent_id,
            AccessToken.status == TokenStatus.VALID
        ).all()

        revoked_count = 0
        for token in tokens:
            token.status = TokenStatus.REVOKED
            token.revoked_at = datetime.utcnow()
            revoked_count += 1

            if token.refresh_token:
                token.refresh_token.status = TokenStatus.REVOKED
                token.refresh_token.revoked_at = datetime.utcnow()

        db.commit()
        return revoked_count

    @staticmethod
    def propagate_revocation(db: Session, consent_id: str) -> dict:
        tokens_revoked = TokenRevocationService.revoke_tokens_by_consent(db, consent_id)
        tasks_intercepted = TaskInterceptorService.intercept_tasks_by_consent(db, consent_id)

        return {
            "tokens_revoked": tokens_revoked,
            "tasks_intercepted": tasks_intercepted
        }


class TaskInterceptorService:
    @staticmethod
    def should_intercept_task(db: Session, task: BackgroundTask) -> bool:
        if task.consent_id:
            consent = db.query(UserConsent).filter(
                UserConsent.id == task.consent_id
            ).first()
            if consent and consent.status in [
                AuthorizationStatus.PENDING_REVOCATION,
                AuthorizationStatus.REVOKED
            ]:
                return True

        if task.token_id:
            token = db.query(AccessToken).filter(
                AccessToken.id == task.token_id
            ).first()
            if token and token.status != TokenStatus.VALID:
                return True

        return False

    @staticmethod
    def intercept_task(db: Session, task: BackgroundTask) -> bool:
        if task.status not in [TaskStatus.PENDING, TaskStatus.RUNNING]:
            return False

        task.status = TaskStatus.INTERCEPTED
        task.intercepted_at = datetime.utcnow()
        db.commit()
        return True

    @staticmethod
    def intercept_tasks_by_consent(db: Session, consent_id: str) -> int:
        tasks = db.query(BackgroundTask).filter(
            BackgroundTask.consent_id == consent_id,
            BackgroundTask.status.in_([TaskStatus.PENDING, TaskStatus.RUNNING])
        ).all()

        intercepted_count = 0
        for task in tasks:
            if TaskInterceptorService.intercept_task(db, task):
                intercepted_count += 1

        return intercepted_count

    @staticmethod
    def validate_token_before_task(db: Session, token_id: str) -> bool:
        token = db.query(AccessToken).filter(AccessToken.id == token_id).first()
        if not token:
            return False
        return token.status == TokenStatus.VALID


class IdempotencyService:
    @staticmethod
    def check_duplicate_revocation(db: Session, consent_id: str) -> RevocationEvent:
        existing = db.query(RevocationEvent).filter(
            RevocationEvent.consent_id == consent_id,
            RevocationEvent.status.in_([
                RevocationStatus.INITIATED,
                RevocationStatus.PROPAGATING
            ])
        ).first()
        return existing

    @staticmethod
    def get_completed_revocation(db: Session, consent_id: str) -> RevocationEvent:
        return db.query(RevocationEvent).filter(
            RevocationEvent.consent_id == consent_id,
            RevocationEvent.status == RevocationStatus.COMPLETED
        ).order_by(RevocationEvent.initiated_at.desc()).first()


class RequestLogger:
    @staticmethod
    def log_request(db: Session, request_id: str, endpoint: str, method: str,
                    request_input: dict, result: dict = None, error: str = None,
                    responsible_node: str = "api-gateway", status_code: int = 200,
                    duration_ms: float = 0, revocation_event_id: str = None):
        log = RequestLog(
            id=generate_id(),
            request_id=request_id,
            revocation_event_id=revocation_event_id,
            endpoint=endpoint,
            method=method,
            request_input=json.dumps(request_input),
            result=json.dumps(result) if result else None,
            error=error,
            responsible_node=responsible_node,
            status_code=status_code,
            duration_ms=duration_ms
        )
        db.add(log)
        db.commit()
        return log


class RevocationOrchestrator:
    def __init__(self, db: Session):
        self.db = db

    def initiate_revocation(self, consent_id: str, user_id: str, reason: str,
                            initiated_by: str = "user") -> dict:
        request_id = generate_id()

        existing_pending = IdempotencyService.check_duplicate_revocation(self.db, consent_id)
        if existing_pending:
            return {
                "success": True,
                "idempotent": True,
                "message": "Revocation already in progress",
                "event_id": existing_pending.id,
                "request_id": request_id,
                "status": existing_pending.status
            }

        completed = IdempotencyService.get_completed_revocation(self.db, consent_id)
        if completed:
            return {
                "success": True,
                "idempotent": True,
                "message": "Revocation already completed",
                "event_id": completed.id,
                "request_id": request_id,
                "status": completed.status
            }

        consent = self.db.query(UserConsent).filter(UserConsent.id == consent_id).first()
        if not consent:
            raise ValueError("Consent not found")

        if consent.status != AuthorizationStatus.ACTIVE:
            return {
                "success": False,
                "message": f"Consent is not active (status: {consent.status})",
                "request_id": request_id
            }

        AuthorizationStateMachine.transition(
            self.db, consent, AuthorizationStatus.PENDING_REVOCATION
        )

        event = RevocationEvent(
            id=generate_id(),
            request_id=request_id,
            consent_id=consent_id,
            user_id=user_id,
            reason=reason,
            status=RevocationStatus.INITIATED,
            initiated_by=initiated_by
        )
        self.db.add(event)
        self.db.commit()

        return {
            "success": True,
            "idempotent": False,
            "message": "Revocation initiated",
            "event_id": event.id,
            "request_id": request_id,
            "status": event.status
        }

    def propagate_revocation(self, event_id: str) -> dict:
        event = self.db.query(RevocationEvent).filter(
            RevocationEvent.id == event_id
        ).first()
        if not event:
            raise ValueError("Revocation event not found")

        if event.status not in [RevocationStatus.INITIATED, RevocationStatus.PROPAGATING]:
            return {
                "success": True,
                "message": f"Event already in state: {event.status}",
                "event_id": event_id
            }

        event.status = RevocationStatus.PROPAGATING
        self.db.commit()

        result = TokenRevocationService.propagate_revocation(self.db, event.consent_id)

        event.tokens_revoked = result["tokens_revoked"]
        event.tasks_intercepted = result["tasks_intercepted"]

        consent = self.db.query(UserConsent).filter(
            UserConsent.id == event.consent_id
        ).first()
        if consent:
            AuthorizationStateMachine.transition(
                self.db, consent, AuthorizationStatus.REVOKED
            )

        event.status = RevocationStatus.COMPLETED
        event.completed_at = datetime.utcnow()
        self.db.commit()

        return {
            "success": True,
            "event_id": event_id,
            "status": event.status,
            "tokens_revoked": result["tokens_revoked"],
            "tasks_intercepted": result["tasks_intercepted"]
        }


class CompensationService:
    @staticmethod
    def compensate_revocation(db: Session, consent_id: str, reason: str) -> dict:
        consent = db.query(UserConsent).filter(UserConsent.id == consent_id).first()
        if not consent:
            raise ValueError("Consent not found")

        if consent.status not in [AuthorizationStatus.REVOKED, AuthorizationStatus.FAILED]:
            return {
                "success": False,
                "message": f"Cannot compensate consent in state: {consent.status}"
            }

        AuthorizationStateMachine.transition(
            db, consent, AuthorizationStatus.COMPENSATED
        )

        tokens = db.query(AccessToken).filter(
            AccessToken.consent_id == consent_id,
            AccessToken.status == TokenStatus.REVOKED
        ).all()

        restored_count = 0
        for token in tokens:
            if token.expires_at > datetime.utcnow():
                token.status = TokenStatus.VALID
                token.revoked_at = None
                restored_count += 1

        db.commit()

        return {
            "success": True,
            "consent_id": consent_id,
            "restored_tokens": restored_count,
            "message": "Compensation completed"
        }


class DataGenerator:
    @staticmethod
    def create_sample_data(db: Session):
        if db.query(ClientApplication).count() > 0:
            return

        app1 = ClientApplication(
            id=generate_id(),
            name="数据同步服务",
            client_id="sync_service_001",
            description="用于跨平台数据同步的第三方应用"
        )
        app2 = ClientApplication(
            id=generate_id(),
            name="分析仪表盘",
            client_id="analytics_dashboard_002",
            description="商业智能分析工具"
        )
        db.add_all([app1, app2])
        db.commit()

        for i in range(3):
            user_id = f"user_{i + 1:03d}"
            for app in [app1, app2]:
                consent = UserConsent(
                    id=generate_id(),
                    user_id=user_id,
                    application_id=app.id,
                    scope="read,write,profile",
                    status=AuthorizationStatus.ACTIVE,
                    expires_at=datetime.utcnow() + timedelta(days=30)
                )
                db.add(consent)
                db.commit()

                token_str = f"token_{consent.id}"
                token = AccessToken(
                    id=generate_id(),
                    token_hash=hash_token(token_str),
                    user_id=user_id,
                    application_id=app.id,
                    consent_id=consent.id,
                    scope="read,write,profile",
                    status=TokenStatus.VALID,
                    expires_at=datetime.utcnow() + timedelta(hours=24)
                )
                db.add(token)
                db.commit()

                refresh_str = f"refresh_{consent.id}"
                refresh = RefreshToken(
                    id=generate_id(),
                    token_hash=hash_token(refresh_str),
                    access_token_id=token.id,
                    user_id=user_id,
                    status=TokenStatus.VALID,
                    expires_at=datetime.utcnow() + timedelta(days=7)
                )
                db.add(refresh)
                db.commit()

                for j in range(2):
                    task = BackgroundTask(
                        id=generate_id(),
                        task_type="data_sync" if j == 0 else "report_generation",
                        user_id=user_id,
                        token_id=token.id,
                        consent_id=consent.id,
                        payload=json.dumps({"operation": "sync", "target": f"folder_{j}"}),
                        status=TaskStatus.PENDING,
                        priority=1
                    )
                    db.add(task)

        db.commit()
