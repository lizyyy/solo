import sys
sys.path.insert(0, ".")
from san_checker.parser import parse_domain_list
domains, bad_lines = parse_domain_list("examples/domains.txt")
print("Loaded domains:", len(domains))
print("Bad lines:", len(bad_lines))
