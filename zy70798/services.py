from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from database import QuarantinedTest, CleanupReport
from schemas import QuarantinedTestCreate, QuarantinedTestUpdate, TestResultUpdate, TestStatus, ResultStatus, ErrorCodes
import re


class TestMetadataParser:
    @staticmethod
    def parse_test_name(full_test_path: str) -> dict:
        match = re.match(r'^(.+)::(.+)::(.+)$', full_test_path)
        if match:
            return {
                'module': match.group(1),
                'class': match.group(2),
                'test_name': match.group(3),
                'full_path': full_test_path
            }
        match = re.match(r'^(.+)::(.+)$', full_test_path)
        if match:
            return {
                'module': match.group(1),
                'class': None,
                'test_name': match.group(2),
                'full_path': full_test_path
            }
        return {
            'module': full_test_path.split('/')[-1].split('.')[0] if '/' in full_test_path else None,
            'class': None,
            'test_name': full_test_path,
            'full_path': full_test_path
        }

    @staticmethod
    def categorize_reason(reason: str) -> str:
        reason_lower = reason.lower()
        if any(kw in reason_lower for kw in ['flaky', 'flake', '不稳定', '随机失败']):
            return 'flaky'
        if any(kw in reason_lower for kw in ['timeout', 'timed out', '超时']):
            return 'timeout'
        if any(kw in reason_lower for kw in ['environment', 'env', '环境', '依赖']):
            return 'environment'
        if any(kw in reason_lower for kw in ['data', '数据', 'fixture']):
            return 'test_data'
        if any(kw in reason_lower for kw in ['bug', '缺陷', 'known issue']):
            return 'known_bug'
        return 'other'


class ExpiryCalculator:
    EXPIRING_SOON_DAYS = 3

    @staticmethod
    def days_until_expiry(expiry_date: datetime) -> int:
        now = datetime.utcnow()
        delta = expiry_date.replace(tzinfo=None) - now.replace(tzinfo=None)
        return max(0, delta.days)

    @staticmethod
    def is_expired(expiry_date: datetime) -> bool:
        return ExpiryCalculator.days_until_expiry(expiry_date) <= 0

    @staticmethod
    def is_expiring_soon(expiry_date: datetime) -> bool:
        days = ExpiryCalculator.days_until_expiry(expiry_date)
        return 0 < days <= ExpiryCalculator.EXPIRING_SOON_DAYS


class ResultMerger:
    MIN_CONSECUTIVE_PASSES_FOR_CLEANUP = 3

    @staticmethod
    def update_test_result(db: Session, test_id: int, result_update: TestResultUpdate) -> QuarantinedTest:
        test = db.query(QuarantinedTest).filter(QuarantinedTest.id == test_id).first()
        if not test:
            return None

        test.last_run_date = result_update.run_date
        test.last_run_result = result_update.result
        test.last_run_build_url = result_update.build_url
        test.total_runs_since_quarantine += 1

        if result_update.result == ResultStatus.PASS:
            test.consecutive_passes += 1
        elif result_update.result == ResultStatus.FAIL:
            if test.status == TestStatus.READY_FOR_CLEANUP.value:
                test.status = TestStatus.REQUIRES_MANUAL_REVIEW.value
            test.consecutive_passes = 0

        if test.consecutive_passes >= ResultMerger.MIN_CONSECUTIVE_PASSES_FOR_CLEANUP and test.status != TestStatus.REQUIRES_MANUAL_REVIEW.value:
            test.status = TestStatus.READY_FOR_CLEANUP.value
        elif ExpiryCalculator.is_expired(test.expiry_date) and test.status not in [TestStatus.REQUIRES_MANUAL_REVIEW.value, TestStatus.CLEANED.value]:
            test.status = TestStatus.EXPIRED.value

        db.commit()
        db.refresh(test)
        return test


class CleanupAdvisor:
    @staticmethod
    def get_cleanup_suggestion(test: QuarantinedTest) -> dict:
        days = ExpiryCalculator.days_until_expiry(test.expiry_date)
        consecutive_passes = test.consecutive_passes

        if consecutive_passes >= ResultMerger.MIN_CONSECUTIVE_PASSES_FOR_CLEANUP:
            return {
                'suggestion': f'连续 {consecutive_passes} 次通过，建议解除隔离',
                'action_type': 'unquarantine',
                'priority': 'high'
            }

        if days == 0:
            return {
                'suggestion': '已到期，请立即处理',
                'action_type': 'review',
                'priority': 'critical'
            }

        if days <= ExpiryCalculator.EXPIRING_SOON_DAYS:
            return {
                'suggestion': f'{days} 天后到期，建议近期处理',
                'action_type': 'review',
                'priority': 'high'
            }

        if consecutive_passes >= 2:
            return {
                'suggestion': f'已连续 {consecutive_passes} 次通过，建议观察',
                'action_type': 'monitor',
                'priority': 'medium'
            }

        return {
            'suggestion': '保持隔离状态',
            'action_type': 'keep',
            'priority': 'low'
        }


