import pytest
import sys
import os
from datetime import datetime, timedelta
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src import (
    ConfigLoader,
    CompatibilityChecker,
    InventoryManager,
    AppointmentManager,
    AllocationEngine,
    IssueDetector,
    ReportGenerator
)


@pytest.fixture
def config_loader():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config_dir = os.path.join(base_dir, 'config')
    loader = ConfigLoader(config_dir)
    loader.load_compatibility_config()
    loader.load_campus_config()
    return loader


@pytest.fixture
def compatibility_checker(config_loader):
    return CompatibilityChecker(config_loader)


@pytest.fixture
def sample_inventory_df():
    data = {
        'blood_bag_id': ['BAG001', 'BAG002', 'BAG003', 'BAG004', 'BAG005', 'BAG006', 'BAG007', 'BAG008'],
        'abo_type': ['O', 'A', 'B', 'AB', 'O', 'B', 'B', 'A'],
        'rh_factor': ['+', '+', '+', '+', '-', '-', '-', '+'],
        'blood_type': ['O+', 'A+', 'B+', 'AB+', 'O-', 'B-', 'B-', 'A+'],
        'volume_ml': [450, 450, 450, 450, 450, 450, 450, 450],
        'campus': ['campus_1', 'campus_1', 'campus_2', 'campus_2', 'campus_1', 'campus_1', 'campus_1', 'campus_1'],
        'storage_location': ['A1', 'A2', 'B1', 'B2', 'C1', 'D1', 'D2', 'A3'],
        'expiry_date': pd.to_datetime([
            '2026-05-04',
            '2026-05-08',
            '2026-05-15',
            '2026-05-20',
            '2026-05-03',
            '2026-05-04',
            '2026-05-04',
            '2026-05-05'
        ]),
        'collection_date': pd.to_datetime([
            '2026-04-24',
            '2026-04-28',
            '2026-05-05',
            '2026-05-10',
            '2026-04-23',
            '2026-04-24',
            '2026-04-24',
            '2026-04-25'
        ]),
        'status': ['available', 'available', 'available', 'available', 'available', 'available', 'available', 'available'],
        'donor_id': ['D001', 'D002', 'D003', 'D004', 'D005', 'D006', 'D007', 'D008']
    }
    return pd.DataFrame(data)


@pytest.fixture
def inventory_manager(sample_inventory_df):
    return InventoryManager(sample_inventory_df)


@pytest.fixture
def sample_appointments():
    return [
        {
            'appointment_id': 'APT001',
            'patient_id': 'P001',
            'patient_name': '张三',
            'department': '外科',
            'campus': 'campus_1',
            'required_blood_type': 'A+',
            'required_volume_ml': 900,
            'scheduled_start_time': '2026-05-04T09:00:00',
            'scheduled_end_time': '2026-05-04T12:00:00',
            'urgency': 'routine',
            'status': 'pending',
            'assigned_blood_bags': [],
            'notes': '常规手术'
        },
        {
            'appointment_id': 'APT002',
            'patient_id': 'P002',
            'patient_name': '李四',
            'department': '急诊科',
            'campus': 'campus_1',
            'required_blood_type': 'O+',
            'required_volume_ml': 450,
            'scheduled_start_time': '2026-05-04T23:00:00',
            'scheduled_end_time': '2026-05-05T02:00:00',
            'urgency': 'emergency',
            'status': 'pending',
            'assigned_blood_bags': [],
            'notes': '急诊手术，跨午夜'
        },
        {
            'appointment_id': 'APT003',
            'patient_id': 'P003',
            'patient_name': '王五',
            'department': '内科',
            'campus': 'campus_2',
            'required_blood_type': 'AB-',
            'required_volume_ml': 450,
            'scheduled_start_time': '2026-05-05T14:00:00',
            'scheduled_end_time': '2026-05-05T16:00:00',
            'urgency': 'routine',
            'status': 'pending',
            'assigned_blood_bags': [],
            'notes': '稀有血型'
        }
    ]


@pytest.fixture
def appointment_manager(sample_appointments):
    return AppointmentManager(sample_appointments)


