import hashlib
import json
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import (
    ImportPackage, FieldMapping, DependencyResource, PrecheckError,
    FixSuggestion, PassCertificate, AuditLog, generate_uuid
)
from app.schemas import ImportPackageCreate, StatusAdvanceRequest, RevokeCertificateRequest
from app.config import get_settings

settings = get_settings()


def calculate_source_hash(source_content: str) -> str:
    return hashlib.sha256(source_content.encode('utf-8')).hexdigest()


def generate_certificate_number() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_part = hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:8]
    return f"CERT-{timestamp}-{random_part}"


class PrecheckRules:
    VERSION = settings.RULES_VERSION

    @classmethod
    def validate_field_mapping(cls, field_mapping: FieldMapping) -> Tuple[bool, Optional[str]]:
        if not field_mapping.source_field or not field_mapping.target_field:
            return False, "源字段和目标字段不能为空"

        valid_mapping_types = ["direct", "transform", "lookup", "custom"]
        if field_mapping.mapping_type not in valid_mapping_types:
            return False, f"不支持的映射类型: {field_mapping.mapping_type}"

        if field_mapping.mapping_type == "transform" and not field_mapping.transform_rule:
            return False, "转换类型映射需要提供转换规则"

        return True, None

    @classmethod
    def check_dependency_resource(cls, resource: DependencyResource) -> Tuple[bool, Optional[str]]:
        required_types = ["database", "api", "storage", "queue"]
        if resource.resource_type not in required_types:
            return False, f"不支持的资源类型: {resource.resource_type}"

        if resource.required and not resource.resource_id:
            return False, f"必需资源 {resource.resource_name} 需要提供 resource_id"

        return True, None

    @classmethod
    def generate_fix_suggestions(cls, error: PrecheckError) -> List[FixSuggestion]:
        suggestions = []

        if error.error_type == "validation":
            suggestions.append(FixSuggestion(
                suggestion_type="fix",
                title="修正字段映射",
                description="检查字段映射配置是否正确",
                operation_steps=[
                    "打开导入包配置页面",
                    "找到对应的字段映射",
                    "修正源字段或目标字段",
                    "重新提交预检"
                ],
                auto_fixable=False
            ))

        if error.error_type == "dependency":
            suggestions.append(FixSuggestion(
                suggestion_type="resource",
                title="配置依赖资源",
                description="确保依赖资源已正确配置并可用",
                operation_steps=[
                    "检查资源是否存在",
                    "验证资源权限配置",
                    "更新 resource_id",
                    "重新执行预检"
                ],
                auto_fixable=False
            ))

        if error.severity == "warning":
            suggestions.append(FixSuggestion(
                suggestion_type="ignore",
                title="忽略警告",
                description="确认此警告不影响导入流程",
                operation_steps=[
                    "评估警告影响范围",
                    "确认业务流程不受影响",
                    "标记警告为已处理"
                ],
                auto_fixable=True
            ))

        return suggestions


