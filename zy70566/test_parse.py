import sys
sys.path.insert(0, ".")
from san_checker.parser import parse_domain_list
domains, bad_lines = parse_domain_list("examples/domains.txt")
print("Loaded", len(domains), "valid domains")
print("Found", len(bad_lines), "bad lines")
for bl in bad_lines:
    print(f"  Line {bl['line']}: {bl['content']} [{bl['reason']}]")
