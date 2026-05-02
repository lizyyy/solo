"""Minimal tests for TinyML diagnostic CLI."""
import json
import csv
import tempfile
import os
from pathlib import Path
import sys

script_dir = Path(__file__).parent.parent
sys.path.insert(0, str(script_dir))

from parser import parse_predictions, parse_labels, parse_thresholds, ParseError
from alignment import align_data, get_top1, normalize_predictions
from metrics import compute_metrics


def test_parse_predictions():
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        f.write('{"sample_id": "a", "predictions": {"cat": 0.9, "dog": 0.1}}\n')
        f.write('{"sample_id": "b", "predictions": {"cat": 0.3, "dog": 0.7}}\n')
        temp_path = f.name

    try:
        result = parse_predictions(temp_path)
        assert len(result) == 2
        assert result['a'] == {'cat': 0.9, 'dog': 0.1}
        assert result['b'] == {'cat': 0.3, 'dog': 0.7}
    finally:
        os.unlink(temp_path)


def test_parse_predictions_missing_sample_id():
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        f.write('{"predictions": {"cat": 0.9}}\n')
        temp_path = f.name

    try:
        parse_predictions(temp_path)
        assert False, "Should raise ParseError"
    except ParseError as e:
        assert "Missing sample_id" in str(e)
    finally:
        os.unlink(temp_path)


def test_parse_labels():
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write('sample_id,label\n')
        f.write('a,cat\n')
        f.write('b,dog\n')
        temp_path = f.name

    try:
        result = parse_labels(temp_path)
        assert result == {'a': 'cat', 'b': 'dog'}
    finally:
        os.unlink(temp_path)


def test_parse_labels_alternate_column():
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write('sample_id,class\n')
        f.write('a,cat\n')
        f.write('b,dog\n')
        temp_path = f.name

    try:
        result = parse_labels(temp_path)
        assert result == {'a': 'cat', 'b': 'dog'}
    finally:
        os.unlink(temp_path)


def test_parse_thresholds():
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write('cat: 1.0\ndog: 1.5\n')
        temp_path = f.name

    try:
        result = parse_thresholds(temp_path)
        assert result == {'cat': 1.0, 'dog': 1.5}
    finally:
        os.unlink(temp_path)


def test_align_data():
    baseline = {'a': {'cat': 0.9, 'dog': 0.1}, 'b': {'cat': 0.3, 'dog': 0.7}}
    quantized = {'a': {'cat': 0.85, 'dog': 0.15}, 'b': {'cat': 0.4, 'dog': 0.6}}
    labels = {'a': 'cat', 'b': 'dog'}

    result = align_data(baseline, quantized, labels)
    assert len(result.aligned) == 2
    assert result.aligned[0]['sample_id'] == 'a'


def test_align_data_missing_samples():
    baseline = {'a': {'cat': 0.9}}
    quantized = {'b': {'dog': 0.9}}
    labels = {'a': 'cat', 'b': 'dog'}

    result = align_data(baseline, quantized, labels)
    assert len(result.aligned) == 0
    assert len(result.warnings) == 2


def test_align_data_class_mismatch():
    baseline = {'a': {'cat': 0.9, 'dog': 0.1}}
    quantized = {'a': {'cat': 0.85, 'bird': 0.15}}
    labels = {'a': 'cat'}

    result = align_data(baseline, quantized, labels)
    assert len(result.aligned) == 1
    assert result.aligned[0]['baseline']['bird'] == 0.0
    assert result.aligned[0]['quantized']['dog'] == 0.0


def test_get_top1():
    preds = {'cat': 0.9, 'dog': 0.1}
    cls, conf = get_top1(preds)
    assert cls == 'cat'
    assert conf == 0.9


def test_get_top1_empty():
    cls, conf = get_top1({})
    assert cls is None
    assert conf == 0.0


def test_normalize_predictions():
    preds = {'cat': 0.6, 'dog': 0.4}
    normalized = normalize_predictions(preds)
    total = sum(normalized.values())
    assert abs(total - 1.0) < 0.0001


def test_normalize_predictions_zero():
    preds = {'cat': 0.0, 'dog': 0.0}
    normalized = normalize_predictions(preds)
    assert normalized == {'cat': 0.0, 'dog': 0.0}


def test_compute_metrics():
    from alignment import AlignmentResult

    aligned = [
        {'sample_id': 'a', 'baseline': {'cat': 0.9, 'dog': 0.1}, 'quantized': {'cat': 0.85, 'dog': 0.15}, 'label': 'cat'},
        {'sample_id': 'b', 'baseline': {'cat': 0.3, 'dog': 0.7}, 'quantized': {'cat': 0.4, 'dog': 0.6}, 'label': 'dog'},
    ]
    result = AlignmentResult(aligned=aligned, warnings=[])
    thresholds = {'cat': 1.0, 'dog': 1.0}

    metrics = compute_metrics(result, thresholds)
    assert metrics.summary['total_samples'] == 2
    assert metrics.summary['top1_accuracy'] == 1.0


def test_compute_metrics_empty():
    from alignment import AlignmentResult

    result = AlignmentResult(aligned=[], warnings=[])
    thresholds = {}
    metrics = compute_metrics(result, thresholds)
    assert metrics.summary['total_samples'] == 0


def run_all_tests():
    tests = [
        test_parse_predictions,
        test_parse_predictions_missing_sample_id,
        test_parse_labels,
        test_parse_labels_alternate_column,
        test_parse_thresholds,
        test_align_data,
        test_align_data_missing_samples,
        test_align_data_class_mismatch,
        test_get_top1,
        test_get_top1_empty,
        test_normalize_predictions,
        test_normalize_predictions_zero,
        test_compute_metrics,
        test_compute_metrics_empty,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
            print(f"PASS: {test.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL: {test.__name__}: {e}")

    print(f"\n{passed}/{passed+failed} tests passed")
    return failed == 0


if __name__ == '__main__':
    import yaml
    success = run_all_tests()
    sys.exit(0 if success else 1)