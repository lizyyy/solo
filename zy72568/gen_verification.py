import os

script = r'''
import sys
sys.path.insert(0, '.')

from track_prediction_patch.models import CandidateRecord
from track_prediction_patch.core import PatchWorkflow


def print_sep(title="", char="=", width=80):
    print()
    if title:
        prefix = " " + char * 2 + " " + title + " "
        suffix = char * max(0, width - len(prefix))
        print(prefix + suffix)
    else:
        print(char * width)


def print_section(title, num=None):
    print()
    print("=" * 80)
    if num:
        print("  Step " + str(num) + ": " + title)
    else:
        print("  " + title)
    print("=" * 80)


def print_kv(label, value, indent=2):
    print(" " * indent + "- " + label + ": " + str(value))


def find_track_detail(track_details, track_id):
    for detail in track_details:
        if detail["track_id"] == track_id:
            return detail
    return None


verification_results = {}


def record_verification(name, passed, detail=""):
    verification_results[name] = {
        "passed": passed,
        "detail": detail,
    }


def main():
    print_sep("Track Prediction Patch System - Verification Script", "=")
    print()
    print("  Scenario: Same track TRK_001 has both duplicate import and threshold conflict")
    print("  Threshold: 0.7 in candidate table vs 0.8 in param YAML")
    print()
    print("  Verification Goals:")
    print("    1. One track can have multiple issues at the same time")
    print("    2. Resolving threshold conflict does not affect duplicate import issue")
    print("    3. Export/Page/API all read the same consistent result")
    print("    4. Status changes, history, and audit logs are accurate")
    print()

    # Step 0: Create workflow
    print_section("Create workflow", num="0")
    workflow = PatchWorkflow(created_by="Engineer XiaoQiao")
    print("  Workflow created successfully")
    print_kv("Created by", "Engineer XiaoQiao")
    print_kv("Patch ID", workflow.patch_record.patch_id)
    print_kv("Initial status", workflow.patch_record.status)
    print()
    print("  Expected verification points:")
    print("    Check 1: One track with multiple issues")
    print("    Check 2: Threshold resolution does not affect duplicate import")
    print("    Check 3: Unified result consistency across 3 sources")
    print("    Check 4: Complete history and audit logs")

    # Step 1: First import - 3 records
    print_section("First import (TRK_001, TRK_002, TRK_003)", num="1")

    first_batch = [
        CandidateRecord(
            track_id="TRK_001",
            predicted_value=0.85,
            reported_threshold=0.7,
            is_missing=True,
            source="Recall System A",
        ),
        CandidateRecord(
            track_id="TRK_002",
            predicted_value=0.62,
            reported_threshold=0.7,
            is_missing=True,
            source="Recall System B",
        ),
        CandidateRecord(
            track_id="TRK_003",
            predicted_value=0.91,
            reported_threshold=0.7,
            is_missing=False,
            source="Recall System A",
        ),
    ]

    state, check_results, conflicts = workflow.step_1_import_candidates(
        first_batch,
        table_name="2026-06-21_candidate_table",
        import_batch="BATCH_20260621_001",
    )

    print("  Status message: " + state.status_message)
    print()
    print("  Result summary:")
    summary = state.result_summary
    print_kv("Total imported", summary["total_count"])
    print_kv("New records", summary["new_count"])
    print_kv("Duplicate records", summary["duplicate_count"])
    print_kv("Is first import", summary["is_first_import"])

    dup_issue_count = sum(
        1 for i in workflow.patch_record.issues
        if i.issue_type == "duplicate_import"
    )

    print()
    print("  Verify: duplicate_import issues should be 0 after first import")
    print_kv("Actual duplicate issues", dup_issue_count)
    print_kv("Expected", 0)

    passed = dup_issue_count == 0
    status = "PASS" if passed else "FAIL"
    print("  Result: " + status)
    record_verification("First import no false positive", passed,
                        "Actual: " + str(dup_issue_count) + ", Expected: 0")

    # Step 2: Append import - 3 records (2 duplicate, 1 new)
    print_section("Append import (TRK_001 dup, TRK_002 dup, TRK_004 new)", num="2")

    second_batch = [
        CandidateRecord(
            track_id="TRK_001",
            predicted_value=0.85,
            reported_threshold=0.7,
            is_missing=True,
            source="Recall System A",
        ),
        CandidateRecord(
            track_id="TRK_002",
            predicted_value=0.62,
            reported_threshold=0.7,
            is_missing=True,
            source="Recall System B",
        ),
        CandidateRecord(
            track_id="TRK_004",
            predicted_value=0.76,
            reported_threshold=0.7,
            is_missing=True,
            source="Recall System C",
        ),
    ]

    state, check_results, conflicts = workflow.append_candidates(
        second_batch,
        import_batch="BATCH_20260621_002",
    )

    print("  Status message: " + state.status_message)
    print()
    print("  Result summary:")
    summary = state.result_summary
    print_kv("This batch count", summary["total_count"])
    print_kv("New records", summary["new_count"])
    print_kv("Duplicate records", summary["duplicate_count"])
    print_kv("Duplicate track IDs", str(summary["duplicate_track_ids"]))

    dup_issues = [
        i for i in workflow.patch_record.issues
        if i.issue_type == "duplicate_import"
    ]

    print()
    print("  Issue list (duplicate_import):")
    for i, issue in enumerate(dup_issues, 1):
        print("    [" + str(i) + "] Track[" + issue.track_id + "]: " + issue.description)

    print()
    print("  Verify: 2 duplicate import records detected (TRK_001, TRK_002)")
    print_kv("Actual duplicate issues", len(dup_issues))
    print_kv("Expected", 2)

    dup_track_ids = sorted([i.track_id for i in dup_issues])
    expected_ids = sorted(["TRK_001", "TRK_002"])
    passed = len(dup_issues) == 2 and dup_track_ids == expected_ids
    status = "PASS" if passed else "FAIL"
    print("  Result: " + status)
    record_verification("Detected 2 duplicate imports", passed,
                        "Tracks: " + str(dup_track_ids) + ", Expected: " + str(expected_ids))

    # Step 3: Review param YAML
    print_section("Review param YAML (threshold 0.8, candidate reports 0.7)", num="3")

    yaml_content = """
thresholds:
  default:
    value: 0.8
    description: Default threshold
  high_confidence:
    value: 0.9
    description: High confidence threshold
model_version: "v2.3.1"
features:
  - velocity
  - acceleration
  - heading
"""

    state, check_results, conflicts = workflow.step_2_review_params(
        yaml_content=yaml_content,
        yaml_name="track_prediction_params_v2.yaml",
    )

    print("  Status message: " + state.status_message)
    print()
    print("  Threshold config:")
    for name, threshold in workflow.param_yaml.thresholds.items():
        print_kv(name, threshold.value, indent=4)

    print()
    print("  Threshold conflict list:")
    for i, conflict in enumerate(conflicts, 1):
        print("    [" + str(i) + "] Track[" + conflict.track_id + "]: " + conflict.description)
        print("        Candidate value: " + str(conflict.candidate_value))
        print("        YAML value: " + str(conflict.yaml_value))

    print()
    print("  TRK_001 issue stats at this point:")
    trk001_issues = [
        i for i in workflow.patch_record.issues
        if i.track_id == "TRK_001"
    ]
    print_kv("Total issues", len(trk001_issues))
    issue_types = sorted(list(set([i.issue_type for i in trk001_issues])))
    print_kv("Issue types", str(issue_types))

    print()
    print("  Verify: TRK_001 has both duplicate_import + threshold_mismatch")
    has_dup = "duplicate_import" in issue_types
    has_thresh = "threshold_mismatch" in issue_types
    passed = has_dup and has_thresh and len(trk001_issues) >= 2
    status = "PASS" if passed else "FAIL"
    print("  Result: " + status)
    record_verification("TRK_001 has two issues (pre-check)", passed,
                        "Types: " + str(issue_types) + ", Count: " + str(len(trk001_issues)))

    # Step 4: Key Verification 1 - Check track_details
    print_sep("Key Check 1: One track with multiple issues", "*", 80)
    print()
    print("  Get track_details from unified_result export data")
    print("  Verify TRK_001 retains both issue types")
    print()

    consistent = workflow.get_consistent_result()
    track_details = consistent["export"]["track_details"]

    trk001_detail = find_track_detail(track_details, "TRK_001")

    if trk001_detail:
        print("  TRK_001 detail key fields:")
        print_kv("has_issues", trk001_detail["has_issues"])
        print_kv("issues_count", trk001_detail["issues_count"])
        print_kv("issue_types", str(trk001_detail["issue_types"]))
        print_kv("has_duplicate_import", trk001_detail["has_duplicate_import"])
        print_kv("has_threshold_mismatch", trk001_detail["has_threshold_mismatch"])
        desc = trk001_detail.get("issue_description", "")
        print_kv("issue_description (first 100 chars)", desc[:100] + "...")
        print()
        print("  Full issues list:")
        for i, issue in enumerate(trk001_detail["issues"], 1):
            resolved_str = "resolved" if issue["resolved"] else "unresolved"
            print("    [" + str(i) + "] " + issue["issue_type"] + " - " + resolved_str)
            print("        Description: " + issue["description"][:80] + "...")
            print("        Severity: " + issue["severity"])

        print()
        print("  Verification:")
        has_both_types = (
            "duplicate_import" in trk001_detail["issue_types"]
            and "threshold_mismatch" in trk001_detail["issue_types"]
        )
        has_enough_issues = len(trk001_detail["issues"]) >= 2
        desc = trk001_detail.get("issue_description", "")
        has_both_in_desc = "duplicate_import" in desc and "threshold_mismatch" in desc

        print_kv("issue_types includes both types", has_both_types)
        print_kv("issues list length >= 2", has_enough_issues)
        print_kv("issue_description shows both issues", has_both_in_desc)

        passed = has_both_types and has_enough_issues
    else:
        print("  FAIL: TRK_001 detail not found")
        passed = False

    print()
    if passed:
        print("  PASS: One track with multiple issues coexist")
    else:
        print("  FAIL: Issues missing")
    record_verification("Check 1: One track multiple issues", passed)

    # Step 5: Key Verification 2 - Confirm TRK_001 threshold conflict
    print_sep("Key Check 2: Confirm TRK_001 threshold conflict", "*", 80)
    print()
    print("  Find TRK_001 conflict evidence_id")
    print("  Call resolve_conflict with resolution='confirmed'")
    print()

    trk001_conflict = None
    for conflict in conflicts:
        if conflict.track_id == "TRK_001":
            trk001_conflict = conflict
            break

    if trk001_conflict:
        print_kv("Conflict evidence ID", trk001_conflict.evidence_id)
        print_kv("Track ID", trk001_conflict.track_id)
        print_kv("Conflict description", trk001_conflict.description)
        print()

        print("  Calling resolve_conflict...")
        resolved = workflow.resolve_conflict(
            evidence_id=trk001_conflict.evidence_id,
            resolution="confirmed",
            resolved_by="Engineer XiaoQiao",
        )

        if resolved:
            print("  Threshold conflict confirmed")
            print("  Status message: " + workflow.state.status_message)

            has_dup_hint = "duplicate" in workflow.state.status_message.lower() or "未处理" in workflow.state.status_message
            print()
            print("  Verify: Status message mentions duplicate import still pending")
            print_kv("Mention exists", has_dup_hint)

            passed = has_dup_hint
            status = "PASS" if passed else "FAIL"
            print("  Result: " + status)
            record_verification("Check 2 pre: Hint about pending duplicate", passed)
    else:
        print("  FAIL: TRK_001 threshold conflict not found")
        record_verification("Check 2 pre: Hint about pending duplicate", False, "No conflict found")

    # Step 6: Key Verification 3 - Verify threshold resolution does not affect duplicate import
    print_sep("Key Check 3: Threshold resolution does not affect duplicate import", "*", 80)
    print()
    print("  Re-get track_details from unified_result")
    print("  Verify: threshold issue resolved, duplicate import still unresolved")
    print()

    consistent = workflow.get_consistent_result()
    track_details = consistent["export"]["track_details"]
    trk001_detail = find_track_detail(track_details, "TRK_001")

    if trk001_detail:
        print("  TRK_001 issue status:")
        print_kv("threshold_mismatch_resolved",
                 trk001_detail["threshold_mismatch_resolved"])
        print_kv("duplicate_import_resolved",
                 trk001_detail["duplicate_import_resolved"])
        print_kv("unresolved_issues_count",
                 trk001_detail["unresolved_issues_count"])
        print_kv("resolved_issues_count",
                 trk001_detail["resolved_issues_count"])

        print()
        print("  All TRK_001 issues in patch_record:")
        trk001_issues = [
            i for i in workflow.patch_record.issues
            if i.track_id == "TRK_001"
        ]
        for i, issue in enumerate(trk001_issues, 1):
            status_str = "resolved" if issue.resolved else "unresolved"
            print("    [" + str(i) + "] " + issue.issue_type + ": " + status_str)
            if issue.resolved:
                print("        Resolved by: " + issue.resolved_by)

        print()
        print("  Verification:")
        thresh_resolved = trk001_detail["threshold_mismatch_resolved"] is True
        dup_unresolved = trk001_detail["duplicate_import_resolved"] is False
        unresolved_gt0 = trk001_detail["unresolved_issues_count"] > 0

        print_kv("threshold_mismatch_resolved == True", thresh_resolved)
        print_kv("duplicate_import_resolved == False", dup_unresolved)
        print_kv("unresolved_issues_count > 0", unresolved_gt0)

        passed = thresh_resolved and dup_unresolved and unresolved_gt0
    else:
        print("  FAIL: TRK_001 detail not found")
        passed = False

    print()
    if passed:
        print("  PASS: Threshold resolution does not affect duplicate import")
    else:
        print("  FAIL: Duplicate import was incorrectly resolved")
    record_verification("Check 2: Threshold does not affect duplicate import", passed)

    # Step 7: Update tier metrics
    print_section("Update tier metrics", num="7")

    tier_metrics = {
        "tier_1": {
            "recall": 0.92,
            "precision": 0.88,
            "f1": 0.90,
            "count": 150,
        },
        "tier_2": {
            "recall": 0.85,
            "precision": 0.82,
            "f1": 0.83,
            "count": 320,
        },
        "tier_3": {
            "recall": 0.78,
            "precision": 0.75,
            "f1": 0.76,
            "count": 530,
        },
    }

    state, checks, unified_result = workflow.step_3_update_metrics(
        tier_metrics=tier_metrics,
        recalculate=False,
    )

    print("  Status message: " + state.status_message)
    print()
    print("  Tier metrics:")
    for tier, metrics in tier_metrics.items():
        print("    " + tier + ": recall=" + str(metrics["recall"])
              + ", precision=" + str(metrics["precision"])
              + ", f1=" + str(metrics["f1"])
              + ", count=" + str(metrics["count"]))

    print_kv("Workflow status", state.current_step, indent=2)

    # Step 8: Key Verification 4 - Unified result consistency
    print_sep("Key Check 4: Unified result consistency across 3 sources", "*", 80)
    print()
    print("  Call get_consistent_result()")
    print("  Verify: export/page/api all have identical data")
    print()

    consistent = workflow.get_consistent_result()

    print("  data_hash from three sources:")
    export_hash = consistent["export"]["data_hash"]
    page_hash = consistent["page"]["data_hash"]
    api_hash = consistent["api"]["data_hash"]

    print_kv("export", export_hash, indent=4)
    print_kv("page", page_hash, indent=4)
    print_kv("api", api_hash, indent=4)

    hash_same = export_hash == page_hash == api_hash
    print()
    print("  Verify: All three hashes are identical")
    print("  Result: " + ("PASS" if hash_same else "FAIL"))

    print()
    print("  Get TRK_001 detail from three sources:")

    export_detail = find_track_detail(consistent["export"]["track_details"], "TRK_001")
    page_detail = find_track_detail(consistent["page"]["track_details"], "TRK_001")
    api_detail = find_track_detail(consistent["api"]["track_details"], "TRK_001")

    if export_detail and page_detail and api_detail:
        export_issues_count = export_detail["issues_count"]
        page_issues_count = page_detail["issues_count"]
        api_issues_count = api_detail["issues_count"]

        print("    export issues_count: " + str(export_issues_count))
        print("    page issues_count: " + str(page_issues_count))
        print("    api issues_count: " + str(api_issues_count))

        issues_count_same = (
            export_issues_count == page_issues_count == api_issues_count
        )
        print()
        print("  Verify: issues_count is the same across all three sources")
        print("  Result: " + ("PASS" if issues_count_same else "FAIL"))

        print()
        print("  Verify: has_duplicate_import and has_threshold_mismatch are consistent")
        dup_same = (
            export_detail["has_duplicate_import"]
            == page_detail["has_duplicate_import"]
            == api_detail["has_duplicate_import"]
        )
        thresh_same = (
            export_detail["has_threshold_mismatch"]
            == page_detail["has_threshold_mismatch"]
            == api_detail["has_threshold_mismatch"]
        )
        print_kv("has_duplicate_import consistent", dup_same)
        print_kv("has_threshold_mismatch consistent", thresh_same)

        details_same = issues_count_same and dup_same and thresh_same
    else:
        print("    FAIL: TRK_001 detail not found in some sources")
        details_same = False

    passed = hash_same and details_same

    print()
    if passed:
        print("  PASS: Unified result is consistent across all three sources")
    else:
        print("  FAIL: Data is inconsistent")
    record_verification("Check 3: Unified result consistency", passed)

    # Step 9: History and audit logs
    print_sep("Check 4: History and audit logs", "*", 80)
    print()

    print("  All step_history entries:")
    for i, step in enumerate(workflow.state.step_history, 1):
        print("    [" + str(i) + "] " + step["step"])
        print("        Time: " + step["timestamp"][:19])
        print("        Operator: " + step.get("operator", "unknown"))
        print("        Description: " + step.get("description", ""))

    print()
    print("  Audit logs (who changed what, and why):")
    audit_history = workflow.reviewer.get_who_changed_what(
        workflow.patch_record.patch_id
    )
    for i, change in enumerate(audit_history, 1):
        print("    [" + str(i) + "] " + change["timestamp"][:19])
        print("        Operator: " + change["operator"])
        print("        Operation: " + change["operation"])
        print("        Reason: " + change["reason"])

    print()
    print("  Verify: Contains import_candidates * 2, load_params, confirm_conflict, update_metrics")

    operations = [c["operation"] for c in audit_history]

    has_import_count = operations.count("import_candidates")
    has_load_params = "load_params" in operations
    has_confirm_conflict = "confirm_conflict" in operations
    has_update_metrics = "update_metrics" in operations

    print_kv("import_candidates count >= 2", has_import_count >= 2)
    print_kv("Has load_params", has_load_params)
    print_kv("Has confirm_conflict", has_confirm_conflict)
    print_kv("Has update_metrics", has_update_metrics)

    passed = (
        has_import_count >= 2
        and has_load_params
        and has_confirm_conflict
        and has_update_metrics
    )

    print()
    if passed:
        print("  PASS: History records are complete")
    else:
        print("  FAIL: History records are incomplete")
    record_verification("Check 4: Complete history records", passed)

    # Step 10: Verification summary
    print_sep("Verification Summary", "=", 80)
    print()
    print("  +--------------------------------------------------------------+")
    print("  |                  VERIFICATION SUMMARY TABLE                  |")
    print("  +----------+--------------------------------+------------------+")
    print("  |  ID      |  Item                          |  Result          |")
    print("  +----------+--------------------------------+------------------+")

    key_items = [
        ("Check 1", "One track with multiple issues", verification_results.get("Check 1: One track multiple issues", {}).get("passed", False)),
        ("Check 2", "Threshold not affect duplicate", verification_results.get("Check 2: Threshold does not affect duplicate import", {}).get("passed", False)),
        ("Check 3", "Unified result consistency", verification_results.get("Check 3: Unified result consistency", {}).get("passed", False)),
        ("Check 4", "Complete history records", verification_results.get("Check 4: Complete history records", {}).get("passed", False)),
    ]

    for num, name, passed in key_items:
        status = "  PASS  " if passed else "  FAIL  "
        name_pad = " " * (30 - len(name)) if len(name) < 30 else ""
        print("  |  " + num + "  |  " + name + name_pad + "| " + status + " |")

    print("  +----------+--------------------------------+------------------+")

    other_items = [
        ("Helper", "First import no false positive", verification_results.get("First import no false positive", {}).get("passed", False)),
        ("Helper", "Detected 2 duplicate imports", verification_results.get("Detected 2 duplicate imports", {}).get("passed", False)),
        ("Helper", "TRK_001 has two issues (pre)", verification_results.get("TRK_001 has two issues (pre-check)", {}).get("passed", False)),
        ("Helper", "Hint about pending duplicate", verification_results.get("Check 2 pre: Hint about pending duplicate", {}).get("passed", False)),
    ]

    for num, name, passed in other_items:
        status = "  PASS  " if passed else "  FAIL  "
        name_pad = " " * (30 - len(name)) if len(name) < 30 else ""
        print("  |  " + num + "  |  " + name + name_pad + "| " + status + " |")

    print("  +----------+--------------------------------+------------------+")
    print()

    total_key = 4
    passed_key = sum(
        1 for k, v in verification_results.items()
        if k.startswith("Check ") and v.get("passed", False)
    )

    print("  Key verification points: " + str(passed_key) + "/" + str(total_key) + " passed")
    print()

    all_passed = all(
        v.get("passed", False)
        for k, v in verification_results.items()
        if k.startswith("Check ")
    )

    if all_passed:
        print("  +==============================================================+")
        print("  |              OVERALL RESULT: ALL PASSED                     |")
        print("  +==============================================================+")
        print("  |  1. One track can have multiple issues simultaneously       |")
        print("  |  2. Resolving threshold does not affect duplicate import    |")
        print("  |  3. Export/Page/API read same data, fully consistent       |")
        print("  |  4. All operations have history and audit logs              |")
        print("  +==============================================================+")
    else:
        print("  +==============================================================+")
        print("  |              OVERALL RESULT: SOME FAILED                    |")
        print("  +==============================================================+")
        print()
        print("  Failed items:")
        for name, result in verification_results.items():
            if not result.get("passed", False):
                print("    - " + name + ": " + result.get("detail", "No details"))

    print()
    print_sep("Verification script completed", "=")


if __name__ == "__main__":
    main()
'''

output_path = "/Users/lzy/pro/solo/workspaces/zy72568/track_prediction_patch/examples/demo_verification.py"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(script.strip())

print("File written successfully!")
print("Path:", output_path)
print("Size:", os.path.getsize(output_path), "bytes")
print("Lines:", len(script.strip().splitlines()))
