#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("字体授权交付巡检员 - 模块验证测试")
print("=" * 60)

print("\n1. 测试核心模块导入...")
from font_auditor.version import __version__
print(f"   版本: {__version__}")

from font_auditor.config import AuditConfig, FontLicense, Client, Project, ConfigManager
print("   config 模块: OK")

from font_auditor.checker import FontNameNormalizer, LicenseChecker, check_font_usage, ViolationType
print("   checker 模块: OK")

from font_auditor.scanner import FontUsageResult, CSSParser, HTMLParser, SVGParser, ManifestParser
print("   scanner 模块: OK")

from font_auditor.hash_cache import FontHashCalculator, HashCache
print("   hash_cache 模块: OK")

from font_auditor.quarantine import QuarantineManager
print("   quarantine 模块: OK")

from font_auditor.reporter import Reporter
print("   reporter 模块: OK")

from font_auditor.demo import create_demo_directory
print("   demo 模块: OK")

print("\n2. 测试字体名称标准化...")
test_cases = [
    ("Arial", "Arial", True),
    ("Arial Bold", "Arial", True),
    ("Microsoft YaHei", "microsoftyahei", True),
    ("PingFang SC Regular", "PingFang SC", True),
    ("Arial", "Times New Roman", False),
]

for font1, font2, expected in test_cases:
    result = FontNameNormalizer.match(font1, font2)
    status = "✓" if result == expected else "✗"
    print(f"   {status} '{font1}' vs '{font2}': {result} (expected: {expected})")

print("\n3. 测试授权规则检查...")

config = AuditConfig()
config.fonts["Arial"] = FontLicense(
    font_name="Arial",
    license_type="系统授权",
    allowed_usage=["print", "web"],
    allowed_regions=["CN", "US"],
    is_perpetual=True,
)
config.fonts["PingFang SC"] = FontLicense(
    font_name="PingFang SC",
    license_type="系统授权",
    allowed_usage=["print", "web", "presentation"],
    allowed_regions=["CN"],
    is_perpetual=True,
)
config.default_allowed_fonts = ["Helvetica", "sans-serif"]
config.default_blacklisted_fonts = ["Comic Sans MS"]

config.clients["test-client"] = Client(
    client_id="test-client",
    client_name="Test Client",
    default_region="CN",
    blacklisted_fonts=["Times New Roman"],
)

config.projects["test-project"] = Project(
    project_id="test-project",
    project_name="Test Project",
    client_id="test-client",
    usage_type=["print", "web"],
    region="CN",
)

test_usages = [
    FontUsageResult(font_name="Arial", file_path="/test.html", file_type="html"),
    FontUsageResult(font_name="Times New Roman", file_path="/test.html", file_type="html"),
    FontUsageResult(font_name="UnknownFont", file_path="/test.html", file_type="html"),
    FontUsageResult(font_name="Helvetica", file_path="/test.html", file_type="html"),
]

checker = LicenseChecker(config, config.projects["test-project"])

for usage in test_usages:
    violation, warning, compliant = checker.check_font(usage)
    status = "合规" if compliant else "违规"
    violation_type = violation.violation_type.value if violation else "N/A"
    print(f"   - {usage.font_name}: {status} (类型: {violation_type})")

print("\n4. 测试文件解析器...")

import tempfile
import json

tmpdir = tempfile.mkdtemp()
tmp_path = Path(tmpdir)

css_content = """
.header {
    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.body {
    font-family: Arial, Helvetica, sans-serif;
}
"""
css_file = tmp_path / "test.css"
css_file.write_text(css_content, encoding="utf-8")

parser = CSSParser()
results = parser.parse(css_file)
print(f"   CSS 解析器: 发现 {len(results)} 个字体")
for r in results:
    print(f"      - {r.font_name}")

manifest_content = {
    "name": "Test Project",
    "fonts": {
        "primary": "PingFang SC",
        "secondary": "Noto Sans SC",
    }
}
json_file = tmp_path / "manifest.json"
json_file.write_text(json.dumps(manifest_content), encoding="utf-8")

parser = ManifestParser()
results = parser.parse(json_file)
print(f"   Manifest 解析器: 发现 {len(results)} 个字体")
for r in results:
    print(f"      - {r.font_name}")

print("\n5. 测试哈希计算...")

hash1 = FontHashCalculator.calculate_string_hash("test content")
hash2 = FontHashCalculator.calculate_string_hash("test content")
hash3 = FontHashCalculator.calculate_string_hash("different content")

print(f"   相同内容哈希一致: {hash1 == hash2}")
print(f"   不同内容哈希不同: {hash1 != hash3}")

print("\n" + "=" * 60)
print("所有核心模块测试通过!")
print("=" * 60)
