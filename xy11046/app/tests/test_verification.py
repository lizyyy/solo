import pytest
from datetime import date, timedelta
from app.models.schemas import MealVoucherCreate, SubsidyLevel, VerificationStatus
from app.services.database import db
from app.services.verification import verification_service


@pytest.fixture(autouse=True)
def clear_db():
    db.vouchers.clear()
    db.monthly_reports.clear()
    db.next_id = 1


def create_sample_voucher(voucher_no: str, **kwargs) -> MealVoucherCreate:
    today = date.today()
    defaults = {
        "voucher_no": voucher_no,
        "id_card": "110101199001011234",
        "name": "张三",
        "phone": "13800138000",
        "address": "北京市朝阳区XX街道XX号",
        "community": "XX社区",
        "subsidy_level": SubsidyLevel.LEVEL_A,
        "subsidy_amount": 600.0,
        "issue_date": today,
        "expire_date": today + timedelta(days=180),
        "dining_point": "朝阳助餐点",
        "dining_point_code": "DP001",
        "applicant_type": "老年人",
        "family_status": "独居",
        "income_level": "低收入",
        "elderly_age": 82,
        "low_income_cert": True,
        "low_income_cert_no": "DZ2024001",
        "elderly_cert": True,
        "elderly_cert_no": "LN2024001",
        "household_registry": True,
        "income_proof": True,
        "operator": "管理员"
    }
    defaults.update(kwargs)
    return MealVoucherCreate(**defaults)


class TestVerificationRules:
    def test_R001_id_card_format_pass(self):
        voucher = create_sample_voucher("TEST001")
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST001", "测试员")
        assert not any("R001" in f for f in failed), f"R001不应该失败，失败规则: {failed}"

    def test_R001_id_card_format_fail(self):
        voucher = create_sample_voucher("TEST002", id_card="12345")
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST002", "测试员")
        assert any("R001" in f for f in failed), f"R001应该失败，失败规则: {failed}"

    def test_R002_expire_date_pass(self):
        voucher = create_sample_voucher("TEST003")
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST003", "测试员")
        assert not any("R002" in f for f in failed), f"R002不应该失败，失败规则: {failed}"

    def test_R002_expire_date_fail(self):
        voucher = create_sample_voucher("TEST004", expire_date=date.today() - timedelta(days=1))
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST004", "测试员")
        assert any("R002" in f for f in failed), f"R002应该失败，失败规则: {failed}"

    def test_R003_subsidy_level_A_pass_elderly(self):
        voucher = create_sample_voucher("TEST005", subsidy_level=SubsidyLevel.LEVEL_A, elderly_age=85)
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST005", "测试员")
        assert not any("R003" in f for f in failed), f"R003不应该失败，失败规则: {failed}"

    def test_R003_subsidy_level_A_fail(self):
        voucher = create_sample_voucher("TEST006", subsidy_level=SubsidyLevel.LEVEL_A, elderly_age=70, low_income_cert=False)
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST006", "测试员")
        assert any("R003" in f for f in failed), f"R003应该失败，失败规则: {failed}"

    def test_R003_subsidy_level_B_pass_disability(self):
        voucher = create_sample_voucher("TEST007", subsidy_level=SubsidyLevel.LEVEL_B, disability_cert=True, applicant_type="残疾人")
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST007", "测试员")
        assert not any("R003" in f for f in failed), f"R003不应该失败，失败规则: {failed}"

    def test_R004_required_docs_pass(self):
        voucher = create_sample_voucher("TEST008")
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST008", "测试员")
        assert not any("R004" in f for f in failed), f"R004不应该失败，失败规则: {failed}"

    def test_R004_required_docs_fail(self):
        voucher = create_sample_voucher("TEST009", household_registry=False, income_proof=False)
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST009", "测试员")
        assert any("R004" in f for f in failed), f"R004应该失败，失败规则: {failed}"

    def test_R005_dining_point_pass(self):
        voucher = create_sample_voucher("TEST010", dining_point_code="DP002")
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST010", "测试员")
        assert not any("R005" in f for f in failed), f"R005不应该失败，失败规则: {failed}"

    def test_R005_dining_point_fail(self):
        voucher = create_sample_voucher("TEST011", dining_point_code="INVALID")
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST011", "测试员")
        assert any("R005" in f for f in failed), f"R005应该失败，失败规则: {failed}"


