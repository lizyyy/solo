import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import json
from pathlib import Path
from datetime import datetime

from app.models import (
    PCBData, BOMItem, RuleSet, Rule, Issue, IssueLocation,
    IssueSeverity, IssueStatus, Statistics, Summary, Layer, ComponentType
)
from app.services.rule_engine import RuleEngine
from app.services.report_generator import ReportGenerator

def load_json_file(path: str) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_csv_file(path: str) -> list:
    import csv
    items = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            item = BOMItem(
                reference=row.get("Reference", ""),
                part_number=row.get("PartNumber", row.get("Part Number", "")),
                description=row.get("Description", ""),
                footprint=row.get("Footprint", row.get("Package", "")),
                quantity=int(row.get("Quantity", row.get("Qty", 1))),
                manufacturer=row.get("Manufacturer", ""),
                value=row.get("Value", ""),
                is_available=row.get("Available", "True").lower() == "true"
            )
            items.append(item)
    return items

def test_sample_board():
    print("\n" + "="*60)
    print("TEST 1: Sample Board (Should have minimal issues)")
    print("="*60)
    
    data_dir = Path("data")
    board_data = load_json_file(data_dir / "sample_board.json")
    rules_data = load_json_file(data_dir / "sample_rules.json")
    bom_items = load_csv_file(data_dir / "sample_bom.csv")
    
    pcb_data = PCBData(**board_data)
    rule_set = RuleSet(**rules_data)
    
    engine = RuleEngine(pcb_data, rule_set, bom_items)
    results = engine.run_all_checks()
    
    print(f"Total issues: {results['statistics']['total']}")
    print(f"Critical: {results['statistics']['critical']}")
    print(f"Warning: {results['statistics']['warning']}")
    print(f"Info: {results['statistics']['info']}")
    
    for issue in results["issues"]:
        print(f"  - [{issue['severity']}] {issue['rule_name']}: {issue['title']}")
    
    return results

def test_error_board():
    print("\n" + "="*60)
    print("TEST 2: Error Board (Should trigger many issues)")
    print("="*60)
    
    data_dir = Path("data")
    board_data = load_json_file(data_dir / "error_board.json")
    rules_data = load_json_file(data_dir / "sample_rules.json")
    
    bad_bom_items = [
        BOMItem(
            reference="C1",
            part_number="CAP-001",
            description="100nF Capacitor",
            footprint="0805",
            quantity=1,
            manufacturer="Yageo",
            value="100nF",
            is_available=True
        ),
        BOMItem(
            reference="R1",
            part_number="RES-001",
            description="10k Resistor",
            footprint="0603",
            quantity=1,
            manufacturer="Yageo",
            value="10k",
            is_available=False
        )
    ]
    
    pcb_data = PCBData(**board_data)
    rule_set = RuleSet(**rules_data)
    
    engine = RuleEngine(pcb_data, rule_set, bad_bom_items)
    results = engine.run_all_checks()
    
    print(f"Total issues: {results['statistics']['total']}")
    print(f"Critical: {results['statistics']['critical']}")
    print(f"Warning: {results['statistics']['warning']}")
    print(f"Info: {results['statistics']['info']}")
    
    print("\nDetailed Issues:")
    for issue in results["issues"]:
        print(f"\n  [{issue['severity'].upper()}] {issue['title']}")
        print(f"    Rule: {issue['rule_name']}")
        print(f"    Description: {issue['description']}")
        print(f"    Suggestion: {issue['suggestion']}")
        if issue.get('location'):
            loc = issue['location']
            if loc.get('x') is not None and loc.get('y') is not None:
                print(f"    Location: ({loc['x']}, {loc['y']}) mm")
            if loc.get('reference'):
                print(f"    Component: {loc['reference']}")
    
    return results

def test_report_generation():
    print("\n" + "="*60)
    print("TEST 3: Report Generation")
    print("="*60)
    
    data_dir = Path("data")
    board_data = load_json_file(data_dir / "sample_board.json")
    rules_data = load_json_file(data_dir / "sample_rules.json")
    bom_items = load_csv_file(data_dir / "sample_bom.csv")
    
    pcb_data = PCBData(**board_data)
    rule_set = RuleSet(**rules_data)
    
    engine = RuleEngine(pcb_data, rule_set, bom_items)
    results = engine.run_all_checks()
    
    report_data = {
        "version_id": "test-v1",
        "timestamp": datetime.now().isoformat(),
        "issues": results["issues"],
        "statistics": results["statistics"],
        "summary": results["summary"]
    }
    
    generator = ReportGenerator()
    
    json_report = generator.generate_json(report_data)
    print("JSON Report: Generated successfully")
    print(f"  Length: {len(json_report)} chars")
    
    md_report = generator.generate_markdown(report_data)
    print("\nMarkdown Report: Generated successfully")
    print(f"  Length: {len(md_report)} chars")
    
    html_report = generator.generate_html(report_data)
    print("\nHTML Report: Generated successfully")
    print(f"  Length: {len(html_report)} chars")
    
    output_dir = data_dir
    with open(output_dir / "test_report.json", "w", encoding="utf-8") as f:
        f.write(json_report)
    print(f"\nSaved: {output_dir / 'test_report.json'}")
    
    with open(output_dir / "test_report.md", "w", encoding="utf-8") as f:
        f.write(md_report)
    print(f"Saved: {output_dir / 'test_report.md'}")
    
    with open(output_dir / "test_report.html", "w", encoding="utf-8") as f:
        f.write(html_report)
    print(f"Saved: {output_dir / 'test_report.html'}")
    
    return True

