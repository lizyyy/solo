import pytest
from datetime import datetime
from freezevalidator.models import (
    SamplePosition, ScanLogEntry, TemperatureReading,
    TransferForm, ValidationRule, ValidationSeverity
)
from freezevalidator.rules import (
    check_duplicate_barcodes, check_invalid_positions,
    check_scan_vs_position, check_temperature_alerts,
    check_signatures, check_box_transfer_chain,
    run_all_rules
)


class TestDuplicateBarcodes:
    def test_no_duplicates(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
            SamplePosition(
                barcode="SAM002", box_id="BOX001",
                row=0, col=1, position_str="A02"
            ),
        ]
        issues = check_duplicate_barcodes(positions)
        assert len(issues) == 0
    
    def test_with_duplicates(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=1, position_str="A02"
            ),
            SamplePosition(
                barcode="SAM002", box_id="BOX001",
                row=0, col=2, position_str="A03"
            ),
        ]
        issues = check_duplicate_barcodes(positions)
        assert len(issues) == 1
        assert issues[0].rule == ValidationRule.DUPLICATE_BARCODE
        assert issues[0].severity == ValidationSeverity.ERROR
        assert "SAM001" in issues[0].affected_samples
        assert issues[0].details["duplicate_count"] == 2


class TestInvalidPositions:
    def test_valid_positions(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
            SamplePosition(
                barcode="SAM002", box_id="BOX001",
                row=9, col=9, position_str="J10"
            ),
        ]
        issues = check_invalid_positions(positions, max_rows=10, max_cols=10)
        assert len(issues) == 0
    
    def test_invalid_row(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=10, col=0, position_str="K01"
            ),
        ]
        issues = check_invalid_positions(positions, max_rows=10, max_cols=10)
        assert len(issues) == 1
        assert issues[0].rule == ValidationRule.INVALID_POSITION
        assert issues[0].severity == ValidationSeverity.ERROR
    
    def test_invalid_col(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=10, position_str="A11"
            ),
        ]
        issues = check_invalid_positions(positions, max_rows=10, max_cols=10)
        assert len(issues) == 1


class TestScanVsPosition:
    def test_perfect_match(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
        ]
        scans = [
            ScanLogEntry(
                barcode="SAM001", scan_time=datetime.now()
            ),
        ]
        issues = check_scan_vs_position(positions, scans)
        assert len(issues) == 0
    
    def test_missing_scan(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
            SamplePosition(
                barcode="SAM002", box_id="BOX001",
                row=0, col=1, position_str="A02"
            ),
        ]
        scans = [
            ScanLogEntry(
                barcode="SAM001", scan_time=datetime.now()
            ),
        ]
        issues = check_scan_vs_position(positions, scans)
        assert len(issues) == 1
        assert issues[0].rule == ValidationRule.MISSING_SCAN
        assert issues[0].severity == ValidationSeverity.ERROR
        assert "SAM002" in issues[0].affected_samples
    
    def test_unexpected_scan(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
        ]
        scans = [
            ScanLogEntry(
                barcode="SAM001", scan_time=datetime.now()
            ),
            ScanLogEntry(
                barcode="UNKNOWN", scan_time=datetime.now()
            ),
        ]
        issues = check_scan_vs_position(positions, scans)
        assert len(issues) == 1
        assert issues[0].rule == ValidationRule.UNEXPECTED_SCAN
        assert issues[0].severity == ValidationSeverity.WARNING


class TestTemperatureAlerts:
    def test_normal_temperature(self):
        readings = [
            TemperatureReading(
                timestamp=datetime.now(),
                temperature=-78.0,
                freezer_id="FREEZER001",
                is_alert=False,
                alert_marked=False
            ),
        ]
        issues = check_temperature_alerts(readings, min_temp=-85.0, max_temp=-70.0)
        assert len(issues) == 0
    
    def test_temperature_exceeded(self):
        readings = [
            TemperatureReading(
                timestamp=datetime.now(),
                temperature=-65.0,
                freezer_id="FREEZER001",
                is_alert=True,
                alert_marked=True
            ),
        ]
        issues = check_temperature_alerts(readings, min_temp=-85.0, max_temp=-70.0)
        assert len(issues) == 1
        assert issues[0].rule == ValidationRule.TEMPERATURE_EXCEEDED
        assert issues[0].severity == ValidationSeverity.WARNING
    
    def test_unmarked_alert(self):
        readings = [
            TemperatureReading(
                timestamp=datetime.now(),
                temperature=-65.0,
                freezer_id="FREEZER001",
                is_alert=True,
                alert_marked=False
            ),
        ]
        issues = check_temperature_alerts(readings, min_temp=-85.0, max_temp=-70.0)
        assert len(issues) == 2
        rules = {i.rule for i in issues}
        assert ValidationRule.TEMPERATURE_EXCEEDED in rules
        assert ValidationRule.TEMPERATURE_NOT_MARKED in rules
        
        unmarked = [i for i in issues if i.rule == ValidationRule.TEMPERATURE_NOT_MARKED][0]
        assert unmarked.severity == ValidationSeverity.ERROR


