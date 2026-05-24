from enum import IntEnum


class ExitCode(IntEnum):
    SUCCESS = 0
    CONFIG_ERROR = 1
    INPUT_ERROR = 2
    FILE_NOT_FOUND = 3
    VALIDATION_ERROR = 4
    UNCOVERED_FILES = 5
    RUNTIME_ERROR = 10


DEFAULT_CODEOWNERS_PATHS = [
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "docs/CODEOWNERS",
]

DEFAULT_OUTPUT_FORMATS = ["terminal", "json", "markdown"]

DEFAULT_TEAM_ALIASES_FILENAME = "team_aliases.yaml"
DEFAULT_EXCLUDE_PATTERNS = [
    ".git",
    ".github",
    "node_modules",
    "__pycache__",
    "*.pyc",
    ".DS_Store",
]
