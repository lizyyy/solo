from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field
import uuid


class BaseEntity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    is_deleted: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def update_timestamp(self):
        self.updated_at = datetime.now()


class IdempotentEntity(BaseEntity):
    idempotent_key: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_hash: Optional[str] = None

    def generate_idempotent_key(self) -> str:
        self.idempotent_key = str(uuid.uuid4())
        return self.idempotent_key
