import pytest
import pandas as pd
import os
import tempfile
import json

from art_valuation.valuation_engine import ValuationEngine


@pytest.fixture
def engine():
    return ValuationEngine()


@pytest.fixture
def sample_data():
    data = [
        {
            "艺术品编号": "ART-001",
            "艺术品名称": "《千里江山图》临摹",
            "艺术家": "王希孟传人",
            "创作年份": 2020,
            "类别": "国画",
            "材质": "绢本设色",
            "尺寸(cm)": "120x60",
            "寄存位置": "A区-01-01",
            "入库日期": "2023-01-15",
            "估值基数(CNY)": 500000,
            "临时出库": "否",
            "临时出库天数": 0,
            "币种": "CNY",
            "备注": "国家级临摹作品",
        },
        {
            "艺术品编号": "ART-002",
            "艺术品名称": "青铜鼎仿古器",
            "艺术家": "张氏铸造",
            "创作年份": 2019,
            "类别": "雕塑",
            "材质": "青铜",
            "尺寸(cm)": "40x30x50",
            "寄存位置": "B区-02-03",
            "入库日期": "2023-02-20",
            "估值基数(CNY)": 150000,
            "临时出库": "是",
            "临时出库天数": 15,
            "币种": "CNY",
            "备注": "博物馆级仿古",
        },
        {
            "艺术品编号": "ART-003",
            "艺术品名称": "梵高星空临摹",
            "艺术家": "荷兰艺术家",
            "创作年份": 2019,
            "类别": "油画",
            "材质": "布面油画",
            "尺寸(cm)": "90x70",
            "寄存位置": "A区-01-03",
            "入库日期": "2023-08-15",
            "估值基数(CNY)": 380000,
            "临时出库": "是",
            "临时出库天数": 25,
            "币种": "USD",
            "备注": "海外艺术家作品",
        },
    ]
    return pd.DataFrame(data)


class TestInputValidation:
    def test_validate_valid_input(self, engine, sample_data):
        is_valid, errors = engine.validate_input(sample_data)
        assert is_valid is True
        assert len(errors) == 0

    def test_validate_missing_required_columns(self, engine, sample_data):
        df_missing = sample_data.drop(columns=["艺术品编号"])
        is_valid, errors = engine.validate_input(df_missing)
        assert is_valid is False
        assert "缺少必需列" in errors[0]

    def test_validate_empty_file(self, engine):
        df_empty = pd.DataFrame(
            columns=[
                "艺术品编号",
                "艺术品名称",
                "估值基数(CNY)",
                "临时出库",
                "临时出库天数",
                "币种",
            ]
        )
        is_valid, errors = engine.validate_input(df_empty)
        assert is_valid is False
        assert "输入文件为空" in errors[0]


class TestDuplicateHandling:
    def test_remove_duplicates_enabled(self, engine, sample_data):
        dup_row = sample_data.iloc[0].copy()
        df_with_dup = pd.concat([sample_data, pd.DataFrame([dup_row])], ignore_index=True)
        
        engine.config["processing"]["remove_duplicates"] = True
        success_df, failed_df = engine.process_data(df_with_dup)
        
        assert len(success_df) == 3

    def test_duplicates_not_removed_when_disabled(self, engine, sample_data):
        dup_row = sample_data.iloc[0].copy()
        df_with_dup = pd.concat([sample_data, pd.DataFrame([dup_row])], ignore_index=True)
        
        engine.config["processing"]["remove_duplicates"] = False
        success_df, failed_df = engine.process_data(df_with_dup)
        
        assert len(success_df) == 4