class TestSignatures:
    def test_full_signatures(self):
        form = TransferForm(
            transfer_id="T001",
            transfer_date=datetime.now(),
            sender_name="张三",
            sender_signature="ZS_SIG",
            receiver_name="李四",
            receiver_signature="LS_SIG",
        )
        issues = check_signatures(form)
        assert len(issues) == 0
    
    def test_missing_sender_signature(self):
        form = TransferForm(
            transfer_id="T001",
            transfer_date=datetime.now(),
            sender_name="张三",
            sender_signature=None,
            receiver_name="李四",
            receiver_signature="LS_SIG",
        )
        issues = check_signatures(form)
        assert len(issues) == 1
        assert issues[0].rule == ValidationRule.MISSING_SIGNATURE
        assert issues[0].severity == ValidationSeverity.ERROR
        assert "发送方" in issues[0].message
    
    def test_no_transfer_form(self):
        issues = check_signatures(None)
        assert len(issues) == 1
        assert issues[0].rule == ValidationRule.MISSING_SIGNATURE
        assert issues[0].severity == ValidationSeverity.WARNING


class TestBoxTransferChain:
    def test_perfect_match(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
            SamplePosition(
                barcode="SAM002", box_id="BOX002",
                row=0, col=0, position_str="A01"
            ),
        ]
        form = TransferForm(
            transfer_id="T001",
            transfer_date=datetime.now(),
            sender_name="张三",
            sender_signature="ZS",
            receiver_name="李四",
            receiver_signature="LS",
            box_ids=["BOX001", "BOX002"]
        )
        issues = check_box_transfer_chain(positions, form)
        assert len(issues) == 0
    
    def test_box_missing_from_form(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
            SamplePosition(
                barcode="SAM002", box_id="BOX003",
                row=0, col=0, position_str="A01"
            ),
        ]
        form = TransferForm(
            transfer_id="T001",
            transfer_date=datetime.now(),
            sender_name="张三",
            sender_signature="ZS",
            receiver_name="李四",
            receiver_signature="LS",
            box_ids=["BOX001"]
        )
        issues = check_box_transfer_chain(positions, form)
        assert len(issues) == 1
        assert issues[0].rule == ValidationRule.INCOMPLETE_TRANSFER_CHAIN
        assert issues[0].severity == ValidationSeverity.ERROR
    
    def test_box_extra_in_form(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
        ]
        form = TransferForm(
            transfer_id="T001",
            transfer_date=datetime.now(),
            sender_name="张三",
            sender_signature="ZS",
            receiver_name="李四",
            receiver_signature="LS",
            box_ids=["BOX001", "BOX002"]
        )
        issues = check_box_transfer_chain(positions, form)
        assert len(issues) == 1
        assert issues[0].rule == ValidationRule.INCOMPLETE_TRANSFER_CHAIN
        assert issues[0].severity == ValidationSeverity.WARNING


class TestRunAllRules:
    def test_clean_data(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
        ]
        scans = [
            ScanLogEntry(
                barcode="SAM001", scan_time=datetime.now()
            ),
        ]
        temps = [
            TemperatureReading(
                timestamp=datetime.now(),
                temperature=-78.0,
                freezer_id="FREEZER001"
            ),
        ]
        form = TransferForm(
            transfer_id="T001",
            transfer_date=datetime.now(),
            sender_name="张三",
            sender_signature="ZS",
            receiver_name="李四",
            receiver_signature="LS",
            box_ids=["BOX001"]
        )
        
        issues = run_all_rules(
            sample_positions=positions,
            scan_logs=scans,
            temperature_readings=temps,
            transfer_form=form
        )
        
        assert len(issues) == 0
    
    def test_with_issues(self):
        positions = [
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=0, position_str="A01"
            ),
            SamplePosition(
                barcode="SAM001", box_id="BOX001",
                row=0, col=1, position_str="A02"
            ),
        ]
        scans = []
        temps = []
        form = None
        
        issues = run_all_rules(
            sample_positions=positions,
            scan_logs=scans,
            temperature_readings=temps,
            transfer_form=form
        )
        
        rules_found = {i.rule for i in issues}
        assert ValidationRule.DUPLICATE_BARCODE in rules_found
        assert ValidationRule.MISSING_SCAN in rules_found
        assert ValidationRule.MISSING_SIGNATURE in rules_found
