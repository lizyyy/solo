from pydantic_settings import BaseSettings
from typing import Optional
from enum import Enum


class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    PENDING_ETHICS_REVIEW = "pending_ethics_review"
    PENDING_DEIDENTIFICATION_REVIEW = "pending_deidentification_review"
    AVAILABLE_FOR_DOWNLOAD = "available_for_download"
    EXPIRED = "expired"
    REVOKED = "revoked"
    REJECTED = "rejected"


class UserRole(str, Enum):
    RESEARCHER = "researcher"
    ETHICS_COMMITTEE = "ethics_committee"
    DATA_MANAGER = "data_manager"
    ADMIN = "admin"


class Settings(BaseSettings):
    APP_NAME: str = "医院科研办数据访问申请系统"
    APP_VERSION: str = "1.0.0"
    DATABASE_URL: str = "sqlite:///./data_access.db"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()


STATUS_TRANSITIONS = {
    ApplicationStatus.DRAFT: {
        "allowed_next": [ApplicationStatus.PENDING_ETHICS_REVIEW, ApplicationStatus.REVOKED],
        "required_roles": {
            ApplicationStatus.PENDING_ETHICS_REVIEW: [UserRole.RESEARCHER, UserRole.ADMIN],
            ApplicationStatus.REVOKED: [UserRole.RESEARCHER, UserRole.ADMIN]
        }
    },
    ApplicationStatus.PENDING_ETHICS_REVIEW: {
        "allowed_next": [ApplicationStatus.PENDING_DEIDENTIFICATION_REVIEW, ApplicationStatus.REJECTED, ApplicationStatus.REVOKED],
        "required_roles": {
            ApplicationStatus.PENDING_DEIDENTIFICATION_REVIEW: [UserRole.ETHICS_COMMITTEE, UserRole.ADMIN],
            ApplicationStatus.REJECTED: [UserRole.ETHICS_COMMITTEE, UserRole.ADMIN],
            ApplicationStatus.REVOKED: [UserRole.RESEARCHER, UserRole.ADMIN]
        }
    },
    ApplicationStatus.PENDING_DEIDENTIFICATION_REVIEW: {
        "allowed_next": [ApplicationStatus.AVAILABLE_FOR_DOWNLOAD, ApplicationStatus.REJECTED, ApplicationStatus.REVOKED],
        "required_roles": {
            ApplicationStatus.AVAILABLE_FOR_DOWNLOAD: [UserRole.DATA_MANAGER, UserRole.ADMIN],
            ApplicationStatus.REJECTED: [UserRole.DATA_MANAGER, UserRole.ADMIN],
            ApplicationStatus.REVOKED: [UserRole.RESEARCHER, UserRole.ADMIN]
        }
    },
    ApplicationStatus.AVAILABLE_FOR_DOWNLOAD: {
        "allowed_next": [ApplicationStatus.EXPIRED, ApplicationStatus.REVOKED],
        "required_roles": {
            ApplicationStatus.EXPIRED: [UserRole.ADMIN, UserRole.DATA_MANAGER],
            ApplicationStatus.REVOKED: [UserRole.ADMIN, UserRole.DATA_MANAGER, UserRole.RESEARCHER]
        }
    },
    ApplicationStatus.EXPIRED: {
        "allowed_next": [],
        "required_roles": {}
    },
    ApplicationStatus.REVOKED: {
        "allowed_next": [],
        "required_roles": {}
    },
    ApplicationStatus.REJECTED: {
        "allowed_next": [],
        "required_roles": {}
    }
}


TERMINAL_STATUSES = {
    ApplicationStatus.EXPIRED,
    ApplicationStatus.REVOKED,
    ApplicationStatus.REJECTED
}
