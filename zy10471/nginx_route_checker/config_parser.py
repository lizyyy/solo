import re
from pathlib import Path
from typing import List, Dict, Any


class NginxConfigParser:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []

    def parse(self, path: Path) -> List[Dict[str, Any]]:
        config_files = self._collect_config_files(path)
        servers = []

        for config_file in config_files:
            if self.verbose:
                print(f"  解析文件: {config_file}")
            try:
                file_servers = self._parse_file(config_file)
                servers.extend(file_servers)
            except Exception as e:
                self.errors.append({
                    "file": str(config_file),
                    "message": f"解析文件失败: {str(e)}",
                    "type": "parse_error"
                })
                if self.verbose:
                    print(f"    解析失败: {e}")

        return servers

    def _collect_config_files(self, path: Path) -> List[Path]:
        if path.is_file():
            return [path]

        config_files = []
        for pattern in ["**/*.conf", "**/nginx.conf"]:
            config_files.extend(path.glob(pattern))

        return sorted(set(config_files))

    def _parse_file(self, file_path: Path) -> List[Dict[str, Any]]:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        servers = []

        server_pattern = r'server\s*\{'
        for server_match in re.finditer(server_pattern, content):
            start_pos = server_match.start()
            
            brace_count = 1
            end_pos = start_pos + len("server {")
            while brace_count > 0 and end_pos < len(content):
                if content[end_pos] == '{':
                    brace_count += 1
                elif content[end_pos] == '}':
                    brace_count -= 1
                end_pos += 1
            
            server_content = content[start_pos:end_pos]
            
            server_info = self._extract_server_info(server_content, file_path)
            if server_info:
                server_info["start_line"] = content[:start_pos].count("\n") + 1
                servers.append(server_info)

        return servers

    def _extract_server_info(self, server_content: str, file_path: Path) -> Dict[str, Any]:
        server_info = {
            "file": str(file_path),
            "name": f"{file_path.name}",
            "listen": [],
            "server_name": [],
            "locations": []
        }

        listen_matches = re.findall(r'listen\s+([^;]+);', server_content)
        server_info["listen"] = [m.strip() for m in listen_matches]

        name_matches = re.findall(r'server_name\s+([^;]+);', server_content)
        if name_matches:
            server_info["server_name"] = name_matches[0].strip().split()
            server_info["name"] = server_info["server_name"][0]
        elif server_info["listen"]:
            server_info["name"] = f"port_{server_info['listen'][0]}"

        location_pattern = r'location\s+([^{]*)\{'
        for loc_match in re.finditer(location_pattern, server_content):
            loc_raw = loc_match.group(1).strip()
            loc_start = loc_match.start()
            
            brace_count = 1
            end_pos = loc_start + len(f"location {loc_raw} {{")
            while brace_count > 0 and end_pos < len(server_content):
                if server_content[end_pos] == '{':
                    brace_count += 1
                elif server_content[end_pos] == '}':
                    brace_count -= 1
                end_pos += 1
            
            location = {
                "file": str(file_path),
                "start_line": server_content[:loc_start].count("\n") + 1,
                "raw": loc_raw,
                "modifier": None,
                "pattern": None,
                "match_type": None,
                "priority": 0
            }
            
            self._parse_location_pattern(location, loc_raw)
            server_info["locations"].append(location)

        return server_info

    def _parse_location_pattern(self, location: Dict[str, Any], raw_pattern: str) -> None:
        parts = raw_pattern.split()

        if len(parts) == 1:
            location["modifier"] = None
            location["pattern"] = parts[0]
            if location["pattern"].startswith("~"):
                location["match_type"] = "regex"
                location["priority"] = 3
            else:
                location["match_type"] = "prefix"
                location["priority"] = 1
        else:
            modifier = parts[0]
            pattern = " ".join(parts[1:])
            location["modifier"] = modifier
            location["pattern"] = pattern

            if modifier == "=":
                location["match_type"] = "exact"
                location["priority"] = 4
            elif modifier == "~":
                location["match_type"] = "regex_case_sensitive"
                location["priority"] = 3
            elif modifier == "~*":
                location["match_type"] = "regex_case_insensitive"
                location["priority"] = 3
            elif modifier == "^~":
                location["match_type"] = "prefix_no_regex"
                location["priority"] = 2
            else:
                location["match_type"] = "prefix"
                location["priority"] = 1

        if self.verbose:
            print(f"    解析 location: {raw_pattern} -> {location['match_type']} (优先级 {location['priority']})")
