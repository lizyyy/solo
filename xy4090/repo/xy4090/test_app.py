import pytest
import tempfile
import shutil
import json
import csv
from datetime import datetime, time, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

from models import (
    ConferenceProject, Term, AgendaItem, Mark, MarkType,
    ValidationError, ImportResult
)
from importer import TermImporter, AgendaImporter, SpeakerImporter
from timeline import TimelineScheduler, FlashCardManager, Reminder, ReminderType
from storage import StorageManager, QuickSaveManager
from exporter import MarkdownExporter, CSVExporter, JSONExporter, ExportManager


class TestModels:
    def test_term_creation(self):
        term = Term(
            id="test-id",
            chinese="人工智能",
            english="Artificial Intelligence",
            category="技术术语",
            notes="常见缩写: AI",
            difficulty=3
        )
        
        assert term.id == "test-id"
        assert term.chinese == "人工智能"
        assert term.english == "Artificial Intelligence"
        assert term.category == "技术术语"
        assert term.notes == "常见缩写: AI"
        assert term.difficulty == 3
    
    def test_term_to_dict(self):
        term = Term(
            id="test-id",
            chinese="机器学习",
            english="Machine Learning",
            category="技术术语",
            difficulty=2
        )
        
        data = term.to_dict()
        
        assert data["id"] == "test-id"
        assert data["chinese"] == "机器学习"
        assert data["english"] == "Machine Learning"
        assert data["category"] == "技术术语"
        assert data["difficulty"] == 2
    
    def test_term_from_dict(self):
        data = {
            "id": "test-id",
            "chinese": "深度学习",
            "english": "Deep Learning",
            "category": "技术术语",
            "notes": "",
            "difficulty": 4
        }
        
        term = Term.from_dict(data)
        
        assert term.id == "test-id"
        assert term.chinese == "深度学习"
        assert term.english == "Deep Learning"
        assert term.difficulty == 4
    
    def test_agenda_item_creation(self):
        item = AgendaItem(
            id="agenda-1",
            start_time=time(9, 0, 0),
            end_time=time(10, 30, 0),
            title="开幕致辞",
            speaker="张教授",
            topic="会议开场",
            related_terms=["term-1", "term-2"],
            notes="重要嘉宾"
        )
        
        assert item.id == "agenda-1"
        assert item.start_time == time(9, 0, 0)
        assert item.end_time == time(10, 30, 0)
        assert item.title == "开幕致辞"
        assert item.speaker == "张教授"
    
    def test_agenda_item_time_parsing(self):
        data = {
            "id": "agenda-1",
            "start_time": "14:30:00",
            "end_time": "15:45:00",
            "title": "主题演讲"
        }
        
        item = AgendaItem.from_dict(data)
        
        assert item.start_time == time(14, 30, 0)
        assert item.end_time == time(15, 45, 0)
    
    def test_agenda_item_short_time_format(self):
        data = {
            "id": "agenda-1",
            "start_time": "9:00",
            "end_time": "10:00",
            "title": "测试"
        }
        
        item = AgendaItem.from_dict(data)
        
        assert item.start_time == time(9, 0, 0)
        assert item.end_time == time(10, 0, 0)
    
    def test_mark_creation(self):
        now = datetime.now()
        mark = Mark(
            id="mark-1",
            mark_type=MarkType.STUCK,
            timestamp=now,
            term_id="term-1",
            term_text="复杂术语",
            agenda_item_id="agenda-1",
            agenda_item_title="主题演讲",
            speaker="李教授",
            notes="当时突然卡壳",
            correction=""
        )
        
        assert mark.id == "mark-1"
        assert mark.mark_type == MarkType.STUCK
        assert mark.timestamp == now
        assert mark.term_text == "复杂术语"
        assert mark.speaker == "李教授"
    
    def test_mark_type_values(self):
        assert MarkType.STUCK.value == "stuck"
        assert MarkType.MISTRANSLATION.value == "mistranslation"
        assert MarkType.CONFIRMED.value == "confirmed"
    
    def test_mark_to_dict(self):
        now = datetime.now()
        mark = Mark(
            id="mark-1",
            mark_type=MarkType.MISTRANSLATION,
            timestamp=now,
            term_text="测试术语",
            correction="正确译法",
            speaker="王教授"
        )
        
        data = mark.to_dict()
        
        assert data["id"] == "mark-1"
        assert data["mark_type"] == "mistranslation"
        assert data["term_text"] == "测试术语"
        assert data["correction"] == "正确译法"
        assert data["speaker"] == "王教授"
    
    def test_mark_from_dict(self):
        now = datetime.now()
        data = {
            "id": "mark-2",
            "mark_type": "confirmed",
            "timestamp": now.isoformat(),
            "term_text": "已确认术语",
            "speaker": "赵教授"
        }
        
        mark = Mark.from_dict(data)
        
        assert mark.id == "mark-2"
        assert mark.mark_type == MarkType.CONFIRMED
        assert mark.term_text == "已确认术语"
    
    def test_conference_project_creation(self):
        now = datetime.now()
        project = ConferenceProject(
            id="project-1",
            name="2024科技峰会",
            created_at=now,
            updated_at=now,
            terms=[],
            agenda=[],
            marks=[],
            speakers=["张教授", "李教授"],
            topics=["人工智能", "机器学习"]
        )
        
        assert project.id == "project-1"
        assert project.name == "2024科技峰会"
        assert len(project.terms) == 0
    
    def test_project_add_mark(self):
        now = datetime.now()
        project = ConferenceProject(
            id="project-1",
            name="测试项目",
            created_at=now,
            updated_at=now,
            terms=[],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
        
        mark = Mark(
            id="mark-1",
            mark_type=MarkType.STUCK,
            timestamp=now,
            term_text="测试"
        )
        
        project.add_mark(mark)
        
        assert len(project.marks) == 1
        assert project.marks[0].id == "mark-1"
    
    def test_project_get_marks_by_type(self):
        now = datetime.now()
        project = ConferenceProject(
            id="project-1",
            name="测试项目",
            created_at=now,
            updated_at=now,
            terms=[],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
        
        mark1 = Mark(id="1", mark_type=MarkType.STUCK, timestamp=now)
        mark2 = Mark(id="2", mark_type=MarkType.STUCK, timestamp=now)
        mark3 = Mark(id="3", mark_type=MarkType.MISTRANSLATION, timestamp=now)
        
        project.add_mark(mark1)
        project.add_mark(mark2)
        project.add_mark(mark3)
        
        stuck_marks = project.get_marks_by_type(MarkType.STUCK)
        assert len(stuck_marks) == 2
        
        mistranslation_marks = project.get_marks_by_type(MarkType.MISTRANSLATION)
        assert len(mistranslation_marks) == 1
    
    def test_project_get_current_agenda_item(self):
        now = datetime.now()
        project = ConferenceProject(
            id="project-1",
            name="测试项目",
            created_at=now,
            updated_at=now,
            terms=[],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
        
        item1 = AgendaItem(
            id="1",
            start_time=time(9, 0, 0),
            end_time=time(10, 0, 0),
            title="第一项"
        )
        item2 = AgendaItem(
            id="2",
            start_time=time(10, 0, 0),
            end_time=time(11, 0, 0),
            title="第二项"
        )
        
        project.agenda = [item1, item2]
        
        current = project.get_current_agenda_item(time(9, 30, 0))
        assert current is not None
        assert current.id == "1"
        
        current = project.get_current_agenda_item(time(10, 30, 0))
        assert current is not None
        assert current.id == "2"
    
    def test_project_to_dict(self):
        now = datetime.now()
        project = ConferenceProject(
            id="project-1",
            name="测试项目",
            created_at=now,
            updated_at=now,
            terms=[Term(id="t1", chinese="中文", english="English")],
            agenda=[AgendaItem(id="a1", start_time=time(9, 0), end_time=time(10, 0), title="议程")],
            marks=[],
            speakers=["嘉宾"],
            topics=["主题"]
        )
        
        data = project.to_dict()
        
        assert data["id"] == "project-1"
        assert data["name"] == "测试项目"
        assert len(data["terms"]) == 1
        assert len(data["agenda"]) == 1
        assert len(data["speakers"]) == 1
    
    def test_project_from_dict(self):
        now = datetime.now()
        data = {
            "id": "project-2",
            "name": "加载的项目",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "terms": [{"id": "t1", "chinese": "测试", "english": "Test"}],
            "agenda": [{"id": "a1", "start_time": "09:00:00", "end_time": "10:00:00", "title": "议程"}],
            "marks": [],
            "speakers": ["嘉宾A"],
            "topics": ["主题A"]
        }
        
        project = ConferenceProject.from_dict(data)
        
        assert project.id == "project-2"
        assert project.name == "加载的项目"
        assert len(project.terms) == 1
        assert len(project.agenda) == 1


class TestTermImporter:
    @pytest.fixture
    def temp_csv_file(self):
        def create_csv(content):
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
            temp_file.write(content)
            temp_file.close()
            return temp_file.name
        
        yield create_csv
        
        import os
        for f in Path(tempfile.gettempdir()).glob('*.csv'):
            try:
                os.unlink(str(f))
            except:
                pass
    
    def test_import_valid_terms(self, temp_csv_file):
        content = """chinese,english,category,difficulty
人工智能,Artificial Intelligence,技术术语,3
机器学习,Machine Learning,技术术语,2
深度学习,Deep Learning,技术术语,4
"""
        file_path = temp_csv_file(content)
        result = TermImporter.import_from_csv(file_path)
        
        assert result.success is True
        assert result.count == 3
        assert len(result.errors) == 0
        
        assert result.data[0].chinese == "人工智能"
        assert result.data[0].english == "Artificial Intelligence"
        assert result.data[0].category == "技术术语"
        assert result.data[0].difficulty == 3
    
    def test_import_missing_columns(self, temp_csv_file):
        content = """chinese,category
人工智能,技术术语
"""
        file_path = temp_csv_file(content)
        result = TermImporter.import_from_csv(file_path)
        
        assert result.success is False
        assert len(result.errors) > 0
    
    def test_import_empty_row(self, temp_csv_file):
        content = """chinese,english
,
人工智能,Artificial Intelligence
"""
        file_path = temp_csv_file(content)
        result = TermImporter.import_from_csv(file_path)
        
        assert result.count == 1
    
    def test_import_chinese_english_detection(self, temp_csv_file):
        content = """chinese,english
Artificial Intelligence,人工智能
"""
        file_path = temp_csv_file(content)
        result = TermImporter.import_from_csv(file_path)
        
        assert len(result.warnings) > 0


class TestAgendaImporter:
    @pytest.fixture
    def temp_text_file(self):
        def create_text(content):
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8')
            temp_file.write(content)
            temp_file.close()
            return temp_file.name
        
        yield create_text
    
    def test_import_valid_agenda(self, temp_text_file):
        content = """9:00 - 10:00 开幕致辞
嘉宾: 张教授
主题: 会议开场

10:00 - 11:30 主题演讲
嘉宾: 李教授
主题: 人工智能发展趋势

14:00 - 15:00 圆桌讨论
嘉宾: 多位嘉宾
"""
        file_path = temp_text_file(content)
        result = AgendaImporter.import_from_text(file_path)
        
        assert result.count >= 1
        
        if result.data:
            assert result.data[0].start_time == time(9, 0, 0)
            assert result.data[0].end_time == time(10, 0, 0)
    
    def test_import_time_format_variations(self, temp_text_file):
        content = """09:00:00 - 10:30:00 第一项
9:00 - 10:00 第二项
"""
        file_path = temp_text_file(content)
        result = AgendaImporter.import_from_text(file_path)
        
        assert result.count >= 1


class TestStorageManager:
    @pytest.fixture
    def temp_storage_dir(self):
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir, ignore_errors=True)
    
    def test_save_and_load_project(self, temp_storage_dir):
        storage = StorageManager(temp_storage_dir)
        
        now = datetime.now()
        project = ConferenceProject(
            id="test-project",
            name="测试存储项目",
            created_at=now,
            updated_at=now,
            terms=[Term(id="t1", chinese="测试", english="Test")],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
        
        assert storage.save_project(project) is True
        
        loaded = storage.load_project("test-project")
        
        assert loaded is not None
        assert loaded.id == "test-project"
        assert loaded.name == "测试存储项目"
        assert len(loaded.terms) == 1
    
    def test_list_projects(self, temp_storage_dir):
        storage = StorageManager(temp_storage_dir)
        
        now = datetime.now()
        project1 = ConferenceProject(
            id="p1",
            name="项目1",
            created_at=now,
            updated_at=now,
            terms=[],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
        project2 = ConferenceProject(
            id="p2",
            name="项目2",
            created_at=now,
            updated_at=now,
            terms=[],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
        
        storage.save_project(project1)
        storage.save_project(project2)
        
        projects = storage.list_projects()
        
        assert len(projects) >= 2
    
    def test_delete_project(self, temp_storage_dir):
        storage = StorageManager(temp_storage_dir)
        
        now = datetime.now()
        project = ConferenceProject(
            id="to-delete",
            name="待删除项目",
            created_at=now,
            updated_at=now,
            terms=[],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
        
        storage.save_project(project)
        assert storage.load_project("to-delete") is not None
        
        assert storage.delete_project("to-delete") is True
        
        loaded = storage.load_project("to-delete")
        assert loaded is None


class TestExporter:
    @pytest.fixture
    def sample_project(self):
        now = datetime.now()
        
        terms = [
            Term(id="t1", chinese="人工智能", english="Artificial Intelligence", category="技术", difficulty=3),
            Term(id="t2", chinese="机器学习", english="Machine Learning", category="技术", difficulty=2)
        ]
        
        agenda = [
            AgendaItem(id="a1", start_time=time(9, 0), end_time=time(10, 0), title="开幕", speaker="张教授"),
            AgendaItem(id="a2", start_time=time(10, 0), end_time=time(11, 0), title="主题演讲", speaker="李教授")
        ]
        
        marks = [
            Mark(id="m1", mark_type=MarkType.STUCK, timestamp=now, term_text="人工智能", speaker="张教授", agenda_item_title="开幕"),
            Mark(id="m2", mark_type=MarkType.MISTRANSLATION, timestamp=now, term_text="机器学习", speaker="李教授", agenda_item_title="主题演讲", correction="正确译法"),
            Mark(id="m3", mark_type=MarkType.CONFIRMED, timestamp=now, term_text="深度学习", speaker="张教授")
        ]
        
        return ConferenceProject(
            id="export-test",
            name="导出测试项目",
            created_at=now,
            updated_at=now,
            terms=terms,
            agenda=agenda,
            marks=marks,
            speakers=["张教授", "李教授"],
            topics=["开幕", "主题演讲"]
        )
    
    def test_markdown_exporter(self, sample_project):
        exporter = MarkdownExporter(sample_project)
        content = exporter.export()
        
        assert "导出测试项目" in content
        assert "人工智能" in content
        assert "机器学习" in content
        assert "卡词次数: 1" in content
        assert "误译次数: 1" in content
    
    def test_csv_exporter_error_terms(self, sample_project):
        exporter = CSVExporter(sample_project)
        rows = exporter.export_error_terms()
        
        assert len(rows) == 2
        
        terms = [r["term_text"] for r in rows]
        assert "人工智能" in terms
        assert "机器学习" in terms
    
    def test_csv_exporter_all_terms(self, sample_project):
        exporter = CSVExporter(sample_project)
        rows = exporter.export_terms()
        
        assert len(rows) == 2
    
    def test_json_exporter(self, sample_project):
        exporter = JSONExporter(sample_project)
        package = exporter.export_audit_package()
        
        assert package["version"] == "1.0"
        assert "project" in package
        assert "marks" in package
        assert "statistics" in package
        
        stats = package["statistics"]
        assert stats["stuck_count"] == 1
        assert stats["mistranslation_count"] == 1
        assert stats["confirmed_count"] == 1
    
    def test_export_manager(self, sample_project, temp_storage_dir):
        exporter = ExportManager(sample_project)
        
        md_path = Path(temp_storage_dir) / "test.md"
        assert exporter.export_markdown(str(md_path)) is True
        assert md_path.exists()
        
        csv_path = Path(temp_storage_dir) / "test.csv"
        assert exporter.export_error_terms_csv(str(csv_path)) is True
        assert csv_path.exists()
        
        json_path = Path(temp_storage_dir) / "test.json"
        assert exporter.export_audit_json(str(json_path)) is True
        assert json_path.exists()


class TestTimelineScheduler:
    @pytest.fixture
    def sample_project(self):
        now = datetime.now()
        return ConferenceProject(
            id="scheduler-test",
            name="调度测试项目",
            created_at=now,
            updated_at=now,
            terms=[Term(id="t1", chinese="测试", english="Test")],
            agenda=[
                AgendaItem(id="a1", start_time=time(9, 0), end_time=time(10, 0), title="议程1"),
                AgendaItem(id="a2", start_time=time(10, 0), end_time=time(11, 0), title="议程2")
            ],
            marks=[],
            speakers=[],
            topics=[]
        )
    
    def test_scheduler_creation(self, sample_project):
        scheduler = TimelineScheduler(sample_project)
        
        assert scheduler.project == sample_project
        assert len(scheduler.reminders) > 0
    
    def test_scheduler_reminders_generation(self, sample_project):
        scheduler = TimelineScheduler(sample_project)
        
        start_reminders = [r for r in scheduler.reminders if r.reminder_type == ReminderType.AGENDA_START]
        end_reminders = [r for r in scheduler.reminders if r.reminder_type == ReminderType.AGENDA_END]
        
        assert len(start_reminders) == 2
        assert len(end_reminders) == 2
    
    def test_get_current_agenda_item(self, sample_project):
        scheduler = TimelineScheduler(sample_project)
        
        scheduler._current_agenda_item = sample_project.agenda[0]
        current = scheduler.get_current_agenda_item()
        
        assert current is not None
        assert current.title == "议程1"
    
    def test_get_next_agenda_item(self, sample_project):
        scheduler = TimelineScheduler(sample_project)
        scheduler._current_agenda_item = sample_project.agenda[0]
        
        next_item = scheduler.get_next_agenda_item()
        
        assert next_item is not None
        assert next_item.title == "议程2"
    
    def test_agenda_progress(self, sample_project):
        scheduler = TimelineScheduler(sample_project)
        
        progress = scheduler.get_agenda_progress()
        
        assert progress["total_items"] == 2


class TestFlashCardManager:
    @pytest.fixture
    def sample_project(self):
        now = datetime.now()
        return ConferenceProject(
            id="flashcard-test",
            name="闪卡测试项目",
            created_at=now,
            updated_at=now,
            terms=[
                Term(id="t1", chinese="术语1", english="Term1"),
                Term(id="t2", chinese="术语2", english="Term2"),
                Term(id="t3", chinese="术语3", english="Term3")
            ],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
    
    def test_flashcard_creation(self, sample_project):
        manager = FlashCardManager(sample_project)
        
        term = manager.get_current_term()
        assert term is not None
        assert term.chinese == "术语1"
    
    def test_next_card(self, sample_project):
        manager = FlashCardManager(sample_project)
        
        term1 = manager.get_current_term()
        term2 = manager.next_card()
        
        assert term2 is not None
        assert term2.chinese == "术语2"
    
    def test_previous_card(self, sample_project):
        manager = FlashCardManager(sample_project)
        
        manager.next_card()
        term2 = manager.get_current_term()
        
        term1 = manager.previous_card()
        
        assert term1.chinese == "术语1"
    
    def test_search_terms(self, sample_project):
        manager = FlashCardManager(sample_project)
        
        results = manager.search_terms("术语")
        assert len(results) == 3
        
        results = manager.search_terms("Term1")
        assert len(results) == 1
    
    def test_card_progress(self, sample_project):
        manager = FlashCardManager(sample_project)
        
        progress = manager.get_card_progress()
        
        assert progress["total"] == 3
        assert progress["current"] == 1


class TestQuickSaveManager:
    @pytest.fixture
    def temp_storage_dir(self):
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir, ignore_errors=True)
    
    def test_quicksave_mark_dirty(self, temp_storage_dir):
        storage = StorageManager(temp_storage_dir)
        quicksave = QuickSaveManager(storage)
        
        now = datetime.now()
        project = ConferenceProject(
            id="qs-test",
            name="快速保存测试",
            created_at=now,
            updated_at=now,
            terms=[],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
        
        storage.save_project(project)
        
        project.terms.append(Term(id="t1", chinese="新术语", english="New Term"))
        quicksave.mark_dirty(project)
        
        assert quicksave._pending_project is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
