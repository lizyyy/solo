#!/usr/bin/env python3
import pytest
import os
import tempfile
from pathlib import Path
from reagent_inventory import ReagentInventoryValidator


class TestReagentInventoryValidator:
    @pytest.fixture
    def validator(self):
        return ReagentInventoryValidator()

    def create_test_csv(self, content, encoding='utf-8'):
        fd, path = tempfile.mkstemp(suffix='.csv')
        with os.fdopen(fd, 'w', encoding=encoding) as f:
            f.write(content)
        return Path(path)

    def test_missing_columns(self, validator):
        content = """试剂编号,试剂名称,浓度
R001,乙醇,95
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        missing_col_errors = [e for e in errors if e.error_type == '缺少必要列']
        assert len(missing_col_errors) > 0
        os.unlink(filepath)

    def test_duplicate_rows(self, validator):
        content = """试剂编号,试剂名称,规格,浓度,浓度单位,生产厂家,批号,有效期,存放位置,剩余量,是否空瓶,使用人,盘点日期
R001,无水乙醇,500mL,99.5,%,国药集团,20230101,2025-12-31,化学试剂柜A-01,0.5,否,张老师,2024-05-01
R001,无水乙醇,500mL,99.5,%,国药集团,20230101,2025-12-31,化学试剂柜A-01,0.5,否,张老师,2024-05-01
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        duplicate_errors = [e for e in errors if e.error_type == '重复行']
        assert len(duplicate_errors) == 1
        os.unlink(filepath)

    def test_encoding_error(self, validator):
        content = """试剂编号,试剂名称
R001,乙醇
"""
        filepath = self.create_test_csv(content, encoding='gbk')
        with open(filepath, 'rb') as f:
            data = f.read()
        with open(filepath, 'wb') as f:
            f.write(b'\xff\xfe' + data[:50])
        df, errors = validator.validate_file(filepath)
        os.unlink(filepath)

    def test_concentration_unit_error(self, validator):
        content = """试剂编号,试剂名称,规格,浓度,浓度单位,生产厂家,批号,有效期,存放位置,剩余量,是否空瓶,使用人,盘点日期
R001,盐酸,500mL,1,mol/l,国药集团,20230101,2025-12-31,化学试剂柜A-02,0.3,否,李老师,2024-05-01
R002,氯化钠溶液,1L,0.9,g/l,国药集团,20230201,2025-06-30,化学试剂柜B-01,0.8,否,王老师,2024-05-01
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        unit_errors = [e for e in errors if e.category == '浓度单位异常']
        assert len(unit_errors) >= 2
        os.unlink(filepath)

    def test_empty_bottle_error(self, validator):
        content = """试剂编号,试剂名称,规格,浓度,浓度单位,生产厂家,批号,有效期,存放位置,剩余量,是否空瓶,使用人,盘点日期
R001,丙酮,500mL,99.5,%,国药集团,20230101,2025-12-31,化学试剂柜A-03,0.2,是,赵老师,2024-05-01
R002,甲醇,500mL,99.9,%,国药集团,20230201,2025-06-30,化学试剂柜A-04,0,否,孙老师,2024-05-01
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        empty_errors = [e for e in errors if e.category == '空瓶未报废']
        assert len(empty_errors) == 2
        os.unlink(filepath)

    def test_retryable_errors(self, validator):
        content = """试剂编号,试剂名称,规格,浓度,浓度单位,生产厂家,批号,有效期,存放位置,剩余量,是否空瓶,使用人,盘点日期
R001,硫酸,500mL,98,%,国药集团,20230101,2025/12/31,化学试剂柜C-01,约一半,否,周老师,2024.05.01
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        retryable_errors = [e for e in errors if e.category == '可复跑输出']
        assert len(retryable_errors) >= 2
        os.unlink(filepath)

    def test_partial_failure_mixed(self, validator):
        content = """试剂编号,试剂名称,规格,浓度,浓度单位,生产厂家,批号,有效期,存放位置,剩余量,是否空瓶,使用人,盘点日期
R001,乙醇,500mL,95,%,国药集团,20230101,2025-12-31,化学试剂柜A-01,0.5,否,张老师,2024-05-01
R002,盐酸,500mL,1,mol/l,国药集团,20230102,2025-12-31,化学试剂柜A-02,0,否,李老师,2024-05-01
R003,NaOH溶液,1L,0.1,M,国药集团,20230103,2025-12-31,化学试剂柜A-03,很多,否,王老师,2024-05-01
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        assert len(errors) >= 3
        unit_errors = [e for e in errors if e.category == '浓度单位异常']
        empty_errors = [e for e in errors if e.category == '空瓶未报废']
        retryable_errors = [e for e in errors if e.category == '可复跑输出']
        assert len(unit_errors) >= 1
        assert len(empty_errors) >= 1
        assert len(retryable_errors) >= 1
        os.unlink(filepath)

    def test_perfect_data(self, validator):
        content = """试剂编号,试剂名称,规格,浓度,浓度单位,生产厂家,批号,有效期,存放位置,剩余量,是否空瓶,使用人,盘点日期
R001,无水乙醇,500mL,99.5,%,国药集团,20230101,2025-12-31,化学试剂柜A-01,0.5,否,张老师,2024-05-01
R002,氯化钠,500g,99.5,%,国药集团,20230201,2026-06-30,化学试剂柜B-01,0.8,否,李老师,2024-05-01
R003,盐酸标准溶液,1L,0.1,mol/L,国药集团,20230301,2025-03-31,化学试剂柜C-01,0.3,否,王老师,2024-05-01
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        assert len(errors) == 0
        os.unlink(filepath)

    def test_stats_count(self, validator):
        content = """试剂编号,试剂名称,规格,浓度,浓度单位,生产厂家,批号,有效期,存放位置,剩余量,是否空瓶,使用人,盘点日期
R001,盐酸,500mL,1,mol/l,国药集团,20230101,2025-12-31,化学试剂柜A-01,0.2,是,张老师,2024-05-01
R002,硫酸,500mL,98,%,国药集团,20230102,2025/12/31,化学试剂柜A-02,0.3,否,李老师,2024-05-01
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        assert validator.stats['浓度单位异常'] >= 1
        assert validator.stats['空瓶未报废'] >= 1
        assert validator.stats['可复跑输出'] >= 1
        os.unlink(filepath)

    def test_generate_report(self, validator):
        content = """试剂编号,试剂名称,规格,浓度,浓度单位,生产厂家,批号,有效期,存放位置,剩余量,是否空瓶,使用人,盘点日期
R001,乙醇,500mL,95,%,国药集团,20230101,2025-12-31,化学试剂柜A-01,0.5,否,张老师,2024-05-01
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        report = validator.generate_report()
        assert '高校实验室实验试剂盘点' in report
        assert '分类统计' in report
        assert '异常详情' in report
        os.unlink(filepath)

    def test_error_contains_file_and_line(self, validator):
        content = """试剂编号,试剂名称,规格,浓度,浓度单位,生产厂家,批号,有效期,存放位置,剩余量,是否空瓶,使用人,盘点日期
R001,盐酸,500mL,1,mol/l,国药集团,20230101,2025-12-31,化学试剂柜A-01,0.5,否,张老师,2024-05-01
"""
        filepath = self.create_test_csv(content)
        df, errors = validator.validate_file(filepath)
        for err in errors:
            assert err.file is not None
            assert err.line >= 1
        os.unlink(filepath)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
