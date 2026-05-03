"""状态存储模块测试"""

from pathlib import Path
import json

import pytest

from interview_sanitizer.storage import (
    StateManager,
    IssueStatus,
    IssueNote,
    NameOverride,
    SegmentExclusion,
    ProjectState,
)


class TestStateManager:
    """状态管理器测试"""
    
    def test_init_project(self, tmp_path: Path):
        """测试初始化项目"""
        state_manager = StateManager(tmp_path)
        
        assert state_manager.is_initialized() is False
        
        state = state_manager.init_project()
        
        assert state_manager.is_initialized() is True
        assert state.project_id.startswith("proj_")
        assert state.project_dir == str(tmp_path)
        
        assert state_manager.state_file.exists()
    
    def test_load_state(self, tmp_path: Path):
        """测试加载状态"""
        state_manager = StateManager(tmp_path)
        state_manager.init_project()
        
        loaded_state = state_manager.load_state()
        
        assert loaded_state.project_id.startswith("proj_")
        assert loaded_state.project_dir == str(tmp_path)
    
    def test_save_scan_results(self, tmp_path: Path):
        """测试保存扫描结果"""
        state_manager = StateManager(tmp_path)
        state_manager.init_project()
        
        scan_results = {
            "files_found": {"srt": True, "authorization": True},
            "issues_summary": {"姓名泄露": 2},
            "issues": [
                {
                    "type": "姓名泄露",
                    "description": "发现敏感姓名张三",
                    "severity": "high"
                }
            ]
        }
        
        state_manager.save_scan_results(scan_results)
        
        loaded_results = state_manager.get_scan_results()
        assert loaded_results == scan_results
    
    def test_update_issue_status(self, tmp_path: Path):
        """测试更新问题状态"""
        state_manager = StateManager(tmp_path)
        state_manager.init_project()
        
        note = state_manager.update_issue_status(
            issue_index=0,
            status=IssueStatus.RESOLVED,
            comment="已替换为张大爷"
        )
        
        assert note.issue_id == "0"
        assert note.status == IssueStatus.RESOLVED
        assert note.comment == "已替换为张大爷"
        
        loaded_note = state_manager.get_issue_status(0)
        assert loaded_note is not None
        assert loaded_note.status == IssueStatus.RESOLVED
    
    def test_add_name_override(self, tmp_path: Path):
        """测试添加姓名覆盖规则"""
        state_manager = StateManager(tmp_path)
        state_manager.init_project()
        
        override = state_manager.add_name_override(
            original_name="张三",
            pseudonym="张大爷",
            comment="主要受访者"
        )
        
        assert override.original_name == "张三"
        assert override.override_pseudonym == "张大爷"
        assert override.comment == "主要受访者"
        
        overrides = state_manager.get_name_overrides()
        assert "张三" in overrides
        assert overrides["张三"].override_pseudonym == "张大爷"
    
    def test_add_segment_exclusion(self, tmp_path: Path):
        """测试添加片段排除规则"""
        state_manager = StateManager(tmp_path)
        state_manager.init_project()
        
        exclusion = state_manager.add_segment_exclusion(
            segment_index=5,
            start_time="00:02:30",
            end_time="00:03:00",
            reason="未授权片段",
            excluded=True,
            comment="涉及敏感内容"
        )
        
        assert exclusion.segment_index == 5
        assert exclusion.start_time == "00:02:30"
        assert exclusion.end_time == "00:03:00"
        assert exclusion.reason == "未授权片段"
        assert exclusion.excluded is True
        
        exclusions = state_manager.get_segment_exclusions()
        assert 5 in exclusions
        assert exclusions[5].reason == "未授权片段"
    
    def test_record_export(self, tmp_path: Path):
        """测试记录导出历史"""
        state_manager = StateManager(tmp_path)
        state_manager.init_project()
        
        state_manager.record_export(
            export_type="srt",
            output_path="/output/sanitized.srt",
            metadata={"replacements_count": 5}
        )
        
        state = state_manager.load_state()
        assert len(state.export_history) == 1
        assert state.export_history[0]["export_type"] == "srt"
        assert state.export_history[0]["output_path"] == "/output/sanitized.srt"
        assert state.export_history[0]["metadata"]["replacements_count"] == 5
    
    def test_config_save_and_load(self, tmp_path: Path):
        """测试配置保存和加载"""
        state_manager = StateManager(tmp_path)
        
        config = {
            "default_pseudonym_prefix": "受访者",
            "auto_detect_phone": True,
            "auto_detect_id_card": True
        }
        
        state_manager.save_config(config)
        
        loaded_config = state_manager.get_config()
        assert loaded_config == config


class TestIssueStatus:
    """问题状态枚举测试"""
    
    def test_status_values(self):
        """测试状态值"""
        assert IssueStatus.OPEN.value == "待处理"
        assert IssueStatus.IN_PROGRESS.value == "处理中"
        assert IssueStatus.RESOLVED.value == "已解决"
        assert IssueStatus.WONT_FIX.value == "不处理"
        assert IssueStatus.NEEDS_REVIEW.value == "需复核"
