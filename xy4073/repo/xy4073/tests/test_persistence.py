import unittest
import tempfile
import os
import json

from models.piece import Piece, PiecePlacement
from models.fabric import FabricSettings, NoPlaceZone
from models.project import Project
from geometry.point import Point
from persistence.manager import ProjectManager, save_project, load_project


class TestProjectManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.manager = ProjectManager()

    def tearDown(self):
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_save_and_load_project(self):
        project = Project()
        project.name = "测试项目"
        project.notes = "测试描述"
        project.fabric_settings.width = 120.0
        project.fabric_settings.safety_margin = 5.0
        
        p1 = Piece()
        p1.id = "p1"
        p1.name = "前片"
        p1.points = [
            Point(0, 0), Point(20, 0), Point(20, 30), Point(0, 30)
        ]
        p1.quantity = 2
        p1.area = 600.0
        
        project.pieces = [p1]
        
        placement = PiecePlacement(piece=p1, position=Point(10, 5), rotation=0, is_placed=True)
        project.placements = [placement]
        
        file_path = os.path.join(self.temp_dir, "test_project.json")
        
        result = self.manager.save_project(file_path, project)
        self.assertTrue(result)
        
        loaded_project = self.manager.load_project(file_path)
        
        self.assertIsNotNone(loaded_project)
        self.assertEqual(loaded_project.name, "测试项目")
        self.assertEqual(loaded_project.notes, "测试描述")
        self.assertEqual(loaded_project.fabric_settings.width, 120.0)
        self.assertEqual(loaded_project.fabric_settings.safety_margin, 5.0)
        self.assertEqual(len(loaded_project.pieces), 1)
        self.assertEqual(loaded_project.pieces[0].name, "前片")
        self.assertEqual(loaded_project.pieces[0].quantity, 2)

    def test_export_import_project(self):
        project = Project()
        project.name = "导出测试项目"
        project.fabric_settings.width = 150.0
        
        p = Piece()
        p.id = "p1"
        p.name = "裁片"
        p.points = [
            Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)
        ]
        p.area = 100.0
        p.quantity = 1
        
        project.pieces = [p]
        
        file_path = os.path.join(self.temp_dir, "export_project.json")
        
        self.manager.export_pieces_json(file_path, project)
        
        self.manager.current_project = Project(name="新项目")
        imported_count = self.manager.import_pieces_json(file_path)
        
        self.assertEqual(imported_count, 1)
        self.assertEqual(len(self.manager.current_project.pieces), 1)
        self.assertEqual(self.manager.current_project.pieces[0].name, "裁片")

    def test_save_nested_zones(self):
        project = Project()
        project.name = "禁放区测试"
        
        zone1 = NoPlaceZone()
        zone1.name = "接缝区1"
        zone1.points = [
            Point(0, 0), Point(10, 0), Point(10, 20), Point(0, 20)
        ]
        
        zone2 = NoPlaceZone()
        zone2.name = "接缝区2"
        zone2.points = [
            Point(50, 0), Point(60, 0), Point(60, 20), Point(50, 20)
        ]
        
        project.fabric_settings.no_place_zones = [zone1, zone2]
        
        file_path = os.path.join(self.temp_dir, "zones_project.json")
        
        self.manager.save_project(file_path, project)
        
        loaded = self.manager.load_project(file_path)
        
        self.assertIsNotNone(loaded)
        self.assertEqual(len(loaded.fabric_settings.no_place_zones), 2)
        self.assertEqual(loaded.fabric_settings.no_place_zones[0].name, "接缝区1")
        self.assertEqual(loaded.fabric_settings.no_place_zones[1].name, "接缝区2")

    def test_invalid_file_load(self):
        invalid_path = os.path.join(self.temp_dir, "nonexistent.json")
        
        loaded = self.manager.load_project(invalid_path)
        self.assertIsNone(loaded)

    def test_new_project(self):
        project = self.manager.new_project("测试新项目")
        
        self.assertIsNotNone(project)
        self.assertEqual(project.name, "测试新项目")
        self.assertEqual(self.manager.current_project, project)

    def test_free_function_save_load(self):
        project = Project()
        project.name = "自由函数测试"
        
        file_path = os.path.join(self.temp_dir, "free_func_test.json")
        
        result = save_project(project, file_path)
        self.assertTrue(result)
        
        loaded = load_project(file_path)
        
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.name, "自由函数测试")


if __name__ == '__main__':
    unittest.main()
