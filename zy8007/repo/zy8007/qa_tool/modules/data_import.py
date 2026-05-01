"""数据导入模块"""

import csv
import json
import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field


@dataclass
class QAEntry:
    """Q&A条目"""
    question: str
    answer: str
    source: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    id: Optional[str] = None


@dataclass
class ProductParam:
    """产品参数条目"""
    product_name: str
    param_name: str
    param_value: str
    version: str = ""
    source: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CustomerQuestion:
    """客户问题"""
    question: str
    context: str = ""
    id: Optional[str] = None


class DataImporter:
    """数据导入器"""

    def __init__(self):
        self.qa_entries: List[QAEntry] = []
        self.product_params: List[ProductParam] = []
        self.customer_questions: List[CustomerQuestion] = []

    def load_qa_csv(self, file_path: str, source_name: str = "") -> int:
        """从CSV加载历史Q&A
        
        期望格式: question, answer, [id], [metadata...]
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Q&A文件不存在: {file_path}")

        source = source_name or os.path.basename(file_path)
        count = 0

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                question = row.get('question', '').strip()
                answer = row.get('answer', '').strip()
                
                if not question:
                    continue
                
                entry = QAEntry(
                    question=question,
                    answer=answer,
                    source=source,
                    id=row.get('id'),
                    metadata={k: v for k, v in row.items() 
                             if k not in ['question', 'answer', 'id']}
                )
                self.qa_entries.append(entry)
                count += 1

        return count

    def load_qa_json(self, file_path: str, source_name: str = "") -> int:
        """从JSON加载历史Q&A
        
        期望格式: [{"question": "...", "answer": "...", ...}, ...]
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Q&A文件不存在: {file_path}")

        source = source_name or os.path.basename(file_path)
        count = 0

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict):
                data = [data]
            
            for item in data:
                question = item.get('question', '').strip()
                answer = item.get('answer', '').strip()
                
                if not question:
                    continue
                
                entry = QAEntry(
                    question=question,
                    answer=answer,
                    source=source,
                    id=item.get('id'),
                    metadata={k: v for k, v in item.items() 
                             if k not in ['question', 'answer', 'id']}
                )
                self.qa_entries.append(entry)
                count += 1

        return count

    def load_product_params_csv(self, file_path: str, source_name: str = "") -> int:
        """从CSV加载产品参数
        
        期望格式: product_name, param_name, param_value, [version], [metadata...]
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"产品参数文件不存在: {file_path}")

        source = source_name or os.path.basename(file_path)
        count = 0

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                product_name = row.get('product_name', '').strip()
                param_name = row.get('param_name', '').strip()
                param_value = row.get('param_value', '').strip()
                
                if not param_name:
                    continue
                
                param = ProductParam(
                    product_name=product_name,
                    param_name=param_name,
                    param_value=param_value,
                    version=row.get('version', ''),
                    source=source,
                    metadata={k: v for k, v in row.items() 
                             if k not in ['product_name', 'param_name', 'param_value', 'version']}
                )
                self.product_params.append(param)
                count += 1

        return count

    def load_customer_questions_txt(self, file_path: str) -> int:
        """从TXT加载客户问题
        
        每行一个问题，空行分隔不同问题块
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"客户问题文件不存在: {file_path}")

        count = 0
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        current_question = []
        for line in lines:
            stripped = line.strip()
            if stripped:
                current_question.append(stripped)
            elif current_question:
                question = '\n'.join(current_question)
                self.customer_questions.append(
                    CustomerQuestion(question=question)
                )
                current_question = []
                count += 1
        
        if current_question:
            question = '\n'.join(current_question)
            self.customer_questions.append(
                CustomerQuestion(question=question)
            )
            count += 1

        return count

    def load_customer_questions_csv(self, file_path: str) -> int:
        """从CSV加载客户问题
        
        期望格式: question, [context], [id]
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"客户问题文件不存在: {file_path}")

        count = 0
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                question = row.get('question', '').strip()
                if not question:
                    continue
                
                self.customer_questions.append(
                    CustomerQuestion(
                        question=question,
                        context=row.get('context', ''),
                        id=row.get('id')
                    )
                )
                count += 1

        return count

    def get_all_qa(self) -> List[QAEntry]:
        """获取所有Q&A条目"""
        return self.qa_entries

    def get_all_params(self) -> List[ProductParam]:
        """获取所有产品参数"""
        return self.product_params

    def get_all_questions(self) -> List[CustomerQuestion]:
        """获取所有客户问题"""
        return self.customer_questions

    def clear(self):
        """清空所有已加载数据"""
        self.qa_entries.clear()
        self.product_params.clear()
        self.customer_questions.clear()
