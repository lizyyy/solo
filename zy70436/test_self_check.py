#!/usr/bin/env python3
"""自检脚本 - 验证所有边界情况"""

import json
import tempfile
import shutil
from pathlib import Path
from datetime import date, timedelta

from cert_inspector.models import (
    Certificate, LakePartitionInfo, RiskType,
    DataSource, CertificateStatus
)
from cert_inspector.core import CertificateInspector
from cert_inspector.output import OutputFormatter


def test_certificate_risk_level():
    """测试证书风险等级计算"""
    print("测试1: 证书风险等级计算...", end=" ")
    
    today = date.today()
    
    cert_expired = Certificate(
        cert_id="TEST-001",
        cert_no="TEST-NO-001",
        cert_type="测试类型",
        holder="测试持有人",
        issue_date=today - timedelta(days=365),
        expiry_date=today - timedelta(days=10),
        issuer="测试签发机构",
        status=CertificateStatus.VALID,
        data_source=DataSource.FINANCE,
        batch_no="BATCH-TEST-001",
        department="测试部门"
    )
    assert cert_expired.risk_level == RiskType.EXPIRED, "已过期证书风险类型错误"
    assert cert_expired.days_until_expiry == -10, "剩余天数计算错误"
    
    cert_expiring_soon = Certificate(
        cert_id="TEST-002",
        cert_no="TEST-NO-002",
        cert_type="测试类型",
        holder="测试持有人",
        issue_date=today - timedelta(days=365),
        expiry_date=today + timedelta(days=15),
        issuer="测试签发机构",
        status=CertificateStatus.VALID,
        data_source=DataSource.FINANCE,
        batch_no="BATCH-TEST-001",
        department="测试部门"
    )
    assert cert_expiring_soon.risk_level == RiskType.EXPIRING_SOON, "即将过期证书风险类型错误"
    assert cert_expiring_soon.days_until_expiry == 15, "剩余天数计算错误"
    
    cert_normal = Certificate(
        cert_id="TEST-003",
        cert_no="TEST-NO-003",
        cert_type="测试类型",
        holder="测试持有人",
        issue_date=today - timedelta(days=365),
        expiry_date=today + timedelta(days=60),
        issuer="测试签发机构",
        status=CertificateStatus.VALID,
        data_source=DataSource.FINANCE,
        batch_no="BATCH-TEST-001",
        department="测试部门"
    )
    assert cert_normal.risk_level == RiskType.NORMAL, "正常证书风险类型错误"
    
    print("通过")


def test_batch_conflict_detection():
    """测试批次号冲突检测"""
    print("测试2: 批次号冲突检测...", end=" ")
    
    inspector = CertificateInspector(data_dir=tempfile.mkdtemp())
    
    partitions = [
        LakePartitionInfo(
            partition_id=f"PART-{i:03d}",
            data_source=DataSource.FINANCE,
            batch_no="BATCH-CONFLICT-001",
            department=f"部门{i}",
            submitter=f"提交人{i}",
            submit_date=date.today(),
            cert_count=10,
            data_date=date.today(),
            environment="生产环境"
        )
        for i in range(3)
    ]
    partitions.append(LakePartitionInfo(
        partition_id="PART-100",
        data_source=DataSource.FINANCE,
        batch_no="BATCH-UNIQUE-001",
        department="唯一部门",
        submitter="唯一提交人",
        submit_date=date.today(),
        cert_count=5,
        data_date=date.today(),
        environment="UAT环境"
    ))
    
    conflicts = inspector.detect_batch_conflicts(partitions)
    assert len(conflicts) == 1, f"应该检测到1个冲突，实际检测到{len(conflicts)}个"
    assert conflicts[0]["batch_no"] == "BATCH-CONFLICT-001", "冲突批次号错误"
    assert conflicts[0]["conflict_count"] == 3, "冲突数量错误"
    assert conflicts[0]["risk_type"] == RiskType.BATCH_CONFLICT, "风险类型错误"
    
    print("通过")


def test_inspection_result():
    """测试巡检结果"""
    print("测试3: 巡检结果生成...", end=" ")
    
    data_dir = tempfile.mkdtemp()
    inspector = CertificateInspector(data_dir=data_dir)
    
    today = date.today()
    certificates = []
    for i in range(5):
        cert = Certificate(
            cert_id=f"CERT-{i:03d}",
            cert_no=f"CERT-NO-{i:03d}",
            cert_type="测试类型",
            holder=f"持有人{i}",
            issue_date=today - timedelta(days=365),
            expiry_date=today + timedelta(days=i * 10 - 10),
            issuer="测试签发机构",
            status=CertificateStatus.VALID,
            data_source=DataSource.FINANCE,
            batch_no="BATCH-TEST-001",
            department="测试部门"
        )
        certificates.append(cert)
    
    result = inspector.inspect_certificates(certificates, inspector="tester")
    
    assert result.total_certs == 5, "证书总数错误"
    assert result.batch_id.startswith("INSPECT-"), "批次ID格式错误"
    assert result.inspector == "tester", "巡检人错误"
    
    history = inspector.get_history()
    assert len(history) == 1, "历史记录数量错误"
    
    print("通过")