class QuarantineService:
    @staticmethod
    def create_test(db: Session, test_data: QuarantinedTestCreate) -> QuarantinedTest:
        metadata = TestMetadataParser.parse_test_name(test_data.test_path)
        reason_category = test_data.reason_category or TestMetadataParser.categorize_reason(test_data.quarantine_reason)
        
        db_test = QuarantinedTest(
            test_name=test_data.test_name or metadata['test_name'],
            test_path=test_data.test_path,
            quarantine_reason=test_data.quarantine_reason,
            reason_category=reason_category,
            owner=test_data.owner,
            owner_email=test_data.owner_email,
            quarantine_date=test_data.quarantine_date,
            expiry_date=test_data.expiry_date,
            notes=test_data.notes,
            status=TestStatus.ACTIVE.value
        )
        db.add(db_test)
        db.commit()
        db.refresh(db_test)
        return db_test

    @staticmethod
    def get_test(db: Session, test_id: int) -> Optional[QuarantinedTest]:
        return db.query(QuarantinedTest).filter(QuarantinedTest.id == test_id).first()

    @staticmethod
    def list_tests(
        db: Session,
        status: Optional[str] = None,
        owner: Optional[str] = None,
        reason_category: Optional[str] = None,
        expired_only: bool = False,
        expiring_soon_only: bool = False
    ) -> List[QuarantinedTest]:
        query = db.query(QuarantinedTest)

        if status:
            query = query.filter(QuarantinedTest.status == status)
        if owner:
            query = query.filter(QuarantinedTest.owner == owner)
        if reason_category:
            query = query.filter(QuarantinedTest.reason_category == reason_category)

        tests = query.all()

        if expired_only:
            tests = [t for t in tests if ExpiryCalculator.is_expired(t.expiry_date)]
        if expiring_soon_only:
            tests = [t for t in tests if ExpiryCalculator.is_expiring_soon(t.expiry_date)]

        return tests

    @staticmethod
    def update_test(db: Session, test_id: int, update_data: QuarantinedTestUpdate) -> Optional[QuarantinedTest]:
        test = db.query(QuarantinedTest).filter(QuarantinedTest.id == test_id).first()
        if not test:
            return None

        if test.status == TestStatus.CLEANED.value:
            raise ValueError(ErrorCodes.ALREADY_PROCESSED)

        update_dict = update_data.dict(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(test, key, value)

        db.commit()
        db.refresh(test)
        return test

    @staticmethod
    def mark_cleaned(db: Session, test_id: int) -> Optional[QuarantinedTest]:
        test = db.query(QuarantinedTest).filter(QuarantinedTest.id == test_id).first()
        if not test:
            return None

        if test.status == TestStatus.CLEANED.value:
            raise ValueError(ErrorCodes.ALREADY_PROCESSED)

        if test.status == TestStatus.REQUIRES_MANUAL_REVIEW.value:
            raise ValueError(ErrorCodes.REQUIRES_MANUAL_REVIEW)

        if test.status not in [TestStatus.READY_FOR_CLEANUP.value, TestStatus.EXPIRED.value]:
            raise ValueError(ErrorCodes.INVALID_STATUS)

        test.status = TestStatus.CLEANED.value
        db.commit()
        db.refresh(test)
        return test

    @staticmethod
    def generate_cleanup_report(db: Session, generated_by: str = "system") -> CleanupReport:
        tests = db.query(QuarantinedTest).filter(QuarantinedTest.status != TestStatus.CLEANED.value).all()

        expired = [t for t in tests if ExpiryCalculator.is_expired(t.expiry_date)]
        expiring_soon = [t for t in tests if ExpiryCalculator.is_expiring_soon(t.expiry_date)]
        ready_for_cleanup = [t for t in tests if t.status == TestStatus.READY_FOR_CLEANUP.value]
        requires_manual_review = [t for t in tests if t.status == TestStatus.REQUIRES_MANUAL_REVIEW.value]

        by_reason = {}
        for t in tests:
            cat = t.reason_category or 'other'
            by_reason[cat] = by_reason.get(cat, 0) + 1

        report = CleanupReport(
            total_quarantined=len(tests),
            expired=len(expired),
            expiring_soon=len(expiring_soon),
            ready_for_cleanup=len(ready_for_cleanup),
            requires_manual_review=len(requires_manual_review),
            report_content=f"清理建议报告 - {datetime.utcnow().strftime('%Y-%m-%d')}",
            generated_by=generated_by
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_owner_summary(db: Session) -> List[Dict]:
        tests = db.query(QuarantinedTest).filter(QuarantinedTest.status != TestStatus.CLEANED.value).all()
        
        owner_groups = {}
        for test in tests:
            if test.owner not in owner_groups:
                owner_groups[test.owner] = {
                    'owner': test.owner,
                    'owner_email': test.owner_email,
                    'tests': [],
                    'expired_count': 0,
                    'expiring_soon_count': 0,
                    'ready_for_cleanup_count': 0
                }
            
            owner_groups[test.owner]['tests'].append(test)
            
            if ExpiryCalculator.is_expired(test.expiry_date):
                owner_groups[test.owner]['expired_count'] += 1
            if ExpiryCalculator.is_expiring_soon(test.expiry_date):
                owner_groups[test.owner]['expiring_soon_count'] += 1
            if test.status == TestStatus.READY_FOR_CLEANUP.value:
                owner_groups[test.owner]['ready_for_cleanup_count'] += 1

        result = []
        for group in owner_groups.values():
            group['total_tests'] = len(group['tests'])
            result.append(group)

        return sorted(result, key=lambda x: x['expired_count'], reverse=True)