def test_rule_toggle():
    print("\n" + "="*60)
    print("TEST 4: Rule Toggle (Disable rules and verify)")
    print("="*60)
    
    data_dir = Path("data")
    board_data = load_json_file(data_dir / "error_board.json")
    rules_data = load_json_file(data_dir / "sample_rules.json")
    
    for rule in rules_data["rules"]:
        if rule["id"] in ["trace_width", "clearance"]:
            rule["enabled"] = False
            print(f"  Disabled rule: {rule['name']}")
    
    bom_items = []
    pcb_data = PCBData(**board_data)
    rule_set = RuleSet(**rules_data)
    
    engine = RuleEngine(pcb_data, rule_set, bom_items)
    results = engine.run_all_checks()
    
    print(f"\nTotal issues after disabling some rules: {results['statistics']['total']}")
    
    rule_ids_in_issues = set(issue["rule_id"] for issue in results["issues"])
    print(f"Rules that found issues: {sorted(rule_ids_in_issues)}")
    
    assert "trace_width" not in rule_ids_in_issues, "trace_width rule should not find issues when disabled"
    assert "clearance" not in rule_ids_in_issues, "clearance rule should not find issues when disabled"
    print("  ✓ Assertions passed: disabled rules did not find issues")
    
    return results

def test_data_validation():
    print("\n" + "="*60)
    print("TEST 5: Data Validation (Pydantic models)")
    print("="*60)
    
    valid_board = {
        "name": "Test Board",
        "version": "1.0",
        "units": "mm",
        "board_outline": {
            "width": 100.0,
            "height": 80.0,
            "origin_x": 0.0,
            "origin_y": 0.0,
            "keepout_zones": []
        },
        "components": [],
        "pads": [],
        "vias": [],
        "tracks": [],
        "silk_screen": [],
        "net_list": [],
        "critical_nets": [],
        "keepout_zones": []
    }
    
    pcb = PCBData(**valid_board)
    print(f"  Valid board created: {pcb.name}")
    print(f"  Board size: {pcb.board_outline.width} x {pcb.board_outline.height} mm")
    
    valid_bom = BOMItem(
        reference="R1",
        part_number="RES-001",
        description="10k Resistor",
        footprint="0603",
        quantity=1,
        manufacturer="Yageo",
        value="10k"
    )
    print(f"  Valid BOM item created: {valid_bom.reference}")
    
    valid_rule = Rule(
        id="test_rule",
        name="Test Rule",
        category="test",
        description="Test rule",
        severity=IssueSeverity.WARNING,
        enabled=True,
        parameters={"param1": 1.0}
    )
    print(f"  Valid rule created: {valid_rule.name}")
    
    print("\n  ✓ All data validation tests passed")
    return True

def run_all_tests():
    print("\n" + "#"*60)
    print("#  PCB Pre-Validation Tool - Self-Test Suite")
    print("#"*60)
    print(f"\nTest started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    test_results = []
    
    try:
        test1 = test_sample_board()
        test_results.append(("Sample Board", True, f"{test1['statistics']['total']} issues found"))
    except Exception as e:
        test_results.append(("Sample Board", False, str(e)))
    
    try:
        test2 = test_error_board()
        test_results.append(("Error Board", True, f"{test2['statistics']['total']} issues found"))
    except Exception as e:
        test_results.append(("Error Board", False, str(e)))
    
    try:
        test3 = test_report_generation()
        test_results.append(("Report Generation", True, "JSON/Markdown/HTML generated"))
    except Exception as e:
        test_results.append(("Report Generation", False, str(e)))
    
    try:
        test4 = test_rule_toggle()
        test_results.append(("Rule Toggle", True, "Disabled rules work correctly"))
    except Exception as e:
        test_results.append(("Rule Toggle", False, str(e)))
    
    try:
        test5 = test_data_validation()
        test_results.append(("Data Validation", True, "Pydantic models work"))
    except Exception as e:
        test_results.append(("Data Validation", False, str(e)))
    
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = 0
    failed = 0
    for name, success, message in test_results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {name}")
        print(f"       {message}")
        if success:
            passed += 1
        else:
            failed += 1
    
    print("\n" + "-"*60)
    print(f"Total: {passed}/{len(test_results)} tests passed")
    if failed > 0:
        print(f"WARNING: {failed} test(s) failed!")
    else:
        print("All tests passed!")
    print("-"*60)
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
