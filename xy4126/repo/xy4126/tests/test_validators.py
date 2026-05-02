import pytest
import sys
from pathlib import Path
from datetime import datetime
from decimal import Decimal

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from models import (
    PackageEvidence,
    ServiceNote,
    ClaimApplication,
    FileEntry,
    FileCategory,
    IssueType,
    IssueSeverity,
)
from validators import (
    ValidationEngine,
    DuplicateWaybillValidator,
    PhotoMissingValidator,
    TimestampMissingValidator,
    ClaimAmountAbnormalValidator,
    ClaimDocumentMissingValidator,
)


class TestValidators:
    def create_file_entry(
        self,
        waybill_number: str,
        category: FileCategory = FileCategory.PACKAGE_PHOTO,
        timestamp: datetime = None
    ) -> FileEntry:
        return FileEntry(
            file_id=f"test_{waybill_number}_file",
            file_path=f"/test/{waybill_number}.jpg",
            filename=f"{waybill_number}.jpg",
            file_size=1024,
            extension=".jpg",
            category=category,
            waybill_number=waybill_number,
            created_at=timestamp,
            modified_at=timestamp,
            exif_timestamp=timestamp,
        )
    
    def test_duplicate_waybill_validator(self):
        validator = DuplicateWaybillValidator()
        
        packages = {
            "SF001": PackageEvidence(
                waybill_number="SF001",
                claim_applications=[
                    ClaimApplication(
                        claim_id="claim_1",
                        waybill_number="SF001",
                        claim_amount=Decimal("500"),
                        claim_reason="损坏",
                    ),
                    ClaimApplication(
                        claim_id="claim_2",
                        waybill_number="SF001",
                        claim_amount=Decimal("600"),
                        claim_reason="损坏",
                    ),
                ]
            )
        }
        
        issues = validator.validate(packages=packages)
        
        assert len(issues) == 1
        assert issues[0].issue_type == IssueType.DUPLICATE_WAYBILL
        assert issues[0].severity == IssueSeverity.CRITICAL
    
    def test_photo_missing_validator_with_claim(self):
        validator = PhotoMissingValidator()
        
        packages = {
            "SF002": PackageEvidence(
                waybill_number="SF002",
                claim_applications=[
                    ClaimApplication(
                        claim_id="claim_1",
                        waybill_number="SF002",
                        claim_amount=Decimal("500"),
                    ),
                ],
                photos=[],
            )
        }
        
        issues = validator.validate(packages=packages)
        
        assert len(issues) >= 1
        assert any(i.issue_type == IssueType.PHOTO_MISSING for i in issues)
    
    def test_photo_missing_validator_no_claim(self):
        validator = PhotoMissingValidator()
        
        packages = {
            "SF003": PackageEvidence(
                waybill_number="SF003",
                claim_applications=[],
                photos=[],
            )
        }
        
        issues = validator.validate(packages=packages)
        
        if issues:
            assert issues[0].severity == IssueSeverity.INFO
    
    def test_timestamp_missing_validator(self):
        validator = TimestampMissingValidator()
        
        photo_with_ts = self.create_file_entry(
            "SF004",
            FileCategory.WAYBILL_PHOTO,
            timestamp=datetime(2024, 5, 1, 10, 0, 0)
        )
        
        photo_without_ts = self.create_file_entry(
            "SF004",
            FileCategory.DAMAGE_PHOTO,
            timestamp=None
        )
        
        packages = {
            "SF004": PackageEvidence(
                waybill_number="SF004",
                waybill_photos=[photo_with_ts],
                damage_photos=[photo_without_ts],
            )
        }
        
        issues = validator.validate(packages=packages)
        
        assert len(issues) == 1
        assert issues[0].issue_type == IssueType.TIMESTAMP_MISSING
    
    def test_claim_amount_abnormal_validator(self):
        validator = ClaimAmountAbnormalValidator()
        
        packages = {
            "SF005": PackageEvidence(
                waybill_number="SF005",
                claim_applications=[
                    ClaimApplication(
                        claim_id="claim_1",
                        waybill_number="SF005",
                        claim_amount=Decimal("0"),
                    ),
                ],
            ),
            "SF006": PackageEvidence(
                waybill_number="SF006",
                claim_applications=[
                    ClaimApplication(
                        claim_id="claim_2",
                        waybill_number="SF006",
                        claim_amount=Decimal("15000"),
                    ),
                ],
            ),
        }
        
        issues = validator.validate(packages=packages)
        
        assert len(issues) == 2
        assert any(i.issue_type == IssueType.CLAIM_AMOUNT_ABNORMAL for i in issues)
    
    def test_claim_document_missing_validator(self):
        validator = ClaimDocumentMissingValidator()
        
        packages = {
            "SF007": PackageEvidence(
                waybill_number="SF007",
                claim_applications=[
                    ClaimApplication(
                        claim_id="claim_1",
                        waybill_number="SF007",
                        claim_amount=Decimal("500"),
                    ),
                ],
                service_notes=[],
            )
        }
        
        issues = validator.validate(packages=packages)
        
        assert len(issues) >= 1
        assert any(i.issue_type == IssueType.CLAIM_DOCUMENT_MISSING for i in issues)
    
    def test_validation_engine(self):
        engine = ValidationEngine()
        
        packages = {
            "SF008": PackageEvidence(
                waybill_number="SF008",
                claim_applications=[
                    ClaimApplication(
                        claim_id="claim_1",
                        waybill_number="SF008",
                        claim_amount=Decimal("500"),
                    ),
                    ClaimApplication(
                        claim_id="claim_2",
                        waybill_number="SF008",
                        claim_amount=Decimal("600"),
                    ),
                ],
                photos=[],
            )
        }
        
        result = engine.validate_all(packages=packages)
        
        assert result.total_issues > 0
        assert result.critical_count + result.warning_count + result.info_count == result.total_issues


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
