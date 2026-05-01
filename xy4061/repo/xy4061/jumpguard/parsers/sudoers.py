import os
import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Set, Tuple


@dataclass
class SudoersRule:
    user: str
    host: str
    run_as: str
    commands: List[str]
    nopasswd: bool = False
    raw_line: str = ""
    source_file: str = ""
    line_number: int = 0
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user": self.user,
            "host": self.host,
            "run_as": self.run_as,
            "commands": self.commands,
            "nopasswd": self.nopasswd,
            "raw_line": self.raw_line,
            "source_file": self.source_file,
            "line_number": self.line_number,
            "is_valid": self.is_valid,
            "validation_errors": self.validation_errors,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SudoersRule":
        return cls(
            user=data.get("user", ""),
            host=data.get("host", ""),
            run_as=data.get("run_as", "root"),
            commands=data.get("commands", []),
            nopasswd=data.get("nopasswd", False),
            raw_line=data.get("raw_line", ""),
            source_file=data.get("source_file", ""),
            line_number=data.get("line_number", 0),
            is_valid=data.get("is_valid", True),
            validation_errors=data.get("validation_errors", []),
        )


class SudoersParser:
    SUDOERS_RULE_PATTERN = re.compile(
        r"^([A-Za-z_][A-Za-z0-9_-]*\s+"
        r"([A-Za-z0-9_.-]+\s*=\s*"
        r"\(([^)]+)\)\s*"
        r"(.+)$"
    )

    SIMPLE_RULE_PATTERN = re.compile(
        r"^([A-Za-z_][A-Za-z0-9_-]*|\%[A-Za-z_][A-Za-z0-9_-]*)\s+"
        r"([A-Za-z0-9_.-]+|ALL)\s*=\s*"
        r"(?:\(([^)]+)\))?\s*"
        r"(.+)$"
    )

    NOPASSWD_PATTERN = re.compile(r"NOPASSWD:\s*(.+)")

    DEFAULT_FORBIDDEN_COMMANDS = [
        "rm -rf /",
        "rm -rf /",
        "su",
        "sudo su",
        "su -",
        "su root",
        "visudo",
        "passwd",
        "chmod 777",
        "chown root",
    ]

    DEFAULT_FORBIDDEN_USERS = ["root", "ALL"]

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.forbidden_commands = self.config.get("forbidden_commands", self.DEFAULT_FORBIDDEN_COMMANDS)
        self.forbidden_users = self.config.get("forbidden_users", self.DEFAULT_FORBIDDEN_USERS)

    def parse_file(self, file_path: str) -> List[SudoersRule]:
        rules: List[SudoersRule] = []
        file_path = os.path.abspath(file_path)
        file_name = os.path.basename(file_path)

        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        current_line = ""
        for line_num, line in enumerate(lines, start=1):
            line = line.rstrip()

            if line.endswith("\\"):
                current_line += line[:-1]
                continue

            if current_line:
                full_line = current_line + line
                current_line = ""
            else:
                full_line = line

            if self._is_rule_line(full_line):
                rule = self._parse_rule(full_line, file_name, line_num)
                if rule:
                    rules.append(rule)

        return rules

    def _is_rule_line(self, line: str) -> bool:
        stripped = line.strip()
        if not stripped:
            return False
        if stripped.startswith("#"):
            return False
        if stripped.startswith("Defaults"):
            return False
        if stripped.startswith("User_Alias"):
            return False
        if stripped.startswith("Host_Alias"):
            return False
        if stripped.startswith("Cmnd_Alias"):
            return False
        if stripped.startswith("Runas_Alias"):
            return False
        if "=" not in stripped:
            return False
        return True

    def _parse_rule(self, line: str, source_file: str, line_number: int) -> Optional[SudoersRule]:
        stripped = line.strip()
        errors: List[str] = []

        match = self.SIMPLE_RULE_PATTERN.match(stripped)
        if not match:
            errors.append(f"Failed to parse sudoers rule format")
            return SudoersRule(
                user="",
                host="",
                run_as="",
                commands=[],
                raw_line=line,
                source_file=source_file,
                line_number=line_number,
                is_valid=False,
                validation_errors=errors,
            )

        user = match.group(1).strip()
        host = match.group(2).strip()
        run_as = (match.group(3) or "root").strip()
        cmd_part = match.group(4).strip()

        nopasswd = False
        nopasswd_match = self.NOPASSWD_PATTERN.match(cmd_part)
        if nopasswd_match:
            nopasswd = True
            cmd_part = nopasswd_match.group(1).strip()

        commands = self._split_commands(cmd_part)

        is_valid = len(errors) == 0 and bool(user)

        return SudoersRule(
            user=user,
            host=host,
            run_as=run_as,
            commands=commands,
            nopasswd=nopasswd,
            raw_line=line,
            source_file=source_file,
            line_number=line_number,
            is_valid=is_valid,
            validation_errors=errors,
        )

    def _split_commands(self, cmd_part: str) -> List[str]:
        commands: List[str] = []
        current = ""
        parens = 0
        in_quotes = False
        quote_char = ""

        for char in cmd_part:
            if char in ('"', "'"):
                if not in_quotes:
                    in_quotes = True
                    quote_char = char
                elif char == quote_char:
                    in_quotes = False
            elif char == "(" and not in_quotes:
                parens += 1
            elif char == ")" and not in_quotes:
                parens -= 1
            elif char == "," and parens == 0 and not in_quotes:
                commands.append(current.strip())
                current = ""
                continue
            current += char

        if current.strip():
            commands.append(current.strip())

        return commands

    def is_forbidden_command(self, command: str) -> bool:
        cmd_lower = command.lower().strip()
        for forbidden in self.forbidden_commands:
            if forbidden.lower() in cmd_lower:
                return True
        return False

    def is_forbidden_user(self, user: str) -> bool:
        user_lower = user.lower().strip()
        return user_lower in [u.lower() for u in self.forbidden_users]

    def has_all_command(self, commands: List[str]) -> bool:
        return any(cmd.strip().upper() == "ALL" for cmd in commands)

    def get_all_users(self, rules: List[SudoersRule]) -> Set[str]:
        users: Set[str] = set()
        for rule in rules:
            if rule.user:
                users.add(rule.user)
        return users

    def get_rules_for_user(self, rules: List[SudoersRule], username: str) -> List[SudoersRule]:
        result: List[SudoersRule] = []
        for rule in rules:
            if rule.user == username:
                result.append(rule)
            elif rule.user.startswith("%"):
                group = rule.user[1:]
                result.append(rule)
        return result

    def get_rules_for_host(self, rules: List[SudoersRule], hostname: str) -> List[SudoersRule]:
        result: List[SudoersRule] = []
        for rule in rules:
            if rule.host == hostname or rule.host.upper() == "ALL":
                result.append(rule)
        return result
