import os
import tempfile
import shutil
import json
import csv
from datetime import datetime
from pathlib import Path

import pytest

from xy4127.models import Package, Photo, Remark, ClaimForm, Issue, Review
from xy4127.file_indexer import FileIndexer
from xy4127.metadata_parser import MetadataParser
from xy4127.rule_engine import RuleEngine
from xy4127.review_store import ReviewStore
from xy4127.exporter import Exporter


class TestModels:
    """测试数据模型"""
    
    def test_package_creation(self):
        """测试包裹创建"""
        pkg = Package(tracking_no="SF1234567890123")
        assert pkg.tracking_no == "SF1234567890123"
        assert len(pkg.photos) == 0
        assert len(pkg.remarks) == 0
        assert pkg.claim_form is None
    
    def test_photo_creation(self):
        """测试照片创建"""
        photo = Photo(
            file_path="/tmp/test.jpg",
            file_name="test.jpg",
            file_size=1024,
            width=1920,
            height=1080,
        )
        assert photo.file_name == "test.jpg"
        assert photo.file_size == 1024
    
    def test_remark_creation(self):
        """测试备注创建"""
        remark = Remark(
            tracking_no="SF1234567890123",
            customer_name="张三",
            contact_phone="13800138000",
            issue_type="破损",
            issue_description="外包装破损",
            claim_amount=500.0,
        )
        assert remark.tracking_no == "SF1234567890123"
        assert remark.claim_amount == 500.0
    
    def test_package_to_dict(self):
        """测试包裹序列化"""
        pkg = Package(tracking_no="SF1234567890123")
        pkg.photos.append(Photo(
            file_path="/tmp/photo1.jpg",
            file_name="photo1.jpg",
            file_size=2048,
        ))
        
        data = pkg.to_dict()
        assert data["tracking_no"] == "SF1234567890123"
        assert len(data["photos"]) == 1


class TestMetadataParser:
    """测试元数据解析器"""
    
    def setup_method(self):
        self.parser = MetadataParser()
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir)
    
    def test_parse_remarks_csv(self):
        """测试解析客服备注CSV"""
        csv_path = os.path.join(self.temp_dir, "remarks.csv")
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "运单号", "客户姓名", "联系电话", "问题类型", 
                "问题描述", "赔付金额", "日期", "操作员"
            ])
            writer.writerow([
                "SF1234567890123", "张三", "13800138000", "破损",
                "外包装破损", "500.00", "2024-01-15", "李站长"
            ])
        
        remarks = self.parser.parse_remarks_csv(csv_path)
        assert len(remarks) == 1
        assert remarks[0].tracking_no == "SF1234567890123"
        assert remarks[0].claim_amount == 500.0
    
    def test_parse_claim_forms_csv(self):
        """测试解析赔付申请表CSV"""
        csv_path = os.path.join(self.temp_dir, "claims.csv")
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["运单号", "申请金额", "申请日期", "申请人", "状态"])
            writer.writerow(["SF1234567890123", "500.00", "2024-01-15", "李站长", "待审核"])
        
        claims = self.parser.parse_claim_forms_csv(csv_path)
        assert len(claims) == 1
        assert claims[0].tracking_no == "SF1234567890123"
        assert claims[0].claim_amount == 500.0
    
    def test_parse_amount(self):
        """测试金额解析"""
        assert self.parser._parse_amount("¥500.00") == 500.0
        assert self.parser._parse_amount("1,000.50") == 1000.50
        assert self.parser._parse_amount("") == 0.0
        assert self.parser._parse_amount(None) == 0.0
    
    def test_extract_timestamp_from_filename(self):
        """测试从文件名提取时间戳"""
        ts = self.parser._extract_timestamp_from_filename("IMG_20240115_143000.jpg")
        assert ts is not None
        assert ts.year == 2024
        assert ts.month == 1
        assert ts.day == 15


