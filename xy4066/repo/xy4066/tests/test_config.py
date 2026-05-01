import json
import tempfile
from pathlib import Path
from unittest import TestCase

from glossary_guardian.config.config import (
    ProjectConfig,
    get_config_path,
    get_data_dir,
    get_reports_dir,
    init_project,
    is_project_initialized,
    load_config,
    save_config,
)


class TestProjectConfig(TestCase):
    def test_default_init(self):
        config = ProjectConfig(project_name="test_project")
        self.assertEqual(config.project_name, "test_project")
        self.assertIsInstance(config.glossary_files, list)
        self.assertIsInstance(config.transcript_files, list)
        self.assertIsInstance(config.settings, dict)

    def test_to_dict(self):
        config = ProjectConfig(project_name="test_project")
        data = config.to_dict()
        self.assertEqual(data["project_name"], "test_project")
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)

    def test_from_dict(self):
        data = {
            "project_name": "test_project",
            "created_at": "2024-01-01T00:00:00",
            "updated_at": "2024-01-01T00:00:00",
            "glossary_files": ["terms.csv"],
            "transcript_files": ["transcript.srt"],
            "forbidden_terms_file": "forbidden.csv",
            "guest_list_file": "guests.csv",
            "settings": {"similarity_threshold": 0.9},
        }
        config = ProjectConfig.from_dict(data)
        self.assertEqual(config.project_name, "test_project")
        self.assertEqual(config.glossary_files, ["terms.csv"])
        self.assertEqual(config.forbidden_terms_file, "forbidden.csv")
        self.assertEqual(config.settings["similarity_threshold"], 0.9)

    def test_add_glossary_file(self):
        config = ProjectConfig(project_name="test")
        config.add_glossary_file("terms1.csv")
        config.add_glossary_file("terms1.csv")
        config.add_glossary_file("terms2.csv")
        self.assertEqual(len(config.glossary_files), 2)


class TestConfigFunctions(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.project_dir = Path(self.temp_dir) / "test_project"
        self.project_dir.mkdir()

    def test_get_paths(self):
        config_path = get_config_path(self.project_dir)
        self.assertEqual(
            config_path,
            self.project_dir / ".glossary-guardian" / "config.json",
        )

        data_dir = get_data_dir(self.project_dir)
        self.assertEqual(
            data_dir,
            self.project_dir / ".glossary-guardian" / "data",
        )

        reports_dir = get_reports_dir(self.project_dir)
        self.assertEqual(
            reports_dir,
            self.project_dir / ".glossary-guardian" / "reports",
        )

    def test_init_project(self):
        self.assertFalse(is_project_initialized(self.project_dir))

        config = init_project(self.project_dir, "Test Project")

        self.assertEqual(config.project_name, "Test Project")
        self.assertTrue(is_project_initialized(self.project_dir))
        self.assertTrue(get_config_path(self.project_dir).exists())
        self.assertTrue(get_data_dir(self.project_dir).exists())
        self.assertTrue(get_reports_dir(self.project_dir).exists())

    def test_init_already_initialized(self):
        init_project(self.project_dir, "Test Project")

        with self.assertRaises(FileExistsError):
            init_project(self.project_dir, "Another Project")

    def test_load_save_config(self):
        config = init_project(self.project_dir, "Test Project")

        config.add_glossary_file("terms.csv")
        config.add_transcript_file("transcript.srt")
        save_config(self.project_dir, config)

        loaded_config = load_config(self.project_dir)

        self.assertEqual(loaded_config.project_name, "Test Project")
        self.assertIn("terms.csv", loaded_config.glossary_files)
        self.assertIn("transcript.srt", loaded_config.transcript_files)

    def test_load_config_not_initialized(self):
        with self.assertRaises(FileNotFoundError):
            load_config(self.project_dir)

    def test_is_project_initialized(self):
        self.assertFalse(is_project_initialized(self.project_dir))
        init_project(self.project_dir, "Test")
        self.assertTrue(is_project_initialized(self.project_dir))