class TestSubsidyLevelChange:
    def test_old_voucher_usable_after_level_change(self):
        voucher = create_sample_voucher("TEST012")
        db.add_voucher(voucher)
        verification_service.update_subsidy_level("TEST012", SubsidyLevel.LEVEL_B, "管理员")
        voucher = db.get_voucher("TEST012")
        assert verification_service.is_old_voucher_usable(voucher) == True


class TestMonthlyReportConsistency:
    def test_consistent_with_report(self):
        today = date.today()
        report_key = f"{today.year}-{today.month:02d}"
        db.add_monthly_report(report_key, {
            "voucher_list": ["TEST013"],
            "subsidy_levels": {"TEST013": SubsidyLevel.LEVEL_A}
        })
        voucher = create_sample_voucher("TEST013")
        db.add_voucher(voucher)
        voucher = db.get_voucher("TEST013")
        assert verification_service.check_monthly_report_consistency(voucher) == True

    def test_inconsistent_with_report(self):
        today = date.today()
        report_key = f"{today.year}-{today.month:02d}"
        db.add_monthly_report(report_key, {
            "voucher_list": ["TEST014"],
            "subsidy_levels": {"TEST014": SubsidyLevel.LEVEL_B}
        })
        voucher = create_sample_voucher("TEST014", subsidy_level=SubsidyLevel.LEVEL_A)
        db.add_voucher(voucher)
        voucher = db.get_voucher("TEST014")
        assert verification_service.check_monthly_report_consistency(voucher) == False


class TestRequiredMaterials:
    def test_get_required_materials_for_elderly(self):
        voucher = create_sample_voucher("TEST015", applicant_type="老年人", elderly_cert=False, household_registry=False)
        db.add_voucher(voucher)
        voucher = db.get_voucher("TEST015")
        required = verification_service.get_required_materials(voucher)
        assert "户口本" in required
        assert "老年证" in required

    def test_get_required_materials_for_disability(self):
        voucher = create_sample_voucher("TEST016", applicant_type="残疾人", disability_cert=False, income_proof=False)
        db.add_voucher(voucher)
        voucher = db.get_voucher("TEST016")
        required = verification_service.get_required_materials(voucher)
        assert "收入证明" in required
        assert "残疾证" in required


class TestFullFlow:
    def test_single_voucher_verification_pass(self):
        voucher = create_sample_voucher("TEST017")
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST017", "张三")
        assert result.status == VerificationStatus.VERIFIED
        assert len(failed) == 0

    def test_single_voucher_verification_supplement(self):
        voucher = create_sample_voucher("TEST018", household_registry=False)
        db.add_voucher(voucher)
        result, failed = verification_service.verify_voucher("TEST018", "张三")
        assert result.status == VerificationStatus.SUPPLEMENT
        assert len(result.required_materials) > 0

    def test_withdraw_voucher(self):
        voucher = create_sample_voucher("TEST019")
        db.add_voucher(voucher)
        db.update_voucher("TEST019", verification_status=VerificationStatus.WITHDRAWN, operator="管理员")
        updated = db.get_voucher("TEST019")
        assert updated.verification_status == VerificationStatus.WITHDRAWN


class TestSampleData:
    def test_multiple_sample_vouchers(self):
        samples = [
            create_sample_voucher("MV20240001", name="李大爷", elderly_age=85, subsidy_level=SubsidyLevel.LEVEL_A),
            create_sample_voucher("MV20240002", name="王阿姨", elderly_age=72, subsidy_level=SubsidyLevel.LEVEL_B),
            create_sample_voucher("MV20240003", name="赵叔叔", applicant_type="残疾人", disability_cert=True, subsidy_level=SubsidyLevel.LEVEL_B),
            create_sample_voucher("MV20240004", name="刘奶奶", elderly_age=78, low_income_cert=True, subsidy_level=SubsidyLevel.LEVEL_A),
            create_sample_voucher("MV20240005", name="陈叔叔", applicant_type="低保户", low_income_cert=True, subsidy_level=SubsidyLevel.LEVEL_B),
        ]
        for v in samples:
            db.add_voucher(v)
        
        assert len(db.get_all_vouchers()) == 5
        
        for v in samples:
            result, failed = verification_service.verify_voucher(v.voucher_no, "测试员")
            print(f"\n{v.voucher_no} ({v.name}):")
            print(f"  状态: {result.status}")
            if failed:
                print(f"  失败规则: {failed}")
            if result.required_materials:
                print(f"  需补充材料: {result.required_materials}")
            print(f"  月报一致: {result.monthly_report_consistent}")
            print(f"  旧券可用: {result.old_voucher_usable}")
