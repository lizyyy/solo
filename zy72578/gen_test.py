import sys
from models import (
    MaterialType, ThresholdNote, OnlineExperimentBucket,
    WorkflowStep, ReviewStatus
)
from material_importer import MaterialImporter
from ensemble_vote_explainer import EnsembleVoteExplainer


def run_tests():
    passed_count = 0
    failed_count = 0
    results = []

    def assert_test(name, condition, detail=""):
        nonlocal passed_count, failed_count
        if condition:
            passed_count += 1
            results.append((name, True, detail))
            print(f"PASS: {name}")
