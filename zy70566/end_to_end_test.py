import sys
sys.path.insert(0, ".")
from san_checker.parser import parse_domain_list
from san_checker.comparer import compare_san
from san_checker.reporter import generate_terminal_summary, generate_json_output

# Test domain parsing
domain_result = parse_domain_list("examples/domains.txt")
print("Domains loaded:", len(domain_result["domains"]))
print("Bad lines found:", len(domain_result["bad_lines"]))

# Simulate SAN list
actual_san = [
    "example.com",
    "www.example.com",
    "api.example.com",
    "cdn.example.com",
    "gray.example.com",
    "*.test.example.com",
    "admin.example.com",
    "dashboard.example.com"
]

