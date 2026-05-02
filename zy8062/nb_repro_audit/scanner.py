"""
Dependency and Data Reference Scanner Module

Scans notebooks for data file references, external dependencies,
and validates them against the datasets manifest.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field


@dataclass
class DataReference:
    """Represents a reference to an external data file."""
    file_path: str
    reference_type: str
    line_number: Optional[int] = None
    context: str = ""
    exists: bool = False
    relative_to: Optional[str] = None


@dataclass
class DependencyInfo:
    """Information about a library dependency."""
    library_name: str
    import_line: str
    is_standard_lib: bool = False
    is_third_party: bool = False


@dataclass
class ScanResult:
    """Result of scanning a notebook for dependencies and data references."""
    notebook_path: str
    data_references: List[DataReference] = field(default_factory=list)
    missing_data_files: List[DataReference] = field(default_factory=list)
    external_dependencies: List[DependencyInfo] = field(default_factory=list)
    unresolved_imports: List[str] = field(default_factory=list)

    @property
    def missing_assets_count(self) -> int:
        return len(self.missing_data_files)


STANDARD_LIBRARIES = {
    'os', 'sys', 'time', 'datetime', 'json', 're', 'math', 'random',
    'collections', 'itertools', 'functools', 'operator', 'fileinput',
    'logging', 'warnings', 'abc', 'copy', 'pprint', 'struct', 'csv',
    'io', 'buffer', 'array', 'types', 'unittest', 'doctest', 'pdb',
    'gc', 'inspect', 'dis', 'pickle', 'shelve', 'dbm', 'sqlite3',
    'zlib', 'gzip', 'bz2', 'lzma', 'zipfile', 'tarfile', 'xml',
    'html', 'xml.etree', 'xml.dom', 'xml.sax', 'cgi', 'wsgiref',
    'urllib', 'http', 'ftplib', 'poplib', 'imaplib', 'smtplib',
    'telnetlib', 'socket', 'ssl', 'select', 'asyncio', 'multiprocessing',
    'subprocess', 'threading', 'concurrent', 'queue', 'contextvars',
    'pathlib', 'typing', 'weakref', 'dataclasses', 'enum', 'graphlib',
}


class DependencyScanner:
    """Scans notebooks for data file references and library dependencies."""

    FILE_READ_PATTERNS = [
        (r"open\s*\(\s*['\"]([^'\"]+)['\"]", "file_open"),
        (r"with\s+open\s*\(\s*['\"]([^'\"]+)['\"]", "file_open"),
        (r"Path\s*\(\s*['\"]([^'\"]+)['\"]", "pathlib_path"),
        (r"pd\.read_csv\s*\(\s*['\"]([^'\"]+)['\"]", "pandas_csv"),
        (r"pd\.read_excel\s*\(\s*['\"]([^'\"]+)['\"]", "pandas_excel"),
        (r"pd\.read_json\s*\(\s*['\"]([^'\"]+)['\"]", "pandas_json"),
        (r"pd\.read_parquet\s*\(\s*['\"]([^'\"]+)['\"]", "pandas_parquet"),
        (r"pd\.read_sql\s*\(\s*['\"]([^'\"]+)['\"]", "pandas_sql"),
        (r"np\.load\s*\(\s*['\"]([^'\"]+)['\"]", "numpy_load"),
        (r"np\.loadtxt\s*\(\s*['\"]([^'\"]+)['\"]", "numpy_loadtxt"),
        (r"np\.genfromtxt\s*\(\s*['\"]([^'\"]+)['\"]", "numpy_genfromtxt"),
        (r"np\.savetxt\s*\(\s*['\"]([^'\"]+)['\"]", "numpy_save"),
        (r"np\.save\s*\(\s*['\"]([^'\"]+)['\"]", "numpy_save"),
        (r"np\.savez\s*\(\s*['\"]([^'\"]+)['\"]", "numpy_savez"),
        (r"torch\.load\s*\(\s*['\"]([^'\"]+)['\"]", "pytorch_load"),
        (r"torch\.load_state_dict\s*\(\s*['\"]([^'\"]+)['\"]", "pytorch_load"),
        (r"tf\.keras\.models\.load_model\s*\(\s*['\"]([^'\"]+)['\"]", "tensorflow_load"),
        (r"joblib\.load\s*\(\s*['\"]([^'\"]+)['\"]", "joblib_load"),
        (r"pickle\.load\s*\(\s*['\"]([^'\"]+)['\"]", "pickle_load"),
        (r"yaml\.load\s*\(\s*['\"]([^'\"]+)['\"]", "yaml_load"),
        (r"yaml\.safe_load\s*\(\s*['\"]([^'\"]+)['\"]", "yaml_load"),
        (r"with\s+open\s*\([^)]+,\s*['\"]([^'\"]+)['\"]", "file_open"),
        (r"Image\.open\s*\(\s*['\"]([^'\"]+)['\"]", "pillow_open"),
        (r"cv2\.imread\s*\(\s*['\"]([^'\"]+)['\"]", "opencv_open"),
        (r"scipy\.io\.loadmat\s*\(\s*['\"]([^'\"]+)['\"]", "scipy_loadmat"),
        (r"scipy\.io\.savemat\s*\(\s*['\"]([^'\"]+)['\"]", "scipy_savemat"),
        (r"scanpy\.read\s*\(\s*['\"]([^'\"]+)['\"]", "scanpy_read"),
        (r"anndata\.read_h5ad\s*\(\s*['\"]([^'\"]+)['\"]", "anndata_read"),
    ]

    IMPORTS_PATTERNS = [
        r"^import\s+(\w+)",
        r"^from\s+(\w+)\s+import",
        r"^from\s+(\w+)\.\w+\s+import",
        r"^from\s+(\w+)\.\w+\.\w+\s+import",
    ]

    def __init__(
        self,
        notebooks_dir: str,
        datasets_manifest: Optional[Dict[str, Any]] = None,
        env_dependencies: Optional[List[str]] = None
    ):
        """
        Initialize the dependency scanner.

        Args:
            notebooks_dir: Base directory for notebooks
            datasets_manifest: Dict with dataset manifest (path -> metadata)
            env_dependencies: List of known environment dependencies
        """
        self.notebooks_dir = Path(notebooks_dir)
        self.datasets_manifest = datasets_manifest or {}
        self.env_dependencies = set(env_dependencies or [])
        self._dependency_cache: Dict[str, List[str]] = {}

    def scan_notebook(self, notebook_path: Path) -> ScanResult:
        """
        Scan a single notebook for data references and dependencies.

        Args:
            notebook_path: Path to the notebook file

        Returns:
            ScanResult object with all found references
        """
        import json

        with open(notebook_path, 'r', encoding='utf-8') as f:
            nb_data = json.load(f)

        result = ScanResult(notebook_path=str(notebook_path))
        notebook_dir = notebook_path.parent

        for cell in nb_data.get('cells', []):
            if cell.get('cell_type') != 'code':
                continue

            source = ''.join(cell.get('source', []))

            refs = self._extract_data_references(source, notebook_dir)
            result.data_references.extend(refs)

            imports = self._extract_imports(source)
            for imp in imports:
                dep_info = DependencyInfo(
                    library_name=imp,
                    import_line=self._get_import_line(source, imp)
                )
                self._classify_dependency(dep_info)
                result.external_dependencies.append(dep_info)

        result.missing_data_files = [
            ref for ref in result.data_references
            if not ref.exists and not self._is_placeholder(ref.file_path)
        ]

        result.unresolved_imports = [
            dep.library_name for dep in result.external_dependencies
            if not dep.is_standard_lib and not dep.is_third_party
        ]

        return result

    def _extract_data_references(
        self,
        source: str,
        notebook_dir: Path
    ) -> List[DataReference]:
        """Extract data file references from source code."""
        references = []

        for pattern, ref_type in self.FILE_READ_PATTERNS:
            for match in re.finditer(pattern, source, re.MULTILINE):
                file_path = match.group(1)
                line_num = source[:match.start()].count('\n') + 1

                if self._should_skip_reference(file_path):
                    continue

                ref = DataReference(
                    file_path=file_path,
                    reference_type=ref_type,
                    line_number=line_num,
                    context=self._get_line_context(source, line_num),
                    relative_to=str(notebook_dir)
                )

                ref.exists = self._check_file_exists(file_path, notebook_dir)
                references.append(ref)

        return references

    def _should_skip_reference(self, file_path: str) -> bool:
        """Check if a file reference should be skipped."""
        if not file_path:
            return True
        if file_path.startswith('/'):
            return True
        if file_path.startswith('http://') or file_path.startswith('https://'):
            return True
        if file_path.startswith('s3://'):
            return True
        if file_path.startswith('gs://'):
            return True
        if '{{' in file_path or '}}' in file_path:
            return True
        return False

    def _check_file_exists(self, file_path: str, base_dir: Path) -> bool:
        """Check if a referenced file exists."""
        possible_paths = [
            base_dir / file_path,
            self.notebooks_dir / file_path,
            self.notebooks_dir.parent / file_path,
            Path(file_path),
        ]

        if self.datasets_manifest:
            for dataset_key, dataset_info in self.datasets_manifest.items():
                if isinstance(dataset_info, dict):
                    dataset_path = dataset_info.get('path', dataset_key)
                    possible_paths.append(Path(dataset_path))

        for path in possible_paths:
            if path.exists() and path.is_file():
                return True

        return False

    def _is_placeholder(self, file_path: str) -> bool:
        """Check if the path is a placeholder variable."""
        return any(
            char.isalpha() and char.isupper()
            for char in file_path.split('/')[-1].split('.')[0]
        ) and len(file_path.split('/')[-1].split('.')[0]) > 3

    def _extract_imports(self, source: str) -> List[str]:
        """Extract library imports from source code."""
        imports = []
        lines = source.split('\n')

        for line in lines:
            line = line.strip()
            for pattern in self.IMPORTS_PATTERNS:
                match = re.match(pattern, line)
                if match:
                    imports.append(match.group(1))
                    break

        return list(set(imports))

    def _classify_dependency(self, dep_info: DependencyInfo) -> None:
        """Classify a dependency as standard lib, third-party, or unknown."""
        lib_name = dep_info.library_name.lower()

        if lib_name in STANDARD_LIBRARIES:
            dep_info.is_standard_lib = True
        elif lib_name in self.env_dependencies:
            dep_info.is_third_party = True
        else:
            common_third_party = {
                'numpy', 'pandas', 'scipy', 'matplotlib', 'sklearn', 'scikit-learn',
                'tensorflow', 'tf', 'torch', 'keras', 'cv2', 'opencv', 'pillow',
                'PIL', 'joblib', 'yaml', 'pyyaml', 'seaborn', 'plotly', 'bokeh',
                'statsmodels', 'xgboost', 'lightgbm', 'catboost', 'nltk', 'spacy',
                'gensim', 'beautifulsoup4', 'bs4', 'requests', 'urllib3', 'aiohttp',
                'sqlalchemy', 'psycopg2', 'pymysql', 'redis', 'mongodb', 'pymongo',
                'elasticsearch', 'solr', 'faiss', 'annoy', 'hnswlib', 'scrapy',
                'flask', 'django', 'fastapi', 'starlette', 'streamlit', 'dash',
                'jupyter', 'ipython', 'notebook', 'ipywidgets', 'traitlets',
                'pytest', 'unittest', 'coverage', 'black', 'flake8', 'pylint',
                'mypy', 'pyright', 'ruff', 'isort', 'pre-commit', 'tox',
                'pip', 'conda', 'poetry', 'pipenv', 'setuptools', 'wheel',
                'setup', 'install', 'build', 'twine', 'check', 'audit',
            }
            if lib_name in common_third_party:
                dep_info.is_third_party = True

    def _get_import_line(self, source: str, library: str) -> str:
        """Get the full import line for a library."""
        for line in source.split('\n'):
            if f'import {library}' in line or f'from {library}' in line:
                return line.strip()
        return f"import {library}"

    def _get_line_context(self, source: str, line_num: int, context_lines: int = 2) -> str:
        """Get surrounding context for a line number."""
        lines = source.split('\n')
        start = max(0, line_num - context_lines - 1)
        end = min(len(lines), line_num + context_lines)
        return '\n'.join(lines[start:end])

    def scan_all(self, notebook_paths: List[Path]) -> List[ScanResult]:
        """Scan multiple notebooks."""
        return [self.scan_notebook(nb) for nb in notebook_paths]

    def generate_missing_assets_csv(self, scan_results: List[ScanResult]) -> str:
        """Generate CSV content for missing assets."""
        lines = ["notebook,file_path,reference_type,line_number,context"]

        for result in scan_results:
            for missing in result.missing_data_files:
                context = missing.context.replace('\n', ' ').replace('"', "'")
                context = context[:100] + "..." if len(context) > 100 else context
                lines.append(
                    f'"{result.notebook_path}","{missing.file_path}",'
                    f'"{missing.reference_type}",{missing.line_number},"{context}"'
                )

        return '\n'.join(lines)
