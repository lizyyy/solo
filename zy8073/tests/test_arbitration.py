import pytest
from datetime import datetime, timedelta
from race_arbiter.parsers.entries import Entry
from race_arbiter.parsers.timings import TimingPoint
from race_arbiter.parsers.rules import RaceRules, Segment, Cutoff
from race_arbiter.parsers.appeals import Appeal
from race_arbiter.arbitration.arbitrator import Arbitrator


def create_test_rules():
    return RaceRules(
        race_name="Test Race",
        start_mat="START",
        end_mat="FINISH",
        segments=[
            Segment(id="seg1", name="Start to CP1", order=1, from_mat="START", to_mat="CP1"),
            Segment(id="seg2", name="CP1 to Finish", order=2, from_mat="CP1", to_mat="FINISH")
        ],
        cutoffs=[
            Cutoff(segment_id="seg1", time_limit="1:00:00", mat="CP1")
        ]
    )


def test_missing_mat_and_appeal():
    rules = create_test_rules()
    
    entries = {
        "1001": Entry(bib="1001", name="Test", category="42K", chip_id="CHIP001")
    }
    
    timings = [
        TimingPoint(chip_id="CHIP001", mat_id="START", timestamp=datetime(2024, 4, 1, 8, 0, 0)),
        TimingPoint(chip_id="CHIP001", mat_id="CP1", timestamp=datetime(2024, 4, 1, 8, 45, 0))
    ]
    
    appeals = [
        Appeal(
            bib="1001",
            type="missing_mat",
            mat_id="FINISH",
            timestamp=datetime(2024, 4, 1, 10, 0, 0),
            note="Manual finish"
        )
    ]
    
    arbitrator = Arbitrator(rules)
    result = arbitrator.process(entries, timings, appeals)
    
    runner = result.runners["1001"]
    assert runner.is_dnf is False
    assert runner.is_manual is True
    assert runner.net_time == timedelta(hours=2)
    assert "FINISH" in runner.mat_times
    assert any(v.type == "manual_addition" for v in runner.violations)


def test_duplicate_chip_pass():
    rules = create_test_rules()
    
    entries = {
        "1001": Entry(bib="1001", name="Test", category="42K", chip_id="CHIP001")
    }
    
    timings = [
        TimingPoint(chip_id="CHIP001", mat_id="START", timestamp=datetime(2024, 4, 1, 8, 0, 0)),
        TimingPoint(chip_id="CHIP001", mat_id="CP1", timestamp=datetime(2024, 4, 1, 8, 30, 0)),
        TimingPoint(chip_id="CHIP001", mat_id="CP1", timestamp=datetime(2024, 4, 1, 8, 30, 5)),
        TimingPoint(chip_id="CHIP001", mat_id="FINISH", timestamp=datetime(2024, 4, 1, 9, 30, 0))
    ]
    
    arbitrator = Arbitrator(rules)
    result = arbitrator.process(entries, timings, [])
    
    assert "CHIP001" in result.duplicate_chips
    assert len(result.duplicate_chips["CHIP001"]) == 1
    
    runner = result.runners["1001"]
    assert any(v.type == "duplicate_pass" for v in runner.violations)


def test_cutoff_violation():
    rules = create_test_rules()
    
    entries = {
        "1001": Entry(bib="1001", name="Test", category="42K", chip_id="CHIP001")
    }
    
    timings = [
        TimingPoint(chip_id="CHIP001", mat_id="START", timestamp=datetime(2024, 4, 1, 8, 0, 0)),
        TimingPoint(chip_id="CHIP001", mat_id="CP1", timestamp=datetime(2024, 4, 1, 9, 10, 0)),
        TimingPoint(chip_id="CHIP001", mat_id="FINISH", timestamp=datetime(2024, 4, 1, 10, 30, 0))
    ]
    
    arbitrator = Arbitrator(rules)
    result = arbitrator.process(entries, timings, [])
    
    runner = result.runners["1001"]
    assert any(v.type == "cutoff_violation" for v in runner.violations)


def test_unassigned_chip():
    rules = create_test_rules()
    
    entries = {
        "1001": Entry(bib="1001", name="Test", category="42K", chip_id="CHIP001")
    }
    
    timings = [
        TimingPoint(chip_id="CHIP001", mat_id="START", timestamp=datetime(2024, 4, 1, 8, 0, 0)),
        TimingPoint(chip_id="CHIP999", mat_id="CP1", timestamp=datetime(2024, 4, 1, 9, 0, 0))
    ]
    
    arbitrator = Arbitrator(rules)
    result = arbitrator.process(entries, timings, [])
    
    assert len(result.unassigned_chips) == 1
    assert result.unassigned_chips[0].chip_id == "CHIP999"


def test_dnf():
    rules = create_test_rules()
    
    entries = {
        "1001": Entry(bib="1001", name="Test", category="42K", chip_id="CHIP001")
    }
    
    timings = [
        TimingPoint(chip_id="CHIP001", mat_id="START", timestamp=datetime(2024, 4, 1, 8, 0, 0)),
        TimingPoint(chip_id="CHIP001", mat_id="CP1", timestamp=datetime(2024, 4, 1, 8, 30, 0))
    ]
    
    arbitrator = Arbitrator(rules)
    result = arbitrator.process(entries, timings, [])
    
    runner = result.runners["1001"]
    assert runner.is_dnf is True
    assert runner.net_time is None