class TestCurrencyConversion:
    def test_cny_no_conversion_needed(self, engine):
        value = engine._convert_to_cny(100000, "CNY")
        assert value == 100000

    def test_usd_to_cny_conversion(self, engine):
        value = engine._convert_to_cny(10000, "USD")
        assert value == 10000 * 7.25

    def test_eur_to_cny_conversion(self, engine):
        value = engine._convert_to_cny(10000, "EUR")
        assert value == 10000 * 7.85

    def test_unsupported_currency(self, engine):
        with pytest.raises(ValueError, match="不支持的币种汇率"):
            engine._convert_to_cny(10000, "GBP")


class TestTemporaryOutAdjustment:
    def test_no_temporary_out(self, engine):
        value, info = engine._apply_temporary_out_adjustment(100000, False, 0)
        assert value == 100000
        assert info["调整率"] == 1.0
        assert info["调整原因"] == "正常寄存"

    def test_temporary_out_within_max_days(self, engine):
        value, info = engine._apply_temporary_out_adjustment(100000, True, 15)
        assert 0.85 < info["调整率"] < 1.0
        assert "临时出库15天" in info["调整原因"]

    def test_temporary_out_exceed_max_days(self, engine):
        value, info = engine._apply_temporary_out_adjustment(100000, True, 45)
        assert info["调整率"] == 0.85
        assert "超30天" in info["调整原因"]


class TestInsurancePremium:
    def test_premium_calculation(self, engine):
        premium = engine._calculate_insurance_premium(100000)
        assert premium == 100000 * 0.005


class TestProcessingData:
    def test_process_all_success(self, engine, sample_data):
        success_df, failed_df = engine.process_data(sample_data)
        assert len(success_df) == 3
        assert len(failed_df) == 0
        assert all(success_df["处理状态"] == "成功")

    def test_process_with_invalid_value(self, engine, sample_data):
        sample_data.loc[1, "估值基数(CNY)"] = "invalid"
        
        success_df, failed_df = engine.process_data(sample_data)
        assert len(success_df) == 2
        assert len(failed_df) == 1
        assert failed_df.iloc[0]["处理状态"] == "失败"

    def test_skip_errors_disabled(self, engine, sample_data):
        sample_data.loc[1, "估值基数(CNY)"] = "invalid"
        engine.config["processing"]["skip_errors"] = False
        
        with pytest.raises(Exception):
            engine.process_data(sample_data)


class TestProgressAndResume:
    def test_progress_saved_after_processing(self, engine, sample_data, tmp_path):
        original_progress_file = engine.config["processing"]["progress_file"]
        engine.config["processing"]["progress_file"] = str(
            tmp_path / ".valuation_progress.json"
        )
        
        success_df, failed_df = engine.process_data(sample_data)
        
        with open(engine.config["processing"]["progress_file"], "r") as f:
            progress = json.load(f)
        
        assert len(progress["processed_ids"]) == 3
        assert "ART-001" in progress["processed_ids"]
        assert "last_run" in progress
        
        engine.config["processing"]["progress_file"] = original_progress_file

    def test_resume_skips_processed(self, engine, sample_data, tmp_path):
        original_progress_file = engine.config["processing"]["progress_file"]
        progress_file = str(tmp_path / ".valuation_progress.json")
        engine.config["processing"]["progress_file"] = progress_file
        
        df_partial = sample_data.iloc[:2].copy()
        engine.process_data(df_partial)
        
        engine2 = ValuationEngine()
        engine2.config["processing"]["progress_file"] = progress_file
        success_df, failed_df = engine2.process_data(sample_data, resume=True)
        
        assert len(success_df) == 1
        assert success_df.iloc[0]["艺术品编号"] == "ART-003"
        
        engine.config["processing"]["progress_file"] = original_progress_file

    def test_clear_progress(self, engine, tmp_path):
        progress_file = str(tmp_path / ".valuation_progress.json")
        engine.config["processing"]["progress_file"] = progress_file
        
        with open(progress_file, "w") as f:
            json.dump({"processed_ids": ["ART-001"], "last_run": "2024-01-01"}, f)
        
        assert os.path.exists(progress_file)
        
        engine.clear_progress()
        
        assert not os.path.exists(progress_file)
        assert engine.progress["processed_ids"] == []