def test_history_filtering():
    """测试历史记录过滤"""
    print("测试4: 历史记录过滤...", end=" ")
    
    data_dir = tempfile.mkdtemp()
    inspector = CertificateInspector(data_dir=data_dir)
    
    today = date.today()
    
    for i in range(3):
        certificates = []
        for j in range(2):
            days = -5 if i == 0 else 15 if i == 1 else 60
            cert = Certificate(
                cert_id=f"CERT-{i}-{j}",
                cert_no=f"NO-{i}-{j}",
                cert_type="测试",
                holder="测试",
                issue_date=today - timedelta(days=365),
                expiry_date=today + timedelta(days=days),
                issuer="测试",
                status=CertificateStatus.VALID,
                data_source=DataSource.FINANCE,
                batch_no=f"BATCH-{i}",
                department="测试"
            )
            certificates.append(cert)
        
        inspector.inspect_certificates(certificates, inspector=f"user{i}")
    
    all_history = inspector.get_history()
    assert len(all_history) == 3, "历史记录总数错误"
    
    by_operator = inspector.get_history(operator="user0")
    assert len(by_operator) == 1, "按操作者过滤错误"
    
    by_risk = inspector.get_history(risk_type=RiskType.EXPIRED)
    assert len(by_risk) >= 1, "按风险类型过滤错误"
    
    print("通过")


def test_manual_correction():
    """测试人工修正功能"""
    print("测试5: 人工修正功能...", end=" ")
    
    data_dir = tempfile.mkdtemp()
    inspector = CertificateInspector(data_dir=data_dir)
    
    today = date.today()
    cert = Certificate(
        cert_id="CERT-CORR-001",
        cert_no="CORR-NO-001",
        cert_type="测试类型",
        holder="测试持有人",
        issue_date=today - timedelta(days=365),
        expiry_date=today - timedelta(days=5),
        issuer="测试签发机构",
        status=CertificateStatus.VALID,
        data_source=DataSource.FINANCE,
        batch_no="BATCH-CORR-001",
        department="测试部门"
    )
    
    result = inspector.inspect_certificates([cert], inspector="tester")
    
    correction = inspector.add_manual_correction(
        cert_id="CERT-CORR-001",
        original_risk=RiskType.EXPIRED,
        corrected_risk=RiskType.NORMAL,
        operator="审核员",
        remark="已人工审核确认",
        batch_id=result.batch_id
    )
    
    assert correction.cert_id == "CERT-CORR-001", "修正证书ID错误"
    assert correction.original_risk == RiskType.EXPIRED, "原始风险类型错误"
    assert correction.corrected_risk == RiskType.NORMAL, "修正后风险类型错误"
    
    corrections = inspector.get_manual_corrections(cert_id="CERT-CORR-001")
    assert len(corrections) == 1, "修正记录查询错误"
    
    updated_history = inspector.get_history(batch_id=result.batch_id)
    assert len(updated_history[0]["manual_corrections"]) == 1, "历史记录未更新修正信息"
    
    print("通过")


def test_output_formatter():
    """测试输出格式化"""
    print("测试6: 输出格式化...", end=" ")
    
    test_result = {
        "batch_id": "INSPECT-TEST-001",
        "inspector": "tester",
        "inspection_time": "2024-01-15T10:00:00",
        "total_certs": 10,
        "expired_count": 2,
        "expiring_soon_count": 3,
        "batch_conflicts": [],
        "risk_details": [],
        "manual_corrections": []
    }
    
    json_output = OutputFormatter.to_json(test_result)
    parsed = json.loads(json_output)
    assert parsed["batch_id"] == "INSPECT-TEST-001", "JSON输出错误"
    
    md_output = OutputFormatter.to_markdown(test_result)
    assert "# 证书过期巡检报告" in md_output, "Markdown标题缺失"
    assert "INSPECT-TEST-001" in md_output, "批次ID未在Markdown中出现"
    
    output_dir = Path(tempfile.mkdtemp())
    json_path = output_dir / "test_output.json"
    md_path = output_dir / "test_output.md"
    
    OutputFormatter.save_json(test_result, str(json_path))
    OutputFormatter.save_markdown(test_result, str(md_path))
    
    assert json_path.exists(), "JSON文件未保存"
    assert md_path.exists(), "Markdown文件未保存"
    
    shutil.rmtree(output_dir)
    
    print("通过")


def test_sample_data():
    """测试样例数据加载"""
    print("测试7: 样例数据加载...", end=" ")
    
    project_root = Path(__file__).parent
    sample_dir = project_root / "sample_data"
    
    inspector = CertificateInspector(data_dir=tempfile.mkdtemp())
    
    cert_file = sample_dir / "certificates_sample.json"
    certificates = inspector.load_certificates(str(cert_file))
    assert len(certificates) > 0, "证书样例数据加载失败"
    
    partition_file = sample_dir / "lake_partitions_normal.json"
    partitions = inspector.load_partitions(str(partition_file))
    assert len(partitions) > 0, "分区样例数据加载失败"
    
    conflict_file = sample_dir / "lake_partitions_with_conflicts.json"
    conflict_partitions = inspector.load_partitions(str(conflict_file))
    assert len(conflict_partitions) > 0, "含冲突分区样例数据加载失败"
    
    conflicts = inspector.detect_batch_conflicts(conflict_partitions)
    assert len(conflicts) > 0, "未检测到样例数据中的冲突"
    
    print("通过")


def run_all_tests():
    """运行所有测试"""
    print("=" * 50)
    print("证书过期巡检工具 - 自检脚本")
    print("=" * 50)
    print()
    
    tests = [
        test_certificate_risk_level,
        test_batch_conflict_detection,
        test_inspection_result,
        test_history_filtering,
        test_manual_correction,
        test_output_formatter,
        test_sample_data,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"失败: {e}")
            failed += 1
        except Exception as e:
            print(f"错误: {type(e).__name__}: {e}")
            failed += 1
    
    print()
    print("=" * 50)
    print(f"测试结果: 通过 {passed} / {len(tests)}")
    if failed == 0:
        print("所有测试通过! ✅")
    else:
        print(f"有 {failed} 个测试失败! ❌")
    print("=" * 50)
    
    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    exit(0 if success else 1)
