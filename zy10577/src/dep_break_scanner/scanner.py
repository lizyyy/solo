import ast
import re
from pathlib import Path
from typing import List, Tuple, Optional
import pathspec

from .models import CodeReference, ReferenceType, TestFile, ErrorSample


class DependencyScanner:
    def __init__(self, dependency_name: str, source_dir: Path):
        self.dependency_name = dependency_name
        self.source_dir = Path(source_dir)
        self.references: List[CodeReference] = []
        self.test_files: List[TestFile] = []
        self.error_samples: List[ErrorSample] = []
        self.total_files_scanned = 0
        self._gitignore_spec = self._load_gitignore()

    def _load_gitignore(self):
        gitignore_path = self.source_dir / ".gitignore"
        if gitignore_path.exists():
            with open(gitignore_path, "r") as f:
                return pathspec.PathSpec.from_lines("gitwildmatch", f)
        return None

    def _should_skip_file(self, file_path: Path) -> bool:
        rel_path = file_path.relative_to(self.source_dir)
        if self._gitignore_spec and self._gitignore_spec.match_file(str(rel_path)):
            return True
        if file_path.name.startswith("."):
            return True
        if "__pycache__" in file_path.parts:
            return True
        if "node_modules" in file_path.parts:
            return True
        if ".git" in file_path.parts:
            return True
        return False

    def _get_context_lines(self, lines: List[str], line_num: int, context: int = 2) -> List[str]:
        start = max(0, line_num - context - 1)
        end = min(len(lines), line_num + context)
        return lines[start:end]

    def scan_file(self, file_path: Path) -> List[CodeReference]:
        references = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                lines = content.splitlines()
        except (UnicodeDecodeError, IOError) as e:
            self.error_samples.append(
                ErrorSample(
                    file_path=str(file_path),
                    line_number=0,
                    error_type="file_read_error",
                    error_message=str(e),
                    raw_content="",
                    context=f"Failed to read file: {type(e).__name__}",
                )
            )
            return references

        self.total_files_scanned += 1

        try:
            tree = ast.parse(content)
        except SyntaxError as e:
            self.error_samples.append(
                ErrorSample(
                    file_path=str(file_path),
                    line_number=e.lineno or 0,
                    error_type="syntax_error",
                    error_message=str(e),
                    raw_content=lines[e.lineno - 1] if e.lineno and e.lineno <= len(lines) else "",
                    context=f"Line {e.lineno}, Column {e.offset}",
                )
            )
            return references

        file_refs = self._scan_ast(tree, file_path, lines)
        references.extend(file_refs)

        return references

    def _scan_ast(self, tree: ast.AST, file_path: Path, lines: List[str]) -> List[CodeReference]:
        references = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name == self.dependency_name or alias.name.startswith(
                        f"{self.dependency_name}."
                    ):
                        references.append(
                            self._create_reference(
                                file_path,
                                node.lineno,
                                node.col_offset,
                                ReferenceType.IMPORT,
                                alias.name,
                                lines,
                            )
                        )

            elif isinstance(node, ast.ImportFrom):
                if node.module and (
                    node.module == self.dependency_name
                    or node.module.startswith(f"{self.dependency_name}.")
                ):
                    for alias in node.names:
                        full_symbol = f"{node.module}.{alias.name}"
                        references.append(
                            self._create_reference(
                                file_path,
                                node.lineno,
                                node.col_offset,
                                ReferenceType.IMPORT,
                                full_symbol,
                                lines,
                            )
                        )

            elif isinstance(node, ast.Attribute):
                full_name = self._get_full_attribute_name(node)
                if full_name and full_name.startswith(f"{self.dependency_name}."):
                    references.append(
                        self._create_reference(
                            file_path,
                            node.lineno,
                            node.col_offset,
                            ReferenceType.DIRECT_CALL,
                            full_name,
                            lines,
                        )
                    )

            elif isinstance(node, ast.Name):
                if node.id == self.dependency_name:
                    references.append(
                        self._create_reference(
                            file_path,
                            node.lineno,
                            node.col_offset,
                            ReferenceType.DIRECT_CALL,
                            node.id,
                            lines,
                        )
                    )

        return references

    def _get_full_attribute_name(self, node: ast.Attribute) -> Optional[str]:
        parts = []
        current = node
        while isinstance(current, ast.Attribute):
            parts.append(current.attr)
            current = current.value
        if isinstance(current, ast.Name):
            parts.append(current.id)
            return ".".join(reversed(parts))
        return None

    def _create_reference(
        self,
        file_path: Path,
        lineno: int,
        col_offset: int,
        ref_type: ReferenceType,
        symbol: str,
        lines: List[str],
    ) -> CodeReference:
        snippet = lines[lineno - 1] if lineno <= len(lines) else ""
        context_lines = self._get_context_lines(lines, lineno)
        return CodeReference(
            file_path=str(file_path.relative_to(self.source_dir)),
            line_number=lineno,
            column=col_offset,
            reference_type=ref_type,
            symbol=symbol,
            code_snippet=snippet.strip(),
            context_lines=context_lines,
        )

    def _is_test_file(self, file_path: Path) -> bool:
        name = file_path.name
        return (
            name.startswith("test_")
            or name.endswith("_test.py")
            or "tests" in file_path.parts
            or "test" in file_path.parts
        )

    def _count_tests_in_file(self, file_path: Path) -> int:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            test_pattern = re.compile(r"^def test_|^class Test", re.MULTILINE)
            return len(test_pattern.findall(content))
        except:
            return 0

    def scan(self) -> Tuple[List[CodeReference], List[TestFile], List[ErrorSample], int]:
        py_files = list(self.source_dir.rglob("*.py"))

        for file_path in py_files:
            if self._should_skip_file(file_path):
                continue

            refs = self.scan_file(file_path)
            self.references.extend(refs)

            if self._is_test_file(file_path) and refs:
                test_count = self._count_tests_in_file(file_path)
                self.test_files.append(
                    TestFile(
                        file_path=str(file_path.relative_to(self.source_dir)),
                        test_count=test_count,
                        related_references=refs,
                    )
                )

        return self.references, self.test_files, self.error_samples, self.total_files_scanned