class TestSummaryGeneration:
    def test_summary_with_success(self, engine, sample_data):
        success_df, failed_df = engine.process_data(sample_data)
        summary = engine.generate_summary(success_df, failed_df)
        
        assert summary["处理总数"] == 3
        assert summary["成功数量"] == 3
        assert summary["失败数量"] == 0
        assert summary["成功率"] == 100.0
        assert summary["总估值(CNY)"] > 0
        assert summary["总保险保费(CNY)"] > 0
        assert summary["临时出库数量"] == 2

    def test_summary_with_failures(self, engine, sample_data):
        sample_data.loc[1, "估值基数(CNY)"] = "invalid"
        success_df, failed_df = engine.process_data(sample_data)
        summary = engine.generate_summary(success_df, failed_df)
        
        assert summary["处理总数"] == 3
        assert summary["成功数量"] == 2
        assert summary["失败数量"] == 1
        assert summary["成功率"] < 100.0

    def test_currency_breakdown(self, engine, sample_data):
        success_df, failed_df = engine.process_data(sample_data)
        summary = engine.generate_summary(success_df, failed_df)
        
        assert "CNY" in summary["币种分布"]
        assert "USD" in summary["币种分布"]
        assert summary["币种分布"]["CNY"]["数量"] == 2
        assert summary["币种分布"]["USD"]["数量"] == 1


class TestOutputGeneration:
    def test_save_output_xlsx(self, engine, sample_data, tmp_path):
        success_df, failed_df = engine.process_data(sample_data)
        summary = engine.generate_summary(success_df, failed_df)
        
        output_path = str(tmp_path / "test_output.xlsx")
        saved_path = engine.save_output(success_df, failed_df, summary, output_path)
        
        assert os.path.exists(saved_path)
        assert saved_path.endswith(".xlsx")

    def test_save_output_csv(self, engine, sample_data, tmp_path):
        engine.config["output"]["format"] = "csv"
        success_df, failed_df = engine.process_data(sample_data)
        summary = engine.generate_summary(success_df, failed_df)
        
        output_path = str(tmp_path / "test_output.csv")
        saved_path = engine.save_output(success_df, failed_df, summary, output_path)
        
        assert os.path.exists(saved_path)

    def test_timestamp_filename(self, engine, sample_data, tmp_path):
        engine.config["output"]["timestamp_filename"] = True
        success_df, failed_df = engine.process_data(sample_data)
        summary = engine.generate_summary(success_df, failed_df)
        
        output_path = str(tmp_path / "test_output.xlsx")
        saved_path = engine.save_output(success_df, failed_df, summary, output_path)
        
        assert os.path.exists(saved_path)
        assert saved_path != output_path


class TestConfigLoading:
    def test_default_config(self, engine):
        assert engine.config["valuation"]["default_currency"] == "CNY"
        assert engine.config["valuation"]["exchange_rates"]["USD_to_CNY"] == 7.25
        assert engine.config["processing"]["remove_duplicates"] is True
        assert engine.config["output"]["format"] == "xlsx"

    def test_custom_config(self, tmp_path):
        config_content = """
valuation:
  default_currency: "USD"
  exchange_rates:
    USD_to_CNY: 7.30
processing:
  remove_duplicates: false
"""
        config_path = str(tmp_path / "custom_config.yaml")
        with open(config_path, "w") as f:
            f.write(config_content)
        
        engine = ValuationEngine(config_path)
        assert engine.config["valuation"]["default_currency"] == "USD"
        assert engine.config["valuation"]["exchange_rates"]["USD_to_CNY"] == 7.30
        assert engine.config["processing"]["remove_duplicates"] is False


@pytest.fixture(autouse=True)
def cleanup_progress():
    yield
    if os.path.exists(".valuation_progress.json"):
        os.remove(".valuation_progress.json")
