import os
import pandas as pd
import pytest
import tempfile

from jiazheng_callback.core import (
    mask_phone,
    read_excel_file,
    process_files,
    REQUIRED_COLUMNS,
)
from jiazheng_callback.exceptions import (
    FileReadError,
    MissingColumnError,
    EmptyFileError,
)


class TestMaskPhone:
    def test_mask_phone_normal(self):
        assert mask_phone("13800138001") == "138****8001"

    def test_mask_phone_empty(self):
        assert mask_phone("") == ""

    def test_mask_phone_nan(self):
        assert mask_phone(pd.NA) == ""

    def test_mask_phone_non_standard(self):
        assert mask_phone("12345") == "12345"


class TestReadExcelFile:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def create_test_excel(self, filename, data, columns=None):
        if columns is None:
            columns = REQUIRED_COLUMNS
        df = pd.DataFrame(data, columns=columns)
        path = os.path.join(self.temp_dir, filename)
        df.to_excel(path, index=False, engine="openpyxl")
        return path

    def test_read_excel_file_success(self):
        path = self.create_test_excel(
            "test.xlsx",
            [["张三", "13800138001", "2024-01-01", "日常保洁", "李阿姨", "已回访", "满意"]],
        )
        df = read_excel_file(path)
        assert len(df) == 1
        assert df.iloc[0]["客户姓名"] == "张三"

    def test_read_excel_file_not_exists(self):
        with pytest.raises(FileReadError, match="文件不存在"):
            read_excel_file(os.path.join(self.temp_dir, "nonexistent.xlsx"))

    def test_read_excel_file_empty(self):
        path = self.create_test_excel("empty.xlsx", [])
        with pytest.raises(EmptyFileError, match="文件为空"):
            read_excel_file(path)

    def test_read_excel_file_missing_column(self):
        path = self.create_test_excel(
            "missing_col.xlsx",
            [["张三", "13800138001"]],
            columns=["客户姓名", "手机号码"],
        )
        with pytest.raises(MissingColumnError, match="文件缺少必要列"):
            read_excel_file(path)


class TestProcessFiles:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def create_test_excel(self, filename, data, columns=None):
        if columns is None:
            columns = REQUIRED_COLUMNS
        df = pd.DataFrame(data, columns=columns)
        path = os.path.join(self.temp_dir, filename)
        df.to_excel(path, index=False, engine="openpyxl")
        return path

    def test_process_files_with_duplicates(self):
        path1 = self.create_test_excel(
            "file1.xlsx",
            [
                ["张三", "13800138001", "2024-01-01", "日常保洁", "李阿姨", "已回访", "满意"],
                ["李四", "13900139002", "2024-01-02", "深度清洁", "王阿姨", "已回访", "一般"],
            ],
        )
        path2 = self.create_test_excel(
            "file2.xlsx",
            [
                ["张三", "13800138001", "2024-01-03", "日常保洁", "李阿姨", "已回访", "非常满意"],
                ["王五", "13700137003", "2024-01-04", "家电清洗", "张师傅", "已回访", "满意"],
            ],
        )

        results = process_files([path1, path2])
        assert len(results["success"]) == 1
        assert len(results["success"][0]) == 3
        assert len(results["duplicates"][0]) == 2
        assert len(results["rerun"][0]) == 3

    def test_process_files_partial_failure(self):
        valid_path = self.create_test_excel(
            "valid.xlsx",
            [["张三", "13800138001", "2024-01-01", "日常保洁", "李阿姨", "已回访", "满意"]],
        )
        invalid_path = os.path.join(self.temp_dir, "invalid.xlsx")

        results = process_files([valid_path, invalid_path])
        assert len(results["success"]) == 1
        assert len(results["success"][0]) == 1
        assert len(results["failed"]) == 1

    def test_process_files_all_failure(self):
        path1 = os.path.join(self.temp_dir, "nonexistent1.xlsx")
        path2 = os.path.join(self.temp_dir, "nonexistent2.xlsx")

        results = process_files([path1, path2])
        assert len(results["success"]) == 0
        assert len(results["failed"]) == 2

    def test_phone_masking_in_output(self):
        path = self.create_test_excel(
            "phone_test.xlsx",
            [["张三", "13800138001", "2024-01-01", "日常保洁", "李阿姨", "已回访", "满意"]],
        )
        results = process_files([path])
        assert results["success"][0].iloc[0]["手机号码"] == "138****8001"

    def test_rerun_output_has_last_occurrence(self):
        path = self.create_test_excel(
            "rerun_test.xlsx",
            [
                ["张三", "13800138001", "2024-01-01", "日常保洁", "李阿姨", "已回访", "满意"],
                ["张三", "13800138001", "2024-01-02", "日常保洁", "李阿姨", "已回访", "非常满意"],
            ],
        )
        results = process_files([path])
        rerun_df = results["rerun"][0]
        assert len(rerun_df) == 1
        assert rerun_df.iloc[0]["回访结果"] == "非常满意"
