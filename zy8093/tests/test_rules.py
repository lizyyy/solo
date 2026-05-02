import pytest
from dataclasses import dataclass
from typing import Dict, List

from parsers.manifest import ImageEntry
from parsers.labels import Annotation, BoundingBox
from rules.category_mapping import check_category_consistency
from rules.bbox_validation import validate_bounding_boxes
from rules.class_balance import check_class_imbalance, analyze_class_balance


class TestCategoryMapping:
    def test_missing_in_manifest(self):
        manifest = {
            'img_001': ImageEntry('img_001', 'images/img_001.jpg', 640, 480)
        }
        annotations = {
            'img_001': [Annotation('ann_001', 'img_001', 'scratch')],
            'img_002': [Annotation('ann_002', 'img_002', 'dent')]
        }
        split_data = {'train': ['img_001'], 'val': [], 'test': []}
        
        issues = check_category_consistency(manifest, annotations, split_data)
        
        assert len([i for i in issues if i['issue_type'] == 'MISSING_IN_MANIFEST']) == 1

    def test_missing_annotations(self):
        manifest = {
            'img_001': ImageEntry('img_001', 'images/img_001.jpg', 640, 480),
            'img_002': ImageEntry('img_002', 'images/img_002.jpg', 640, 480)
        }
        annotations = {
            'img_001': [Annotation('ann_001', 'img_001', 'scratch')]
        }
        split_data = {'train': ['img_001', 'img_002'], 'val': [], 'test': []}
        
        issues = check_category_consistency(manifest, annotations, split_data)
        
        assert len([i for i in issues if i['issue_type'] == 'MISSING_ANNOTATIONS']) == 1


class TestBboxValidation:
    def test_bbox_out_of_bounds(self):
        manifest = {
            'img_001': ImageEntry('img_001', 'images/img_001.jpg', 640, 480)
        }
        annotations = {
            'img_001': [
                Annotation(
                    'ann_001',
                    'img_001',
                    'scratch',
                    BoundingBox(600, 400, 700, 500)
                )
            ]
        }
        
        issues = validate_bounding_boxes(manifest, annotations)
        
        assert len([i for i in issues if i['issue_type'] == 'BBOX_OUT_OF_BOUNDS']) == 1

    def test_empty_annotation(self):
        manifest = {
            'img_001': ImageEntry('img_001', 'images/img_001.jpg', 640, 480)
        }
        annotations = {
            'img_001': [Annotation('ann_001', 'img_001', 'scratch', is_empty=True)]
        }
        
        issues = validate_bounding_boxes(manifest, annotations)
        
        assert len([i for i in issues if i['issue_type'] == 'EMPTY_ANNOTATION']) == 1


class TestClassBalance:
    def test_class_imbalance(self):
        annotations = {
            'img_001': [Annotation('ann_001', 'img_001', 'scratch')],
            'img_002': [Annotation('ann_002', 'img_002', 'scratch')],
            'img_003': [Annotation('ann_003', 'img_003', 'scratch')],
            'img_004': [Annotation('ann_004', 'img_004', 'scratch')],
            'img_005': [Annotation('ann_005', 'img_005', 'scratch')],
            'img_006': [Annotation('ann_006', 'img_006', 'dent')]
        }
        split_data = {
            'train': ['img_001', 'img_002', 'img_003', 'img_004', 'img_005', 'img_006'],
            'val': [],
            'test': []
        }
        
        issues, stats = check_class_imbalance(annotations, split_data, imbalance_threshold=4.0)
        
        assert stats['balance_metrics']['imbalance_ratio'] == 5.0
        assert len([i for i in issues if i['issue_type'] == 'SEVERE_CLASS_IMBALANCE']) == 1

    def test_low_sample_count(self):
        annotations = {
            'img_001': [Annotation('ann_001', 'img_001', 'rare_class')]
        }
        split_data = {'train': ['img_001'], 'val': [], 'test': []}
        
        issues, stats = check_class_imbalance(annotations, split_data, min_samples_threshold=5)
        
        assert len([i for i in issues if i['issue_type'] == 'LOW_SAMPLE_COUNT']) == 1