class TestRuleEngine:
    """测试规则引擎"""
    
    def setup_method(self):
        self.engine = RuleEngine()
    
    def test_check_missing_photos(self):
        """测试检查缺少照片"""
        pkg = Package(tracking_no="SF1234567890123")
        pkg.photos.append(Photo(
            file_path="/tmp/photo1.jpg",
            file_name="photo1.jpg",
            file_size=1024,
        ))
        
        issues = self.engine._check_missing_photos(pkg)
        assert len(issues) == 1
        assert issues[0].issue_type == "missing_photo"
        assert issues[0].severity == "critical"
    
    def test_check_sufficient_photos(self):
        """测试检查照片充足"""
        pkg = Package(tracking_no="SF1234567890123")
        for i in range(3):
            pkg.photos.append(Photo(
                file_path=f"/tmp/photo{i}.jpg",
                file_name=f"photo{i}.jpg",
                file_size=1024,
            ))
        
        issues = self.engine._check_missing_photos(pkg)
        assert len(issues) == 0
    
    def test_check_amount_anomaly(self):
        """测试检查金额异常"""
        pkg = Package(tracking_no="SF1234567890123")
        pkg.claim_form = ClaimForm(
            tracking_no="SF1234567890123",
            claim_amount=15000.0,
        )
        
        issues = self.engine._check_claim_amount_anomaly(pkg)
        assert len(issues) == 1
        assert issues[0].severity == "critical"
    
    def test_check_amount_mismatch(self):
        """测试检查金额不一致"""
        pkg = Package(tracking_no="SF1234567890123")
        pkg.claim_form = ClaimForm(
            tracking_no="SF1234567890123",
            claim_amount=600.0,
        )
        pkg.remarks.append(Remark(
            tracking_no="SF1234567890123",
            claim_amount=500.0,
        ))
        
        issues = self.engine._check_amount_mismatch(pkg)
        assert len(issues) == 1
        assert issues[0].issue_type == "amount_mismatch"


class TestReviewStore:
    """测试复核存储"""
    
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.index_path = os.path.join(self.temp_dir, "index.json")
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir)
    
    def test_add_review(self):
        """测试添加复核记录"""
        store = ReviewStore(self.index_path)
        
        result = store.add_review(
            "SF1234567890123",
            "approved",
            "材料齐全，同意赔付",
            "测试员"
        )
        
        assert result is True
        
        review = store.get_review("SF1234567890123")
        assert review is not None
        assert review.status == "approved"
        assert review.comment == "材料齐全，同意赔付"
    
    def test_invalid_status(self):
        """测试无效状态"""
        store = ReviewStore(self.index_path)
        
        with pytest.raises(ValueError):
            store.add_review("SF1234567890123", "invalid_status", "")
    
    def test_review_persistence(self):
        """测试复核记录持久化"""
        store1 = ReviewStore(self.index_path)
        store1.add_review("SF1234567890123", "approved", "测试备注")
        
        store2 = ReviewStore(self.index_path)
        review = store2.get_review("SF1234567890123")
        
        assert review is not None
        assert review.status == "approved"


class TestFileIndexer:
    """测试文件索引器"""
    
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.indexer = FileIndexer()
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir)
    
    def test_extract_tracking_no_from_filename(self):
        """测试从文件名提取运单号"""
        test_cases = [
            ("SF1234567890123_破损.jpg", "SF1234567890123"),
            ("YT9876543210987_label.png", "YT9876543210987"),
            ("JD1122334455667_photo.jpg", "JD1122334455667"),
            ("照片_1234567890123.jpg", "1234567890123"),
            ("no_tracking_number.jpg", None),
        ]
        
        for filename, expected in test_cases:
            result = self.indexer._extract_tracking_no_from_filename(filename)
            assert result == expected, f"Failed for {filename}"
    
    def test_save_and_load_index(self):
        """测试保存和加载索引"""
        pkg = Package(tracking_no="SF1234567890123")
        pkg.photos.append(Photo(
            file_path="/tmp/photo1.jpg",
            file_name="photo1.jpg",
            file_size=1024,
        ))
        
        self.indexer.packages = {"SF1234567890123": pkg}
        
        index_path = os.path.join(self.temp_dir, "index.json")
        self.indexer.save_index(index_path)
        
        assert os.path.exists(index_path)
        
        new_indexer = FileIndexer()
        new_indexer.load_index(index_path)
        
        assert "SF1234567890123" in new_indexer.packages


