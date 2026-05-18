import pytest
import pandas as pd
from datetime import datetime, timedelta
from models import ClaimStatus, TemperatureProbeStatus
from import_service import ColdChainClaimImportService


@pytest.fixture
def import_service():
    return ColdChainClaimImportService()


def create_test_row(**kwargs):
    base_row = {
        "索赔单号": "TEST-001",
        "仓库编码": "WH-TEST-001",
        "仓库名称": "测试仓库",
        "运单号": "TEST20240501001",
        "货物名称": "测试药品",
        "货物批次": "T20240501-01",
        "货物数量": 100,
        "计量单位": "盒",
        "温度要求": "2-8℃",
        "实际平均温度": 5.0,
        "温度探头编号": "TP-TEST-001",
        "探头状态": "正常",
        "测温开始时间": datetime.now() - timedelta(hours=24),
        "测温结束时间": datetime.now(),
        "异常持续时长(小时)": 0,
        "责任方": "无",
        "索赔金额": 0,
        "申请人": "测试员",
        "申请时间": datetime.now(),
        "状态": "草稿"
    }
    base_row.update(kwargs)
    return base_row


class TestColdChainClaimImportService:
    
    def test_normal_data_import(self, import_service):
        row = create_test_row()
        df = pd.DataFrame([row])
        result = import_service.import_from_dataframe(df)
        
        assert result.success_count == 1
        assert result.fail_count == 0
        assert result.warning_count == 0
        assert len(result.bad_rows) == 0
        assert len(result.imported_claims) == 1
        assert result.imported_claims[0].claim_id == "TEST-001"
    
    def test_duplicate_claim_id(self, import_service):
        row1 = create_test_row()
        row2 = create_test_row(货物名称="测试药品B", 货物数量=200)
        df = pd.DataFrame([row1, row2])
        result = import_service.import_from_dataframe(df)
        
        assert result.success_count == 2
        assert result.warning_count == 1
        assert len(result.warning_rows) == 1
        assert "已存在，将覆盖原有数据" in result.warning_rows[0].error_reason
        assert result.warning_rows[0].row_index == 3
    
    def test_status_transition_violation(self, import_service):
        row1 = create_test_row()
        df1 = pd.DataFrame([row1])
        import_service.import_from_dataframe(df1)
        
        row2 = create_test_row(状态="已完成")
        df2 = pd.DataFrame([row2])
        result = import_service.import_from_dataframe(df2)
        
        assert result.success_count == 0
        assert result.fail_count == 1
        assert len(result.bad_rows) == 1
        assert "状态不允许从" in result.bad_rows[0].error_reason
        assert "直接变更为" in result.bad_rows[0].error_reason
    
    def test_missing_required_fields(self, import_service):
        row = create_test_row()
        del row["索赔金额"]
        df = pd.DataFrame([row])
        result = import_service.import_from_dataframe(df)
        
        assert result.success_count == 0
        assert result.fail_count == 1
        assert len(result.bad_rows) == 1
        assert "缺少必填字段" in result.bad_rows[0].error_reason
        assert "索赔金额" in result.bad_rows[0].error_reason
        assert result.bad_rows[0].original_data is not None
    
    def test_probe_missing_segment_warning(self, import_service):
        row = create_test_row(
            索赔单号="TEST-002",
            探头状态="缺段",
            状态="审核中"
        )
        df = pd.DataFrame([row])
        result = import_service.import_from_dataframe(df)
        
        assert result.success_count == 1
        assert result.warning_count == 1
        assert len(result.warning_rows) == 1
        assert "温度探头数据缺段" in result.warning_rows[0].error_reason
        assert "建议添加人工备注" in result.warning_rows[0].suggestion
    
    def test_data_format_error(self, import_service):
        row = create_test_row(货物数量="五百", 索赔单号="TEST-003")
        df = pd.DataFrame([row])
        result = import_service.import_from_dataframe(df)
        
        assert result.success_count == 0
        assert result.fail_count == 1
        assert len(result.bad_rows) == 1
        assert "数据格式错误" in result.bad_rows[0].error_reason
    
    def test_handle_probe_missing_segment_success(self, import_service):
        row = create_test_row(
            索赔单号="TEST-004",
            探头状态="缺段",
            状态="审核中"
        )
        df = pd.DataFrame([row])
        import_service.import_from_dataframe(df)
        
        success, message = import_service.handle_probe_missing_segment(
            "TEST-004",
            "经核实，探头数据因网络中断缺失，已确认货物未受影响",
            "张主管"
        )
        
        assert success == True
        assert "人工备注已添加" in message
        claim = import_service.existing_claims["TEST-004"]
        assert claim.manual_remark == "经核实，探头数据因网络中断缺失，已确认货物未受影响"
    
    def test_handle_probe_missing_segment_claim_not_exist(self, import_service):
        success, message = import_service.handle_probe_missing_segment(
            "NON-EXIST",
            "测试备注",
            "测试员"
        )
        
        assert success == False
        assert "索赔单不存在" in message
    
    def test_handle_probe_missing_segment_no_problem(self, import_service):
        row = create_test_row(
            索赔单号="TEST-005",
            探头状态="正常"
        )
        df = pd.DataFrame([row])
        import_service.import_from_dataframe(df)
        
        success, message = import_service.handle_probe_missing_segment(
            "TEST-005",
            "测试备注",
            "测试员"
        )
        
        assert success == False
        assert "不存在探头缺段问题" in message
    
    def test_invalid_probe_status(self, import_service):
        row = create_test_row(
            索赔单号="TEST-006",
            探头状态="无效状态"
        )
        df = pd.DataFrame([row])
        result = import_service.import_from_dataframe(df)
        
        assert result.success_count == 0
        assert result.fail_count == 1
        assert "无效的探头状态" in result.bad_rows[0].error_reason
    
    def test_invalid_claim_status(self, import_service):
        row = create_test_row(
            索赔单号="TEST-007",
            状态="无效状态"
        )
        df = pd.DataFrame([row])
        result = import_service.import_from_dataframe(df)
        
        assert result.success_count == 0
        assert result.fail_count == 1
        assert "无效的索赔状态" in result.bad_rows[0].error_reason
    
    def test_bad_row_contains_original_data(self, import_service):
        row = create_test_row()
        del row["索赔单号"]
        df = pd.DataFrame([row])
        result = import_service.import_from_dataframe(df)
        
        assert len(result.bad_rows) == 1
        bad_row = result.bad_rows[0]
        assert bad_row.original_data is not None
        assert "货物名称" in bad_row.original_data
        assert bad_row.original_data["货物名称"] == "测试药品"
    
    def test_supplement_count_tracking(self, import_service):
        row = create_test_row(
            索赔单号="TEST-008",
            状态="已补录",
            补录次数=2
        )
        df = pd.DataFrame([row])
        result = import_service.import_from_dataframe(df)
        
        assert result.success_count == 1
        claim = result.imported_claims[0]
        assert claim.supplement_count == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
