import pytest
import tempfile
from pathlib import Path

from reports.markdown_report import generate_markdown_report
from reports.csv_report import generate_issues_csv


class TestReports:
    def test_generate_markdown_report(self):
        issues = [
            {
                'issue_type': 'TEST_ERROR',
                'severity': 'error',
                'image_id': 'img_001',
                'annotation_id': None,
                'category_id': None,
                'message': 'Test error message'
            }
        ]
        balance_stats = {
            'category_distribution': {'scratch': 10, 'dent': 5},
            'split_distribution': {
                'train': {'scratch': 8, 'dent': 4},
                'val': {'scratch': 2, 'dent': 1},
                'test': {}
            },
            'balance_metrics': {
                'total_annotations': 15,
                'num_categories': 2,
                'balance_ratio': 0.92,
                'imbalance_ratio': 2.0,
                'max_count': 10,
                'min_count': 5
            }
        }
        manifest_stats = {'total_images': 15}
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            output_path = f.name
        
        generate_markdown_report(issues, balance_stats, manifest_stats, output_path)
        
        assert Path(output_path).exists()
        content = Path(output_path).read_text()
        assert 'Dataset Audit Report' in content
        assert 'TEST_ERROR' in content
        
        Path(output_path).unlink()

    def test_generate_csv_report(self):
        issues = [
            {
                'issue_type': 'TEST_ERROR',
                'severity': 'error',
                'image_id': 'img_001',
                'annotation_id': 'ann_001',
                'category_id': 'scratch',
                'message': 'Test error'
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            output_path = f.name
        
        generate_issues_csv(issues, output_path)
        
        assert Path(output_path).exists()
        content = Path(output_path).read_text()
        assert 'issue_type' in content
        assert 'TEST_ERROR' in content
        
        Path(output_path).unlink()