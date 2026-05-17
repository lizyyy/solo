import yaml
from k8s_port_mapper.yaml_parser import YamlParser

file_path = 'examples/bad_sample.yaml'
parser = YamlParser()
result = parser.parse_file(file_path)

print(f"Bad lines: {len(result.bad_lines)}")
for bl in result.bad_lines:
    print(f"  Line {bl.line_number}: {bl.content}")
    print(f"  Error: {bl.error}")

print(f"\nErrors: {len(result.errors)}")
for e in result.errors:
    print(f"  {e}")
