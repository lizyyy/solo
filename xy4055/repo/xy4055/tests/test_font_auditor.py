import pytest
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import json

from font_auditor.config import (
    AuditConfig, FontLicense, Client, Project, ConfigManager
)
from font_auditor.checker import (
    FontNameNormalizer, LicenseChecker, check_font_usage,
    ViolationType, Violation
)
from font_auditor.scanner import (
    FontUsageResult, CSSParser, HTMLParser, SVGParser, ManifestParser
)
from font_auditor.hash_cache import FontHashCalculator, HashCache
from font_auditor.quarantine import QuarantineManager, QuarantineEntry


class TestFontNameNormalizer:
    def test_normalize_basic(self):
        assert FontNameNormalizer.normalize("Arial") == "arial"
        assert FontNameNormalizer.normalize("Microsoft YaHei") == "microsoftyahei"
    
    def test_normalize_remove_suffix(self):
        assert FontNameNormalizer.normalize("Arial Bold") == "arial"
        assert FontNameNormalizer.normalize("PingFang SC Regular") == "pingfangsc"
        assert FontNameNormalizer.normalize("Noto Sans SC-Bold") == "notosanssc"
    
    def test_match_same(self):
        assert FontNameNormalizer.match("Arial", "arial") is True
        assert FontNameNormalizer.match("Microsoft YaHei", "microsoftyahei") is True
    
    def test_match_with_suffix(self):
        assert FontNameNormalizer.match("Arial", "Arial Bold") is True
        assert FontNameNormalizer.match("PingFang SC", "PingFang SC Regular") is True
    
    def test_match_different(self):
        assert FontNameNormalizer.match("Arial", "Times New Roman") is False
        assert FontNameNormalizer.match("PingFang SC", "Noto Sans SC") is False


class TestLicenseChecker:
    def setup_method(self):
        self.config = AuditConfig()
        self.config.fonts["Arial"] = FontLicense(
            font_name="Arial",
            license_type="系统授权",
            allowed_usage=["print", "web"],
            allowed_regions=["CN", "US"],
            is_perpetual=True,
        )
        self.config.fonts["PingFang SC"] = FontLicense(
            font_name="PingFang SC",
            license_type="系统授权",
            allowed_usage=["print", "web", "presentation"],
            allowed_regions=["CN"],
            is_perpetual=True,
        )
        self.config.default_allowed_fonts = ["Helvetica", "sans-serif"]
        self.config.default_blacklisted_fonts = ["Comic Sans MS"]
        
        self.config.clients["test-client"] = Client(
            client_id="test-client",
            client_name="Test Client",
            default_region="CN",
            blacklisted_fonts=["Times New Roman"],
        )
        
        self.config.projects["test-project"] = Project(
            project_id="test-project",
            project_name="Test Project",
            client_id="test-client",
            usage_type=["print", "web"],
            region="CN",
        )
    
    def test_unknown_font(self):
        project = self.config.projects["test-project"]
        checker = LicenseChecker(self.config, project)
        
        usage = FontUsageResult(
            font_name="UnknownFont",
            file_path="/test/file.html",
            file_type="html",
        )
        
        violation, warning, compliant = checker.check_font(usage)
        
        assert violation is not None
        assert violation.violation_type == ViolationType.UNKNOWN_FONT
        assert compliant is False
    
    def test_blacklisted_font(self):
        project = self.config.projects["test-project"]
        checker = LicenseChecker(self.config, project)
        
        usage = FontUsageResult(
            font_name="Times New Roman",
            file_path="/test/file.html",
            file_type="html",
        )
        
        violation, warning, compliant = checker.check_font(usage)
        
        assert violation is not None
        assert violation.violation_type == ViolationType.BLACKLISTED
        assert compliant is False
    
    def test_default_allowed_font(self):
        project = self.config.projects["test-project"]
        checker = LicenseChecker(self.config, project)
        
        usage = FontUsageResult(
            font_name="Helvetica",
            file_path="/test/file.html",
            file_type="html",
        )
        
        violation, warning, compliant = checker.check_font(usage)
        
        assert violation is None
        assert compliant is True
    
    def test_expired_license(self):
        past_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        self.config.fonts["ExpiredFont"] = FontLicense(
            font_name="ExpiredFont",
            license_type="商业授权",
            allowed_usage=["print"],
            allowed_regions=["CN"],
            start_date="2020-01-01",
            end_date=past_date,
            is_perpetual=False,
        )
        
        project = self.config.projects["test-project"]
        checker = LicenseChecker(self.config, project)
        
        usage = FontUsageResult(
            font_name="ExpiredFont",
            file_path="/test/file.html",
            file_type="html",
        )
        
        violation, warning, compliant = checker.check_font(usage)
        
        assert violation is not None
        assert violation.violation_type == ViolationType.EXPIRED_LICENSE
        assert compliant is False
    
    def test_usage_mismatch(self):
        project = Project(
            project_id="test-presentation",
            project_name="Presentation",
            client_id="test-client",
            usage_type=["presentation"],
            region="CN",
        )
        checker = LicenseChecker(self.config, project)
        
        usage = FontUsageResult(
            font_name="Arial",
            file_path="/test/file.html",
            file_type="html",
        )
        
        violation, warning, compliant = checker.check_font(usage)
        
        assert violation is not None
        assert violation.violation_type == ViolationType.USAGE_MISMATCH
        assert compliant is False
    
    def test_region_mismatch(self):
        project = Project(
            project_id="test-eu",
            project_name="EU Project",
            client_id="test-client",
            usage_type=["web"],
            region="EU",
        )
        checker = LicenseChecker(self.config, project)
        
        usage = FontUsageResult(
            font_name="PingFang SC",
            file_path="/test/file.html",
            file_type="html",
        )
        
        violation, warning, compliant = checker.check_font(usage)
        
        assert violation is not None
        assert violation.violation_type == ViolationType.REGION_MISMATCH
        assert compliant is False
    
    def test_compliant_font(self):
        project = self.config.projects["test-project"]
        checker = LicenseChecker(self.config, project)
        
        usage = FontUsageResult(
            font_name="Arial",
            file_path="/test/file.html",
            file_type="html",
        )
        
        violation, warning, compliant = checker.check_font(usage)
        
        assert violation is None
        assert compliant is True