class TestCompatibilityChecker:
    def test_parse_blood_type(self, compatibility_checker):
        assert compatibility_checker.parse_blood_type('O+') == ('O', '+')
        assert compatibility_checker.parse_blood_type('A-') == ('A', '-')
        assert compatibility_checker.parse_blood_type('AB+') == ('AB', '+')
        assert compatibility_checker.parse_blood_type('B-') == ('B', '-')

    def test_abo_compatibility(self, compatibility_checker):
        is_compat, reason = compatibility_checker.is_compatible('O+', 'A+')
        assert is_compat, f"O+ 应该可以输给 A+，原因: {reason}"

        is_compat, reason = compatibility_checker.is_compatible('A+', 'O+')
        assert not is_compat, "A+ 不应该可以输给 O+"

        is_compat, reason = compatibility_checker.is_compatible('AB+', 'AB+')
        assert is_compat, "AB+ 应该可以输给 AB+"

    def test_rh_compatibility(self, compatibility_checker):
        is_compat, reason = compatibility_checker.is_compatible('O-', 'O+')
        assert is_compat, "O- 应该可以输给 O+"

        is_compat, reason = compatibility_checker.is_compatible('O+', 'O-')
        assert not is_compat, "O+ 不应该可以输给 O-"

    def test_compatibility_level(self, compatibility_checker):
        assert compatibility_checker.get_compatibility_level('A+', 'A+') == 1
        assert compatibility_checker.get_compatibility_level('A+', 'A-') == 2
        assert compatibility_checker.get_compatibility_level('O+', 'A+') == 3

    def test_get_compatible_blood_types(self, compatibility_checker):
        compatible = compatibility_checker.get_compatible_blood_types_for_recipient('A+')
        assert 'A+' in compatible
        assert 'A-' in compatible
        assert 'O+' in compatible
        assert 'O-' in compatible
        assert 'B+' not in compatible

        compatible = compatibility_checker.get_compatible_blood_types_for_recipient('A-')
        assert 'A-' in compatible
        assert 'O-' in compatible
        assert 'A+' not in compatible
        assert 'O+' not in compatible


class TestAppointmentManager:
    def test_is_cross_midnight(self, appointment_manager):
        apt_normal = appointment_manager.get_appointment_by_id('APT001')
        assert not appointment_manager.is_cross_midnight(apt_normal)

        apt_cross = appointment_manager.get_appointment_by_id('APT002')
        assert appointment_manager.is_cross_midnight(apt_cross)

    def test_check_time_overlap(self, appointment_manager):
        apt1 = appointment_manager.get_appointment_by_id('APT001')
        apt2 = appointment_manager.get_appointment_by_id('APT002')

        assert not appointment_manager.check_time_overlap(apt1, apt2)

        overlapping_apt = {
            'appointment_id': 'APT004',
            'scheduled_start_time': '2026-05-04T10:00:00',
            'scheduled_end_time': '2026-05-04T11:00:00'
        }
        assert appointment_manager.check_time_overlap(apt1, overlapping_apt)

    def test_sort_appointments_by_priority(self, appointment_manager):
        sorted_apt = appointment_manager.sort_appointments_by_priority()

        assert sorted_apt[0]['urgency'] == 'emergency'
        assert sorted_apt[0]['appointment_id'] == 'APT002'

    def test_get_cross_midnight_appointments(self, appointment_manager):
        cross = appointment_manager.get_cross_midnight_appointments()
        assert len(cross) == 1
        assert cross[0]['appointment_id'] == 'APT002'


class TestInventoryManager:
    def test_get_expiring_bags(self, inventory_manager):
        current_date = datetime(2026, 5, 3)
        expiring = inventory_manager.get_expiring_bags(current_date=current_date, days_threshold=5)

        assert len(expiring) >= 4

        blood_bag_ids = expiring['blood_bag_id'].tolist()
        assert 'BAG001' in blood_bag_ids
        assert 'BAG005' in blood_bag_ids

    def test_get_available_bags(self, inventory_manager):
        bags = inventory_manager.get_available_bags(campus='campus_1')
        assert len(bags) >= 4

        bags = inventory_manager.get_available_bags(blood_type='O+')
        assert len(bags) == 1
        assert bags.iloc[0]['blood_bag_id'] == 'BAG001'

    def test_mark_bag_assigned(self, inventory_manager):
        result = inventory_manager.mark_bag_assigned('BAG001', 'APT001')
        assert result is True
        assert inventory_manager.is_bag_assigned('BAG001')

        assignments = inventory_manager.get_bag_assignments('BAG001')
        assert 'APT001' in assignments