class PrecheckService:
    def __init__(self, db: Session):
        self.db = db
        self.rules = PrecheckRules()

    def create_import_package(self, package_data: ImportPackageCreate, created_by: str) -> ImportPackage:
        source_hash = calculate_source_hash(package_data.source_content)

        existing = self.db.query(ImportPackage).filter(
            ImportPackage.tenant_id == package_data.tenant_id,
            ImportPackage.source_hash == source_hash
        ).first()

        if existing:
            return existing

        package_id = generate_uuid()
        package = ImportPackage(
            id=package_id,
            tenant_id=package_data.tenant_id,
            package_name=package_data.package_name,
            package_version=package_data.package_version,
            created_by=created_by,
            rules_version=self.rules.VERSION,
            source_hash=source_hash,
            metadata_=package_data.metadata
        )

        for fm in package_data.field_mappings:
            field_mapping = FieldMapping(
                source_field=fm.source_field,
                target_field=fm.target_field,
                mapping_type=fm.mapping_type,
                transform_rule=fm.transform_rule
            )
            package.field_mappings.append(field_mapping)

        for dr in package_data.dependency_resources:
            dependency = DependencyResource(
                resource_type=dr.resource_type,
                resource_name=dr.resource_name,
                resource_id=dr.resource_id,
                required=dr.required
            )
            package.dependency_resources.append(dependency)

        self.db.add(package)
        self._add_audit_log(package.id, "CREATE", None, "CREATED", created_by, {
            "package_name": package_data.package_name,
            "package_version": package_data.package_version
        })

        self.db.commit()
        self.db.refresh(package)
        return package

    def run_precheck(self, package_id: str, operator: str) -> ImportPackage:
        package = self.db.query(ImportPackage).filter(ImportPackage.id == package_id).first()
        if not package:
            raise ValueError(f"导入包不存在: {package_id}")

        if package.status not in ["CREATED", "FAILED"]:
            raise ValueError(f"当前状态 {package.status} 不允许执行预检")

        old_status = package.status
        package.status = "VALIDATING"
        self._add_audit_log(package_id, "START_PRECHECK", old_status, "VALIDATING", operator, {})
        self.db.commit()

        errors = []

        for field_mapping in package.field_mappings:
            is_valid, message = self.rules.validate_field_mapping(field_mapping)
            field_mapping.is_valid = is_valid
            field_mapping.validation_message = message

            if not is_valid:
                error = PrecheckError(
                    error_code="FM001",
                    error_type="validation",
                    severity="error",
                    field=field_mapping.source_field,
                    message=message or "字段映射验证失败",
                    detail={"mapping_type": field_mapping.mapping_type}
                )
                error.fix_suggestions.extend(self.rules.generate_fix_suggestions(error))
                errors.append(error)

        for dependency in package.dependency_resources:
            is_valid, message = self.rules.check_dependency_resource(dependency)
            dependency.status = "VALID" if is_valid else "INVALID"
            dependency.error_message = message

            if not is_valid:
                error = PrecheckError(
                    error_code="DR001",
                    error_type="dependency",
                    severity="error" if dependency.required else "warning",
                    field=dependency.resource_name,
                    message=message or "依赖资源验证失败",
                    detail={"resource_type": dependency.resource_type, "required": dependency.required}
                )
                error.fix_suggestions.extend(self.rules.generate_fix_suggestions(error))
                errors.append(error)

        for error in errors:
            package.precheck_errors.append(error)

        has_errors = any(e.severity == "error" for e in errors)
        has_warnings = any(e.severity == "warning" for e in errors)

        if has_errors:
            package.status = "FAILED"
            new_status = "FAILED"
        elif has_warnings:
            package.status = "PENDING_REVIEW"
            new_status = "PENDING_REVIEW"
        else:
            package.status = "PASSED"
            new_status = "PASSED"
            self._issue_certificate(package, operator)

        package.completed_at = datetime.now()
        self._add_audit_log(package_id, "COMPLETE_PRECHECK", "VALIDATING", new_status, operator, {
            "error_count": len([e for e in errors if e.severity == "error"]),
            "warning_count": len([e for e in errors if e.severity == "warning"])
        })

        self.db.commit()
        self.db.refresh(package)
        return package

    def _issue_certificate(self, package: ImportPackage, operator: str):
        checksum = hashlib.sha256(
            f"{package.id}:{package.source_hash}:{self.rules.VERSION}".encode()
        ).hexdigest()

        certificate = PassCertificate(
            certificate_number=generate_certificate_number(),
            issued_by=operator,
            rules_version=self.rules.VERSION,
            checksum=checksum,
            expires_at=datetime.now() + timedelta(days=30)
        )
        package.pass_certificates.append(certificate)

    def advance_status(self, package_id: str, request: StatusAdvanceRequest) -> ImportPackage:
        package = self.db.query(ImportPackage).filter(ImportPackage.id == package_id).first()
        if not package:
            raise ValueError(f"导入包不存在: {package_id}")

        valid_transitions = {
            "CREATED": ["VALIDATING", "CANCELLED"],
            "VALIDATING": ["PASSED", "FAILED", "CANCELLED"],
            "PENDING_REVIEW": ["PASSED", "FAILED", "CANCELLED"],
            "FAILED": ["VALIDATING", "CANCELLED"],
            "PASSED": ["COMPLETED", "CANCELLED"],
            "CANCELLED": []
        }

        if request.target_status not in valid_transitions.get(package.status, []):
            raise ValueError(
                f"不允许从 {package.status} 转换到 {request.target_status}"
            )

        old_status = package.status
        package.status = request.target_status

        if request.target_status == "PASSED" and old_status == "PENDING_REVIEW":
            self._issue_certificate(package, request.operator)

        self._add_audit_log(
            package_id, "STATUS_ADVANCE", old_status, request.target_status,
            request.operator, {"reason": request.reason},
            request.ip_address, request.user_agent
        )

        self.db.commit()
        self.db.refresh(package)
        return package

    def cancel_package(self, package_id: str, operator: str, reason: str) -> ImportPackage:
        package = self.db.query(ImportPackage).filter(ImportPackage.id == package_id).first()
        if not package:
            raise ValueError(f"导入包不存在: {package_id}")

        if package.status == "CANCELLED":
            return package

        old_status = package.status
        package.status = "CANCELLED"

        for cert in package.pass_certificates:
            if not cert.is_revoked:
                cert.is_revoked = True
                cert.revoked_at = datetime.now()
                cert.revoked_by = operator

        self._add_audit_log(
            package_id, "CANCEL", old_status, "CANCELLED",
            operator, {"reason": reason}
        )

        self.db.commit()
        self.db.refresh(package)
        return package

    def revoke_certificate(self, package_id: str, cert_id: str, request: RevokeCertificateRequest) -> PassCertificate:
        cert = self.db.query(PassCertificate).filter(
            PassCertificate.id == cert_id,
            PassCertificate.package_id == package_id
        ).first()

        if not cert:
            raise ValueError(f"凭证不存在: {cert_id}")

        if cert.is_revoked:
            return cert

        cert.is_revoked = True
        cert.revoked_at = datetime.now()
        cert.revoked_by = request.operator

        self._add_audit_log(
            package_id, "REVOKE_CERT", None, None,
            request.operator, {"cert_id": cert_id, "reason": request.reason}
        )

        self.db.commit()
        self.db.refresh(cert)
        return cert

    def get_package(self, package_id: str) -> Optional[ImportPackage]:
        return self.db.query(ImportPackage).filter(ImportPackage.id == package_id).first()

    def list_packages(
        self, tenant_id: Optional[str] = None, status: Optional[str] = None,
        created_by: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> List[ImportPackage]:
        query = self.db.query(ImportPackage)

        if tenant_id:
            query = query.filter(ImportPackage.tenant_id == tenant_id)
        if status:
            query = query.filter(ImportPackage.status == status)
        if created_by:
            query = query.filter(ImportPackage.created_by == created_by)

        return query.order_by(desc(ImportPackage.created_at)).offset(skip).limit(limit).all()

    def get_audit_logs(self, package_id: str, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(
            AuditLog.package_id == package_id
        ).order_by(desc(AuditLog.timestamp)).offset(skip).limit(limit).all()

    def _add_audit_log(
        self, package_id: str, action: str, old_status: Optional[str], new_status: Optional[str],
        operator: str, details: dict, ip_address: Optional[str] = None, user_agent: Optional[str] = None
    ):
        log = AuditLog(
            package_id=package_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            operator=operator,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.db.add(log)

    def export_package(self, package_id: str, include_audit_logs: bool = True) -> dict:
        package = self.get_package(package_id)
        if not package:
            raise ValueError(f"导入包不存在: {package_id}")

        export_data = {
            "package": {
                "id": package.id,
                "tenant_id": package.tenant_id,
                "package_name": package.package_name,
                "package_version": package.package_version,
                "status": package.status,
                "created_by": package.created_by,
                "created_at": package.created_at.isoformat() if package.created_at else None,
                "completed_at": package.completed_at.isoformat() if package.completed_at else None,
                "rules_version": package.rules_version,
                "metadata": package.metadata_
            },
            "field_mappings": [
                {
                    "id": fm.id,
                    "source_field": fm.source_field,
                    "target_field": fm.target_field,
                    "mapping_type": fm.mapping_type,
                    "is_valid": fm.is_valid,
                    "validation_message": fm.validation_message
                }
                for fm in package.field_mappings
            ],
            "dependency_resources": [
                {
                    "id": dr.id,
                    "resource_type": dr.resource_type,
                    "resource_name": dr.resource_name,
                    "resource_id": dr.resource_id,
                    "status": dr.status,
                    "required": dr.required,
                    "error_message": dr.error_message
                }
                for dr in package.dependency_resources
            ],
            "precheck_errors": [
                {
                    "id": pe.id,
                    "error_code": pe.error_code,
                    "error_type": pe.error_type,
                    "severity": pe.severity,
                    "field": pe.field,
                    "message": pe.message,
                    "resolved": pe.resolved,
                    "fix_suggestions": [
                        {
                            "id": fs.id,
                            "title": fs.title,
                            "description": fs.description,
                            "auto_fixable": fs.auto_fixable
                        }
                        for fs in pe.fix_suggestions
                    ]
                }
                for pe in package.precheck_errors
            ],
            "certificates": [
                {
                    "id": cert.id,
                    "certificate_number": cert.certificate_number,
                    "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
                    "issued_by": cert.issued_by,
                    "expires_at": cert.expires_at.isoformat() if cert.expires_at else None,
                    "rules_version": cert.rules_version,
                    "is_revoked": cert.is_revoked
                }
                for cert in package.pass_certificates
            ]
        }

        if include_audit_logs:
            export_data["audit_logs"] = [
                {
                    "id": log.id,
                    "action": log.action,
                    "old_status": log.old_status,
                    "new_status": log.new_status,
                    "operator": log.operator,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "details": log.details
                }
                for log in self.get_audit_logs(package_id)
            ]

        return export_data