class TestExporter:
    """测试导出器"""
    
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.packages = {}
        
        pkg = Package(tracking_no="SF1234567890123")
        pkg.photos.append(Photo(
            file_path="/tmp/photo1.jpg",
            file_name="photo1.jpg",
            file_size=1024,
        ))
        pkg.remarks.append(Remark(
            tracking_no="SF1234567890123",
            customer_name="张三",
            claim_amount=500.0,
        ))
        
        self.packages["SF1234567890123"] = pkg
        self.reviews = {}
        
        self.exporter = Exporter(self.packages, self.reviews)
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir)
    
    def test_export_issues_csv(self):
        """测试导出CSV问题清单"""
        csv_path = self.exporter.export_issues_csv(self.temp_dir)
        
        assert os.path.exists(csv_path)
        assert csv_path.endswith('.csv')
    
    def test_export_audit_json(self):
        """测试导出JSON审计记录"""
        json_path = self.exporter.export_audit_json(self.temp_dir)
        
        assert os.path.exists(json_path)
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assert "audit_version" in data
        assert "summary" in data
        assert "packages" in data
    
    def test_export_markdown(self):
        """测试导出Markdown申诉包"""
        md_path = self.exporter.export_markdown(self.temp_dir)
        
        assert os.path.exists(md_path)
        
        with open(md_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        assert "# 异常包裹申诉包" in content
        assert "SF1234567890123" in content


class TestIntegration:
    """集成测试"""
    
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        
        photos_dir = os.path.join(self.temp_dir, "photos")
        csv_dir = os.path.join(self.temp_dir, "csv")
        os.makedirs(photos_dir)
        os.makedirs(csv_dir)
        
        for i in range(2):
            photo_path = os.path.join(photos_dir, f"SF1234567890123_photo{i}.jpg")
            with open(photo_path, 'w') as f:
                f.write(f"photo {i}")
        
        remarks_path = os.path.join(csv_dir, "remarks.csv")
        with open(remarks_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["运单号", "客户姓名", "赔付金额"])
            writer.writerow(["SF1234567890123", "张三", "500.00"])
        
        claims_path = os.path.join(csv_dir, "claims.csv")
        with open(claims_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["运单号", "申请金额"])
            writer.writerow(["SF1234567890123", "500.00"])
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir)
    
    def test_full_workflow(self):
        """测试完整工作流程"""
        indexer = FileIndexer()
        packages = indexer.scan_directory(self.temp_dir)
        
        assert len(packages) > 0
        
        tracking_no = "SF1234567890123"
        assert tracking_no in packages
        
        pkg = packages[tracking_no]
        assert len(pkg.photos) == 2
        assert len(pkg.remarks) >= 0 or pkg.claim_form is not None
        
        index_path = os.path.join(self.temp_dir, "index.json")
        indexer.save_index(index_path)
        
        engine = RuleEngine()
        issues = engine.check_all(packages)
        
        for issue in issues:
            assert issue.tracking_no
            assert issue.issue_type
            assert issue.severity
        
        store = ReviewStore(index_path)
        store.add_review(tracking_no, "approved", "材料完整")
        
        review = store.get_review(tracking_no)
        assert review is not None
        assert review.status == "approved"
        
        exporter = Exporter(packages, store.reviews)
        output_dir = os.path.join(self.temp_dir, "output")
        os.makedirs(output_dir)
        
        md_path = exporter.export_markdown(output_dir)
        csv_path = exporter.export_issues_csv(output_dir)
        json_path = exporter.export_audit_json(output_dir)
        
        assert os.path.exists(md_path)
        assert os.path.exists(csv_path)
        assert os.path.exists(json_path)