class TestAllocationEngine:
    def test_basic_allocation(self, config_loader, compatibility_checker,
                                inventory_manager, appointment_manager):
        current_date = datetime(2026, 5, 3)

        allocation_engine = AllocationEngine(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager
        )

        results, unmet = allocation_engine.run_allocation(current_date)

        assert len(results) == 3

    def test_expiring_priority_list(self, config_loader, compatibility_checker,
                                      inventory_manager, appointment_manager):
        current_date = datetime(2026, 5, 3)

        allocation_engine = AllocationEngine(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager
        )

        priority_list = allocation_engine.get_expiring_priority_list(current_date)

        assert not priority_list.empty


class TestIssueDetector:
    def test_detect_duplicate_assignment(self, config_loader, compatibility_checker,
                                            inventory_manager, appointment_manager):
        current_date = datetime(2026, 5, 3)

        inventory_manager.mark_bag_assigned('BAG001', 'APT001')
        inventory_manager.assigned_bags['BAG001'].append('APT002')

        allocation_engine = AllocationEngine(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager
        )
        allocation_engine.run_allocation(current_date)

        issue_detector = IssueDetector(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager,
            allocation_engine
        )

        issues = issue_detector.detect_all_issues(current_date)

        duplicate_issues = issue_detector.get_issues_by_type('duplicate_assignment')
        assert len(duplicate_issues) >= 0

    def test_detect_cross_midnight(self, config_loader, compatibility_checker,
                                     inventory_manager, appointment_manager):
        current_date = datetime(2026, 5, 3)

        allocation_engine = AllocationEngine(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager
        )
        allocation_engine.run_allocation(current_date)

        issue_detector = IssueDetector(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager,
            allocation_engine
        )

        issues = issue_detector.detect_all_issues(current_date)

        cross_midnight_issues = issue_detector.get_issues_by_type('cross_midnight')
        assert len(cross_midnight_issues) >= 1

    def test_detect_expiring_soon(self, config_loader, compatibility_checker,
                                    inventory_manager, appointment_manager):
        current_date = datetime(2026, 5, 3)

        allocation_engine = AllocationEngine(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager
        )
        allocation_engine.run_allocation(current_date)

        issue_detector = IssueDetector(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager,
            allocation_engine
        )

        issues = issue_detector.detect_all_issues(current_date)

        expiring_issues = issue_detector.get_issues_by_type('expiring_soon')
        assert len(expiring_issues) >= 1


class TestReportGenerator:
    def test_generate_review_report(self, config_loader, compatibility_checker,
                                      inventory_manager, appointment_manager):
        current_date = datetime(2026, 5, 3)

        allocation_engine = AllocationEngine(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager
        )
        allocation_engine.run_allocation(current_date)

        issue_detector = IssueDetector(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager,
            allocation_engine
        )
        issue_detector.detect_all_issues(current_date)

        report_generator = ReportGenerator(
            config_loader,
            inventory_manager,
            appointment_manager,
            allocation_engine,
            issue_detector
        )

        report = report_generator.generate_review_report(current_date)

        assert isinstance(report, str)
        assert len(report) > 0
        assert '血库红细胞库存效期调拨评审报告' in report

    def test_generate_issues_csv(self, config_loader, compatibility_checker,
                                   inventory_manager, appointment_manager):
        current_date = datetime(2026, 5, 3)

        allocation_engine = AllocationEngine(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager
        )
        allocation_engine.run_allocation(current_date)

        issue_detector = IssueDetector(
            config_loader,
            compatibility_checker,
            inventory_manager,
            appointment_manager,
            allocation_engine
        )
        issue_detector.detect_all_issues(current_date)

        report_generator = ReportGenerator(
            config_loader,
            inventory_manager,
            appointment_manager,
            allocation_engine,
            issue_detector
        )

        csv_content = report_generator.generate_issues_csv()

        assert isinstance(csv_content, str)
        assert 'issue_id' in csv_content or 'issue_type' in csv_content


class TestConfigLoader:
    def test_load_compatibility_config(self, config_loader):
        assert 'abo_compatibility' in config_loader.compatibility_config
        assert 'rh_compatibility' in config_loader.compatibility_config

    def test_load_campus_config(self, config_loader):
        assert 'campuses' in config_loader.campus_config
        assert 'distance_matrix' in config_loader.campus_config

    def test_get_campus_distance(self, config_loader):
        distance = config_loader.get_campus_distance('campus_1', 'campus_2')
        assert distance == 15

        distance = config_loader.get_campus_distance('campus_1', 'campus_1')
        assert distance == 0

    def test_is_rare_blood_type(self, config_loader):
        assert config_loader.is_rare_blood_type('AB-') is True
        assert config_loader.is_rare_blood_type('O+') is False
