"""
Notebook Parser Module

Parses .ipynb files, detects execution order issues,
and identifies relative path escapes.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class CellInfo:
    """Information about a notebook cell."""
    cell_index: int
    cell_id: str
    cell_type: str
    execution_count: Optional[int]
    source: str
    outputs: List[Any] = field(default_factory=list)
    has_large_output: bool = False
    large_output_size: int = 0
    source_file_refs: List[str] = field(default_factory=list)
    contains_path_escape: bool = False
    path_escape_pattern: Optional[str] = None


@dataclass
class NotebookAnalysis:
    """Analysis result for a single notebook."""
    notebook_path: str
    cells: List[CellInfo] = field(default_factory=list)
    execution_order_issues: List[Dict[str, Any]] = field(default_factory=list)
    path_escape_issues: List[Dict[str, Any]] = field(default_factory=list)
    total_cells: int = 0
    executed_cells: int = 0
    large_output_cells: int = 0
    total_output_size: int = 0
    random_seed_cells: List[Dict[str, Any]] = field(default_factory=list)
    data_file_refs: List[str] = field(default_factory=list)
    library_imports: List[str] = field(default_factory=list)


class NotebookParser:
    """Parser for Jupyter notebook files."""

    LARGE_OUTPUT_THRESHOLD = 1024 * 100

    PATH_ESCAPE_PATTERNS = [
        r"\.\./",
        r"\.\.\\",
        r"/absolutepath",
        r"[A-Z]:\\",
    ]

    RANDOM_SEED_PATTERNS = [
        r"random\.seed\(",
        r"np\.random\.seed\(",
        r"torch\.manual_seed\(",
        r"tf\.random\.set_seed\(",
        r"set_random_seed\(",
        r"random\.set_seed\(",
    ]

    DATA_FILE_PATTERNS = [
        r"open\(['\"]([^'\"]+)['\"]",
        r"pd\.read_(csv|excel|json|parquet)\(['\"]([^'\"]+)['\"]",
        r"np\.load\(['\"]([^'\"]+)['\"]",
        r"with open\(['\"]([^'\"]+)['\"]",
        r"Path\(['\"]([^'\"]+)['\"]",
        r"\.to_csv\(['\"]([^'\"]+)['\"]",
        r"loadmat\(['\"]([^'\"]+)['\"]",
        r"scipy\.io\.loadmat\(",
    ]

    def __init__(self, notebooks_dir: str, datasets_manifest: Optional[Dict] = None):
        """
        Initialize the notebook parser.

        Args:
            notebooks_dir: Path to the directory containing notebooks
            datasets_manifest: Optional dict with dataset manifest info
        """
        self.notebooks_dir = Path(notebooks_dir)
        self.datasets_manifest = datasets_manifest or {}
        self.notebooks: List[Path] = []

    def discover_notebooks(self) -> List[Path]:
        """Discover all .ipynb files in the notebooks directory."""
        self.notebooks = list(self.notebooks_dir.rglob("*.ipynb"))
        return self.notebooks

    def parse_notebook(self, notebook_path: Path) -> NotebookAnalysis:
        """
        Parse a single notebook file.

        Args:
            notebook_path: Path to the .ipynb file

        Returns:
            NotebookAnalysis object with parsed information
        """
        with open(notebook_path, 'r', encoding='utf-8') as f:
            nb_data = json.load(f)

        analysis = NotebookAnalysis(notebook_path=str(notebook_path))

        cells = nb_data.get('cells', [])
        analysis.total_cells = len(cells)

        prev_exec_count = 0
        prev_cell_index = -1

        for idx, cell in enumerate(cells):
            cell_info = self._parse_cell(cell, idx, notebook_path.parent)
            analysis.cells.append(cell_info)

            if cell_info.cell_type == 'code':
                if cell_info.execution_count is not None:
                    analysis.executed_cells += 1

                    if cell_info.execution_count != prev_exec_count + 1:
                        if prev_cell_index >= 0 and cell_info.execution_count <= prev_exec_count:
                            analysis.execution_order_issues.append({
                                'cell_index': idx,
                                'cell_id': cell_info.cell_id,
                                'expected_order': prev_exec_count + 1,
                                'actual_order': cell_info.execution_count,
                                'severity': 'error',
                                'message': f"Execution count {cell_info.execution_count} is out of order (previous was {prev_exec_count})"
                            })
                        elif cell_info.execution_count > prev_exec_count + 1:
                            analysis.execution_order_issues.append({
                                'cell_index': idx,
                                'cell_id': cell_info.cell_id,
                                'skipped': cell_info.execution_count - prev_exec_count - 1,
                                'severity': 'warning',
                                'message': f"Execution count jumped from {prev_exec_count} to {cell_info.execution_count}"
                            })

                    prev_exec_count = cell_info.execution_count
                    prev_cell_index = idx

                if cell_info.has_large_output:
                    analysis.large_output_cells += 1
                    analysis.total_output_size += cell_info.large_output_size

            if cell_info.contains_path_escape:
                analysis.path_escape_issues.append({
                    'cell_index': idx,
                    'cell_id': cell_info.cell_id,
                    'pattern': cell_info.path_escape_pattern,
                    'source_preview': cell_info.source[:100]
                })

            if cell_info.source_file_refs:
                analysis.data_file_refs.extend(cell_info.source_file_refs)

            analysis.library_imports.extend(self._extract_imports(cell_info.source))

            for pattern in self.RANDOM_SEED_PATTERNS:
                import re
                if re.search(pattern, cell_info.source):
                    analysis.random_seed_cells.append({
                        'cell_index': idx,
                        'cell_id': cell_info.cell_id,
                        'pattern': pattern,
                        'source': cell_info.source[:200]
                    })
                    break

        analysis.library_imports = list(set(analysis.library_imports))
        analysis.data_file_refs = list(set(analysis.data_file_refs))

        return analysis

    def _parse_cell(self, cell: Dict, cell_index: int, notebook_dir: Path) -> CellInfo:
        """Parse a single cell and extract relevant information."""
        cell_id = cell.get('id', f'cell_{cell_index}')
        cell_type = cell.get('cell_type', 'unknown')
        execution_count = cell.get('execution_count')
        source = ''.join(cell.get('source', []))

        cell_info = CellInfo(
            cell_index=cell_index,
            cell_id=cell_id,
            cell_type=cell_type,
            execution_count=execution_count,
            source=source
        )

        if cell_type == 'code':
            outputs = cell.get('outputs', [])
            cell_info.outputs = outputs
            self._check_large_outputs(cell_info, outputs)
            self._check_path_escape(cell_info, source)
            self._extract_file_refs(cell_info, source)

        return cell_info

    def _check_large_outputs(self, cell_info: CellInfo, outputs: List[Any]) -> None:
        """Check for large outputs in the cell."""
        for output in outputs:
            if output.get('output_type') == 'stream':
                text = ''.join(output.get('text', []))
                if len(text) > self.LARGE_OUTPUT_THRESHOLD:
                    cell_info.has_large_output = True
                    cell_info.large_output_size = len(text)
            elif output.get('output_type') in ('execute_result', 'display_data'):
                data = output.get('data', {})
                for mime_type, content in data.items():
                    if isinstance(content, str) and len(content) > self.LARGE_OUTPUT_THRESHOLD:
                        cell_info.has_large_output = True
                        cell_info.large_output_size = len(content)
                        break

    def _check_path_escape(self, cell_info: CellInfo, source: str) -> None:
        """Check for relative path escape patterns in source code."""
        import re
        for pattern in self.PATH_ESCAPE_PATTERNS:
            if re.search(pattern, source):
                cell_info.contains_path_escape = True
                cell_info.path_escape_pattern = pattern
                break

    def _extract_file_refs(self, cell_info: CellInfo, source: str) -> None:
        """Extract file references from source code."""
        import re
        for pattern in self.DATA_FILE_PATTERNS:
            matches = re.findall(pattern, source)
            for match in matches:
                if isinstance(match, tuple):
                    file_path = match[-1]
                else:
                    file_path = match
                if file_path and not file_path.startswith('/') and not file_path.startswith('http'):
                    cell_info.source_file_refs.append(file_path)

    def _extract_imports(self, source: str) -> List[str]:
        """Extract library imports from source code."""
        import re
        imports = []

        import_patterns = [
            r"^import (\w+)",
            r"^from (\w+) import",
            r"^from (\w+)\.",
        ]

        for line in source.split('\n'):
            line = line.strip()
            for pattern in import_patterns:
                match = re.match(pattern, line)
                if match:
                    imports.append(match.group(1))
                    break

        return imports

    def parse_all(self) -> List[NotebookAnalysis]:
        """Parse all discovered notebooks."""
        if not self.notebooks:
            self.discover_notebooks()

        return [self.parse_notebook(nb) for nb in self.notebooks]

    def get_execution_graph(self, analysis: NotebookAnalysis) -> Dict[int, List[int]]:
        """
        Build execution dependency graph.
        Returns a dict mapping cell_index to list of cell_indices it depends on.
        """
        graph = {}

        for i, cell in enumerate(analysis.cells):
            if cell.cell_type != 'code' or cell.execution_count is None:
                continue

            deps = []
            for j in range(i):
                prev_cell = analysis.cells[j]
                if prev_cell.cell_type == 'code' and prev_cell.execution_count is not None:
                    deps.append(j)
            graph[i] = deps

        return graph
