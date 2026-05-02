"""
Notebook Cleaner Module

Cleans large outputs from notebooks and exports cleaned versions.
"""

import json
import copy
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class CleaningResult:
    """Result of a notebook cleaning operation."""
    original_path: str
    cleaned_path: Optional[str]
    cells_cleaned: int = 0
    output_size_removed: int = 0
    error: Optional[str] = None


class NotebookCleaner:
    """Cleans notebooks by removing large outputs and optional metadata."""

    def __init__(
        self,
        large_output_threshold: int = 1024 * 100,
        preserve_warnings: bool = False
    ):
        """
        Initialize the notebook cleaner.

        Args:
            large_output_threshold: Size in bytes above which outputs are removed
            preserve_warnings: If True, preserve warning outputs
        """
        self.large_output_threshold = large_output_threshold
        self.preserve_warnings = preserve_warnings

    def clean_notebook(
        self,
        notebook_path: Path,
        output_dir: Optional[Path] = None
    ) -> CleaningResult:
        """
        Clean a single notebook by removing large outputs.

        Args:
            notebook_path: Path to the notebook to clean
            output_dir: Optional directory to save cleaned notebook

        Returns:
            CleaningResult with statistics
        """
        result = CleaningResult(original_path=str(notebook_path), cleaned_path=None)

        try:
            with open(notebook_path, 'r', encoding='utf-8') as f:
                nb_data = json.load(f)

            original_size = len(json.dumps(nb_data))
            cells_cleaned = 0
            output_removed = 0

            for cell in nb_data.get('cells', []):
                if cell.get('cell_type') != 'code':
                    continue

                outputs = cell.get('outputs', [])
                new_outputs = []

                for output in outputs:
                    cleaned_output, size = self._clean_output(output)
                    if cleaned_output is not None:
                        new_outputs.append(cleaned_output)
                    else:
                        output_removed += size
                        cells_cleaned += 1

                cell['outputs'] = new_outputs

            nb_data['metadata'] = self._clean_metadata(nb_data.get('metadata', {}))

            cleaned_nb = self._create_cleaned_notebook(nb_data)

            if output_dir:
                output_dir.mkdir(parents=True, exist_ok=True)
                cleaned_path = output_dir / f"{notebook_path.stem}_cleaned.ipynb"
            else:
                cleaned_path = notebook_path.parent / f"{notebook_path.stem}_cleaned.ipynb"

            with open(cleaned_path, 'w', encoding='utf-8') as f:
                json.dump(cleaned_nb, f, indent=1, ensure_ascii=False)

            result.cleaned_path = str(cleaned_path)
            result.cells_cleaned = cells_cleaned
            result.output_size_removed = output_removed

        except Exception as e:
            result.error = str(e)

        return result

    def _clean_output(self, output: Dict[str, Any]) -> tuple:
        """Clean a single output, returning (cleaned_output or None, size_removed)."""
        output_type = output.get('output_type', '')

        if output_type == 'stream':
            text = ''.join(output.get('text', []))
            text_size = len(text)

            if text_size > self.large_output_threshold:
                return None, text_size

            if self.preserve_warnings and 'stderr' in output.get('name', ''):
                return output, 0

            return output, 0

        if output_type in ('execute_result', 'display_data'):
            data = output.get('data', {})
            total_size = sum(len(str(v)) for v in data.values())

            if total_size > self.large_output_threshold:
                return None, total_size

            return output, 0

        if output_type == 'error':
            if not self.preserve_warnings:
                return None, len(json.dumps(output))
            return output, 0

        return output, 0

    def _clean_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Clean notebook metadata, removing execution info."""
        cleaned = copy.deepcopy(metadata)

        cleaned.pop('kernelspec', None)

        if 'language_info' in cleaned:
            li = cleaned['language_info']
            fields_to_keep = ['name', 'version']
            cleaned['language_info'] = {
                k: v for k, v in li.items() if k in fields_to_keep
            }

        cleaned.pop('execution', None)

        return cleaned

    def _create_cleaned_notebook(self, nb_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a fully cleaned notebook structure."""
        cleaned = copy.deepcopy(nb_data)

        for key in ['execution', 'metadata']:
            if key in cleaned:
                cleaned[key] = self._clean_metadata(cleaned[key])

        return cleaned

    def clean_all(
        self,
        notebook_paths: List[Path],
        output_dir: Path
    ) -> List[CleaningResult]:
        """Clean multiple notebooks."""
        return [self.clean_notebook(nb, output_dir) for nb in notebook_paths]

    def strip_all_outputs(self, notebook_path: Path) -> Dict[str, Any]:
        """Strip ALL outputs from a notebook, returning the cleaned data."""
        with open(notebook_path, 'r', encoding='utf-8') as f:
            nb_data = json.load(f)

        for cell in nb_data.get('cells', []):
            if cell.get('cell_type') == 'code':
                cell['outputs'] = []
                cell['execution_count'] = None

        return nb_data

    def get_output_sizes(self, notebook_path: Path) -> Dict[int, int]:
        """Get sizes of all cell outputs in a notebook."""
        with open(notebook_path, 'r', encoding='utf-8') as f:
            nb_data = json.load(f)

        sizes = {}
        for idx, cell in enumerate(nb_data.get('cells', [])):
            if cell.get('cell_type') == 'code':
                total = 0
                for output in cell.get('outputs', []):
                    total += len(json.dumps(output))
                sizes[idx] = total

        return sizes
