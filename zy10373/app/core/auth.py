from typing import List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import FieldAuthorization


class FieldAuthorizer:
    def __init__(self, db: Session):
        self.db = db

    def authorize_field(
        self,
        requester_id: str,
        data_source: str,
        field_name: str,
        authorized_by: str
    ) -> FieldAuthorization:
        existing = self.db.query(FieldAuthorization).filter(
            FieldAuthorization.requester_id == requester_id,
            FieldAuthorization.data_source == data_source,
            FieldAuthorization.field_name == field_name
        ).first()

        if existing:
            existing.is_authorized = True
            existing.authorized_by = authorized_by
            existing.authorized_at = datetime.now()
            self.db.commit()
            self.db.refresh(existing)
            return existing

        auth = FieldAuthorization(
            requester_id=requester_id,
            data_source=data_source,
            field_name=field_name,
            is_authorized=True,
            authorized_by=authorized_by,
            authorized_at=datetime.now()
        )
        self.db.add(auth)
        self.db.commit()
        self.db.refresh(auth)
        return auth

    def check_authorization(
        self,
        requester_id: str,
        data_source: str,
        field_name: str
    ) -> bool:
        auth = self.db.query(FieldAuthorization).filter(
            FieldAuthorization.requester_id == requester_id,
            FieldAuthorization.data_source == data_source,
            FieldAuthorization.field_name == field_name,
            FieldAuthorization.is_authorized == True
        ).first()
        return auth is not None

    def validate_field_scope(
        self,
        requester_id: str,
        data_source: str,
        fields: List[str]
    ) -> Dict[str, Any]:
        authorized_fields = []
        unauthorized_fields = []

        for field in fields:
            if self.check_authorization(requester_id, data_source, field):
                authorized_fields.append(field)
            else:
                unauthorized_fields.append(field)

        return {
            "all_authorized": len(unauthorized_fields) == 0,
            "authorized_fields": authorized_fields,
            "unauthorized_fields": unauthorized_fields
        }

    def batch_authorize_fields(
        self,
        requester_id: str,
        data_source: str,
        fields: List[str],
        authorized_by: str
    ) -> List[FieldAuthorization]:
        results = []
        for field in fields:
            auth = self.authorize_field(requester_id, data_source, field, authorized_by)
            results.append(auth)
        return results

    def get_authorized_fields(
        self,
        requester_id: str,
        data_source: str
    ) -> List[str]:
        auths = self.db.query(FieldAuthorization).filter(
            FieldAuthorization.requester_id == requester_id,
            FieldAuthorization.data_source == data_source,
            FieldAuthorization.is_authorized == True
        ).all()
        return [auth.field_name for auth in auths]
