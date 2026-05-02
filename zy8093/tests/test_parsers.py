import pytest
import tempfile
import csv
import json
import yaml
from pathlib import Path

from parsers.manifest import parse_images_manifest
from parsers.labels import parse_labels_jsonl
from parsers.split import parse_split_yaml


class TestManifestParser:
    def test_parse_manifest(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("image_id,file_path,width,height\n")
            f.write("img_001,images/img_001.jpg,640,480\n")
            f.write("img_002,images/img_002.jpg,1280,720\n")
        
        manifest = parse_images_manifest(f.name)
        
        assert len(manifest) == 2
        assert 'img_001' in manifest
        assert manifest['img_001'].width == 640
        assert manifest['img_001'].height == 480
        assert manifest['img_002'].width == 1280
        
        Path(f.name).unlink()


class TestLabelsParser:
    def test_parse_labels(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            f.write('{"annotation_id": "ann_001", "image_id": "img_001", "category_id": "scratch", "bbox": [10, 20, 100, 80]}\n')
            f.write('{"annotation_id": "ann_002", "image_id": "img_001", "category_id": "dent", "bbox": [50, 50, 80, 80]}\n')
            f.write('{"annotation_id": "ann_003", "image_id": "img_002", "category_id": "crack", "bbox": []}\n')
        
        labels = parse_labels_jsonl(f.name)
        
        assert len(labels) == 2
        assert 'img_001' in labels
        assert len(labels['img_001']) == 2
        assert labels['img_002'][0].is_empty == True
        
        Path(f.name).unlink()


class TestSplitParser:
    def test_parse_split(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write("train:\n")
            f.write("  - img_001\n")
            f.write("  - img_002\n")
            f.write("val:\n")
            f.write("  - img_003\n")
        
        split = parse_split_yaml(f.name)
        
        assert len(split['train']) == 2
        assert len(split['val']) == 1
        assert split['test'] == []
        
        Path(f.name).unlink()