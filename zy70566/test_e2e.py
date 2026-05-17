from san_checker.parser import parse_domain_list
from san_checker.comparer import compare_san, check_certificate_expiry
from san_checker.reporter import generate_terminal_summary
import sys

print("=" * 70)
print("证书 SAN 核对 CLI - 功能验证")
print("=" * 70)

# 1. 解析域名
domain_result = parse_domain_list('examples/domains.txt')
print(f"\n1. 域名解析: {domain_result['domain_count']} 有效域名, {domain_result['bad_line_count']} 坏行")

# 2. SAN 对比
actual_san = [
    'example.com', 'www.example.com', 'api.example.com', 'cdn.example.com',
    'gray.example.com', '*.test.example.com', 'admin.example.com', 'dashboard.example.com'
]
compare_result = compare_san(domain_result['domains'], actual_san)
print(f"2. SAN对比: 检测到 {compare_result['missing_count']} 个缺失域名")
print(f"   缺失项: {compare_result['missing_domains']}")

# 3. 过期检查
expiry = check_certificate_expiry({'days_remaining': 10, 'from san_checker.parser import parse_domain_list
from san_checker.compapifrom san_checker.comparer import compare_san, c [from san_checker.reporter import generate_: bl['raw_content'], 'reason'import sys

print("=" * 70)
print("证书 SAN 核对 CLI ]

printy = geprint("证书al_print("=" * 70)

# 1. 解析域名
domain_reba
# 1. 解析?indomain_result = ?rint(f"\n1. 域名解析: {domain_result['domain_count'("
# 2. SAN 对比
actual_san = [
    'example.com', 'www.example.com', 'api.example.com', 'cdn.example.com',
    'g?:"actual_san = [ p    'example._c    'gray.example.com', '*.test.example.com', 'admin.example.com', 'dashboan]
compare_result = compare_san(domain_result['domains'], actual_san)
print(f"2. SAN对比s.txprint(f"2. SAN对比: 检测?")
print("✅ 支持的输出格式:"print(f"   缺失项: {compare_result['missing_domains']}")

# 3. 过期检查
exp")
# 3.t("   - 导出到文件 (-o output.txt)")