class TestParsers:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.tmp_path = Path(self.tmpdir)
    
    def test_css_parser(self):
        css_content = """
        .header {
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            font-size: 24px;
        }
        
        @font-face {
            font-family: 'CustomFont';
            src: url('custom.woff2') format('woff2');
        }
        
        .body {
            font-family: Arial, Helvetica, sans-serif;
        }
        """
        css_file = self.tmp_path / "test.css"
        css_file.write_text(css_content, encoding="utf-8")
        
        parser = CSSParser()
        results = parser.parse(css_file)
        
        font_names = {r.font_name for r in results}
        assert "PingFang SC" in font_names or "Microsoft YaHei" in font_names or "Arial" in font_names
    
    def test_html_parser(self):
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'PingFang SC', sans-serif; }
            </style>
        </head>
        <body>
            <h1 style="font-family: 'Microsoft YaHei';">标题</h1>
            <p>正文</p>
            <font face="Arial">旧格式</font>
        </body>
        </html>
        """
        html_file = self.tmp_path / "test.html"
        html_file.write_text(html_content, encoding="utf-8")
        
        parser = HTMLParser()
        results = parser.parse(html_file)
        
        font_names = {r.font_name for r in results}
        assert "PingFang SC" in font_names or "Microsoft YaHei" in font_names or "Arial" in font_names
    
    def test_svg_parser(self):
        svg_content = """<?xml version="1.0" encoding="UTF-8"?>
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
            <style>
                .title { font-family: 'Microsoft YaHei', sans-serif; }
            </style>
            <text x="20" y="50" class="title" font-family="SimHei">品牌标识</text>
            <text x="20" y="100" style="font-family: 'Arial', sans-serif;">English</text>
        </svg>
        """
        svg_file = self.tmp_path / "test.svg"
        svg_file.write_text(svg_content, encoding="utf-8")
        
        parser = SVGParser()
        results = parser.parse(svg_file)
        
        font_names = {r.font_name for r in results}
        assert "Microsoft YaHei" in font_names or "SimHei" in font_names or "Arial" in font_names
    
    def test_manifest_parser(self):
        manifest_content = {
            "name": "Test Project",
            "fonts": {
                "primary": "PingFang SC",
                "secondary": "Noto Sans SC",
                "english": "Arial"
            }
        }
        json_file = self.tmp_path / "manifest.json"
        json_file.write_text(json.dumps(manifest_content), encoding="utf-8")
        
        parser = ManifestParser()
        results = parser.parse(json_file)
        
        font_names = {r.font_name for r in results}
        assert "PingFang SC" in font_names or "Noto Sans SC" in font_names or "Arial" in font_names


class TestHashCache:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.tmp_path = Path(self.tmpdir)
    
    def test_hash_calculator_string(self):
        content1 = "test content"
        content2 = "test content"
        content3 = "different content"
        
        hash1 = FontHashCalculator.calculate_string_hash(content1)
        hash2 = FontHashCalculator.calculate_string_hash(content2)
        hash3 = FontHashCalculator.calculate_string_hash(content3)
        
        assert hash1 == hash2
        assert hash1 != hash3
    
    def test_hash_calculator_file(self):
        test_file = self.tmp_path / "test.txt"
        test_file.write_text("test content", encoding="utf-8")
        
        hash1 = FontHashCalculator.calculate_file_hash(test_file)
        hash2 = FontHashCalculator.calculate_file_hash(test_file)
        
        assert hash1 == hash2
    
    def test_cache_basic(self):
        cache = HashCache(self.tmp_path)
        
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
    
    def test_cache_expired(self):
        cache = HashCache(self.tmp_path)
        
        cache.set("key1", "value1", ttl_seconds=-1)
        assert cache.get("key1") is None
    
    def test_cache_delete(self):
        cache = HashCache(self.tmp_path)
        
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        
        assert cache.delete("key1") is True
        assert cache.get("key1") is None
        assert cache.get("key2") == "value2"
    
    def test_cache_clear(self):
        cache = HashCache(self.tmp_path)
        
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        
        count = cache.clear()
        assert count == 2
        assert cache.get("key1") is None


class TestQuarantineManager:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.tmp_path = Path(self.tmpdir)
        self.quarantine_file = self.tmp_path / "quarantine.json"
    
    def test_add_violation(self):
        manager = QuarantineManager(self.quarantine_file)
        
        violation = Violation(
            font_name="TestFont",
            violation_type=ViolationType.UNKNOWN_FONT,
            message="测试违规",
            file_path="/test/file.html",
            severity="high",
        )
        
        entry = manager.add_violation(violation)
        
        assert entry.font_name == "TestFont"
        assert entry.status == "active"
        
        loaded = manager.load()
        assert len(loaded.entries) == 1
    
    def test_resolve_violation(self):
        manager = QuarantineManager(self.quarantine_file)
        
        violation = Violation(
            font_name="TestFont",
            violation_type=ViolationType.UNKNOWN_FONT,
            message="测试违规",
            file_path="/test/file.html",
            severity="high",
        )
        
        entry = manager.add_violation(violation)
        
        assert manager.resolve(entry.id, notes="已修复") is True
        
        loaded = manager.load()
        assert loaded.entries[0].status == "resolved"
        assert loaded.entries[0].notes == "已修复"
    
    def test_get_active_entries(self):
        manager = QuarantineManager(self.quarantine_file)
        
        violation1 = Violation(
            font_name="Font1",
            violation_type=ViolationType.UNKNOWN_FONT,
            message="违规1",
            file_path="/test/file1.html",
            severity="high",
        )
        violation2 = Violation(
            font_name="Font2",
            violation_type=ViolationType.BLACKLISTED,
            message="违规2",
            file_path="/test/file2.html",
            severity="high",
        )
        
        entry1 = manager.add_violation(violation1)
        entry2 = manager.add_violation(violation2)
        
        manager.resolve(entry1.id)
        
        active = manager.get_active_entries()
        assert len(active) == 1
        assert active[0].font_name == "Font2"


class TestConfigManager:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.tmp_path = Path(self.tmpdir)
    
    def test_init_config(self):
        manager = ConfigManager(self.tmp_path)
        config = manager.init_config()
        
        assert config.version == "1.0"
        assert self.tmp_path / "font-auditor.json"
    
    def test_add_font(self):
        manager = ConfigManager(self.tmp_path)
        manager.init_config()
        
        font = FontLicense(
            font_name="TestFont",
            license_type="测试授权",
            is_perpetual=True,
        )
        
        manager.add_font(font)
        
        loaded = manager.load()
        assert "TestFont" in loaded.fonts
        assert loaded.fonts["TestFont"].license_type == "测试授权"
    
    def test_add_client(self):
        manager = ConfigManager(self.tmp_path)
        manager.init_config()
        
        client = Client(
            client_id="test-client",
            client_name="测试客户",
        )
        
        manager.add_client(client)
        
        loaded = manager.load()
        assert "test-client" in loaded.clients
        assert loaded.clients["test-client"].client_name == "测试客户"
    
    def test_add_project(self):
        manager = ConfigManager(self.tmp_path)
        manager.init_config()
        
        project = Project(
            project_id="test-project",
            project_name="测试项目",
            client_id="test-client",
        )
        
        manager.add_project(project)
        
        loaded = manager.load()
        assert "test-project" in loaded.projects
        assert loaded.projects["test-project"].project_name == "测试项目"
