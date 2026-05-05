import defusedxml.ElementTree as ET
from datetime import datetime
from app.models import CoverageReport, CoverageFile
from app import db
import re


def parse_coverage_xml(xml_content, report_name=None, module=None, owner=None):
    root = ET.fromstring(xml_content)
    
    coverage_report = CoverageReport()
    coverage_report.report_name = report_name or 'coverage-report'
    coverage_report.module = module
    coverage_report.owner = owner
    
    if root.tag == 'coverage':
        coverage_report = parse_coverage_element(root, coverage_report)
    
    return coverage_report


def parse_coverage_element(coverage, coverage_report):
    line_rate = float(coverage.get('line-rate', 0))
    branch_rate = float(coverage.get('branch-rate', 0))
    lines_valid = int(coverage.get('lines-valid', 0))
    lines_covered = int(coverage.get('lines-covered', 0))
    branches_valid = int(coverage.get('branches-valid', 0))
    branches_covered = int(coverage.get('branches-covered', 0))
    
    coverage_report.line_coverage = line_rate * 100
    coverage_report.branch_coverage = branch_rate * 100
    coverage_report.total_lines = lines_valid
    coverage_report.covered_lines = lines_covered
    coverage_report.missed_lines = lines_valid - lines_covered
    coverage_report.total_branches = branches_valid
    coverage_report.covered_branches = branches_covered
    
    timestamp_str = coverage.get('timestamp')
    if timestamp_str:
        try:
            ts = int(timestamp_str)
            coverage_report.timestamp = datetime.fromtimestamp(ts)
        except (ValueError, TypeError):
            pass
    
    coverage_files = []
    
    packages = coverage.find('packages')
    if packages is not None:
        for package in packages.findall('package'):
            package_name = package.get('name')
            classes = package.find('classes')
            if classes is not None:
                for cls in classes.findall('class'):
                    cf = parse_class_element(cls, coverage_report, package_name)
                    coverage_files.append(cf)
    
    classes = coverage.find('classes')
    if classes is not None:
        for cls in classes.findall('class'):
            cf = parse_class_element(cls, coverage_report)
            coverage_files.append(cf)
    
    for cf in coverage_files:
        if coverage_report.total_lines == 0:
            coverage_report.total_lines += cf.total_lines
            coverage_report.covered_lines += cf.covered_lines
            coverage_report.missed_lines += cf.missed_lines
        if coverage_report.total_branches == 0:
            coverage_report.total_branches += cf.total_branches
            coverage_report.covered_branches += cf.covered_branches
    
    if coverage_report.total_lines > 0 and coverage_report.line_coverage == 0:
        coverage_report.line_coverage = (coverage_report.covered_lines / coverage_report.total_lines) * 100
    if coverage_report.total_branches > 0 and coverage_report.branch_coverage == 0:
        coverage_report.branch_coverage = (coverage_report.covered_branches / coverage_report.total_branches) * 100
    
    coverage_report.files = coverage_files
    return coverage_report


def parse_class_element(cls, coverage_report, package_name=None):
    cf = CoverageFile()
    cf.file_path = cls.get('filename')
    cf.module = package_name or coverage_report.module
    cf.owner = coverage_report.owner
    
    if not cf.module and cf.file_path:
        module_match = re.match(r'^([^/\\]+)', cf.file_path)
        if module_match:
            cf.module = module_match.group(1)
    
    line_rate = float(cls.get('line-rate', 0))
    branch_rate = float(cls.get('branch-rate', 0))
    
    cf.line_coverage = line_rate * 100
    cf.branch_coverage = branch_rate * 100
    
    total_lines = 0
    covered_lines = 0
    missed_lines = 0
    total_branches = 0
    covered_branches = 0
    missed_lines_list = []
    
    lines = cls.find('lines')
    if lines is not None:
        for line in lines.findall('line'):
            total_lines += 1
            hits = int(line.get('hits', 0))
            line_number = int(line.get('number', 0))
            
            if hits > 0:
                covered_lines += 1
            else:
                missed_lines += 1
                missed_lines_list.append(line_number)
            
            if line.get('branch') == 'true':
                total_branches += 1
                condition_coverage = line.get('condition-coverage', '')
                if condition_coverage:
                    match = re.match(r'(\d+)%', condition_coverage)
                    if match:
                        if int(match.group(1)) > 0:
                            covered_branches += 1
    
    cf.total_lines = total_lines
    cf.covered_lines = covered_lines
    cf.missed_lines = missed_lines
    cf.total_branches = total_branches
    cf.covered_branches = covered_branches
    cf.set_missed_lines(missed_lines_list)
    
    if total_lines > 0 and cf.line_coverage == 0:
        cf.line_coverage = (covered_lines / total_lines) * 100
    
    return cf


def import_coverage_report(xml_content, report_name=None, module=None, owner=None):
    coverage_report = parse_coverage_xml(xml_content, report_name, module, owner)
    db.session.add(coverage_report)
    db.session.commit()
    return coverage_report
