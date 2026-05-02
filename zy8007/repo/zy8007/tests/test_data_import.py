"""测试数据导入模块"""

import os
import tempfile
import csv
import json
import pytest

from qa_tool.modules.data_import import (
    DataImporter, QAEntry, ProductParam, CustomerQuestion
)


class TestDataImporter:
    """测试数据导入器"""
    
    def setup_method(self):
        """每个测试前设置"""
        self.importer = DataImporter()
        self.temp_dir = tempfile.mkdtemp()
    
    def test_load_qa_csv(self):
        """测试从CSV加载Q&A"""
        csv_path = os.path.join(self.temp_dir, "test_qa.csv")
        
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['question', 'answer', 'source', 'id'])
            writer.writerow(['问题1', '答案1', '测试来源', 'QA001'])
            writer.writerow(['问题2', '答案2', '测试来源', 'QA002'])
        
        count = self.importer.load_qa_csv(csv_path, source_name="测试")
        
        assert count == 2
        assert len(self.importer.get_all_qa()) == 2
        
        entries = self.importer.get_all_qa()
        assert entries[0].question == '问题1'
        assert entries[0].answer == '答案1'
        assert entries[0].source == '测试'
    
    def test_load_qa_json(self):
        """测试从JSON加载Q&A"""
        json_path = os.path.join(self.temp_dir, "test_qa.json")
        
        data = [
            {"question": "问题1", "answer": "答案1", "id": "QA001"},
            {"question": "问题2", "answer": "答案2", "id": "QA002"}
        ]
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        
        count = self.importer.load_qa_json(json_path)
        
        assert count == 2
        assert len(self.importer.get_all_qa()) == 2
    
    def test_load_product_params_csv(self):
        """测试从CSV加载产品参数"""
        csv_path = os.path.join(self.temp_dir, "test_params.csv")
        
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['product_name', 'param_name', 'param_value', 'version', 'source'])
            writer.writerow(['产品A', '参数1', '值1', 'V1.0', '测试'])
            writer.writerow(['产品A', '参数2', '值2', 'V1.0', '测试'])
        
        count = self.importer.load_product_params_csv(csv_path)
        
        assert count == 2
        assert len(self.importer.get_all_params()) == 2
        
        params = self.importer.get_all_params()
        assert params[0].product_name == '产品A'
        assert params[0].param_name == '参数1'
    
    def test_load_customer_questions_txt(self):
        """测试从TXT加载客户问题"""
        txt_path = os.path.join(self.temp_dir, "test_questions.txt")
        
        content = """问题1

问题2
多行问题第二行

问题3
"""
        
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        count = self.importer.load_customer_questions_txt(txt_path)
        
        assert count == 3
        assert len(self.importer.get_all_questions()) == 3
        
        questions = self.importer.get_all_questions()
        assert questions[0].question == '问题1'
        assert '问题2' in questions[1].question
        assert '第二行' in questions[1].question
    
    def test_load_customer_questions_csv(self):
        """测试从CSV加载客户问题"""
        csv_path = os.path.join(self.temp_dir, "test_questions.csv")
        
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['question', 'context', 'id'])
            writer.writerow(['问题1', '上下文1', 'Q001'])
            writer.writerow(['问题2', '上下文2', 'Q002'])
        
        count = self.importer.load_customer_questions_csv(csv_path)
        
        assert count == 2
        assert len(self.importer.get_all_questions()) == 2
    
    def test_file_not_found(self):
        """测试文件不存在的情况"""
        with pytest.raises(FileNotFoundError):
            self.importer.load_qa_csv("/nonexistent/file.csv")
    
    def test_clear(self):
        """测试清空数据"""
        entry = QAEntry(question="测试", answer="测试", source="测试")
        self.importer.qa_entries.append(entry)
        
        self.importer.clear()
        
        assert len(self.importer.get_all_qa()) == 0
        assert len(self.importer.get_all_params()) == 0
        assert len(self.importer.get_all_questions()) == 0
