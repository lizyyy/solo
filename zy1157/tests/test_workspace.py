"""
Tests for Workspace Manager
"""

import os
import shutil
import tempfile
import unittest
from pathlib import Path

from jvm_tune_cli.workspace import WorkspaceManager


class TestWorkspaceManager(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.workspace_dir = os.path.join(self.temp_dir, ".jvm-tune")
    
    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_init_workspace(self):
        ws = WorkspaceManager(self.workspace_dir)
        
        self.assertFalse(ws.is_initialized())
        
        result = ws.init()
        
        self.assertTrue(result)
        self.assertTrue(ws.is_initialized())
        self.assertTrue(os.path.exists(self.workspace_dir))
        self.assertTrue(os.path.exists(os.path.join(self.workspace_dir, "sessions")))
        self.assertTrue(os.path.exists(os.path.join(self.workspace_dir, "data")))
        self.assertTrue(os.path.exists(os.path.join(self.workspace_dir, "reports")))
        self.assertTrue(os.path.exists(os.path.join(self.workspace_dir, "config")))
    
    def test_init_workspace_force(self):
        ws = WorkspaceManager(self.workspace_dir)
        ws.init()
        
        self.assertTrue(ws.is_initialized())
        
        result = ws.init(force=True)
        
        self.assertTrue(result)
        self.assertTrue(ws.is_initialized())
    
    def test_create_session(self):
        ws = WorkspaceManager(self.workspace_dir)
        ws.init()
        
        session_id = ws.create_session("test_session")
        
        self.assertEqual(session_id, "test_session")
        self.assertEqual(ws.get_current_session(), "test_session")
        
        session_dir = ws.get_session_dir()
        self.assertIsNotNone(session_dir)
        self.assertTrue(os.path.exists(session_dir))
        self.assertTrue(os.path.exists(os.path.join(session_dir, "imported")))
        self.assertTrue(os.path.exists(os.path.join(session_dir, "analysis")))
        self.assertTrue(os.path.exists(os.path.join(session_dir, "tuning")))
        self.assertTrue(os.path.exists(os.path.join(session_dir, "comparisons")))
    
    def test_create_session_without_name(self):
        ws = WorkspaceManager(self.workspace_dir)
        ws.init()
        
        session_id = ws.create_session()
        
        self.assertIsNotNone(session_id)
        self.assertTrue(session_id.startswith("session_"))
    
    def test_switch_session(self):
        ws = WorkspaceManager(self.workspace_dir)
        ws.init()
        
        ws.create_session("session1")
        ws.create_session("session2")
        
        self.assertEqual(ws.get_current_session(), "session2")
        
        result = ws.switch_session("session1")
        
        self.assertTrue(result)
        self.assertEqual(ws.get_current_session(), "session1")
    
    def test_switch_nonexistent_session(self):
        ws = WorkspaceManager(self.workspace_dir)
        ws.init()
        
        result = ws.switch_session("nonexistent")
        
        self.assertFalse(result)
    
    def test_list_sessions(self):
        ws = WorkspaceManager(self.workspace_dir)
        ws.init()
        
        ws.create_session("session1")
        ws.create_session("session2")
        
        sessions = ws.list_sessions()
        
        self.assertEqual(len(sessions), 2)
        session_ids = [s["id"] for s in sessions]
        self.assertIn("session1", session_ids)
        self.assertIn("session2", session_ids)
    
    def test_save_imported_file(self):
        ws = WorkspaceManager(self.workspace_dir)
        ws.init()
        ws.create_session("test")
        
        temp_file = os.path.join(self.temp_dir, "test_gc.log")
        with open(temp_file, 'w') as f:
            f.write("Test GC log content")
        
        saved_path = ws.save_imported_file("gc_log", temp_file)
        
        self.assertTrue(os.path.exists(saved_path))
        
        imported_files = ws.get_imported_files()
        self.assertEqual(len(imported_files), 1)
        self.assertEqual(imported_files[0]["type"], "gc_log")
        self.assertEqual(imported_files[0]["original_path"], temp_file)
    
    def test_get_workspace_info(self):
        ws = WorkspaceManager(self.workspace_dir)
        
        info = ws.get_workspace_info()
        self.assertFalse(info["initialized"])
        
        ws.init()
        ws.create_session("test_session")
        
        info = ws.get_workspace_info()
        
        self.assertTrue(info["initialized"])
        self.assertEqual(info["current_session"], "test_session")
        self.assertIsNotNone(info["current_session_info"])


if __name__ == "__main__":
    unittest.main()
