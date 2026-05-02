"""
基础测试模块
"""

import os
import tempfile
import shutil
from pathlib import Path
from unittest import TestCase

from content_deduplicator.reader import MaterialItem, FileReader, read_materials
from content_deduplicator.vectorizer import (
    TextProcessor,
    Vectorizer,
    SimilarityCalculator,
    extract_cluster_keywords,
    get_cluster_representative
)
from content_deduplicator.clusterer import (
    TopicClusterer,
    process_materials,
    ProcessingResult,
    TopicGroup,
    DuplicateCluster
)
from content_deduplicator.state_manager import (
    StateManager,
    MaterialStatus,
    MaterialStateRecord,
    StateStorage
)
from content_deduplicator.exporter import (
    JSONExporter,
    MarkdownExporter,
    export_all
)


class TestMaterialItem(TestCase):
    """
    测试 MaterialItem 数据结构
    """
    
    def test_basic_creation(self):
        """
        测试基本创建
        """
        item = MaterialItem(
            text="如何写出好的公众号标题",
            source_file="/test/file.txt",
            line_number=1
        )
        
        self.assertEqual(item.text, "如何写出好的公众号标题")
        self.assertEqual(item.source_file, "/test/file.txt")
        self.assertEqual(item.line_number, 1)
        self.assertTrue(item.id)
        self.assertTrue(item.clean_text)
    
    def test_clean_text(self):
        """
        测试文本清理
        """
        item = MaterialItem(
            text="## 如何写出 **好的** 公众号标题",
            source_file="/test/file.txt",
            line_number=1
        )
        
        self.assertNotIn("##", item.clean_text)
        self.assertNotIn("**", item.clean_text)
    
    def test_id_generation(self):
        """
        测试 ID 生成
        """
        item1 = MaterialItem(
            text="测试内容",
            source_file="/test/file.txt",
            line_number=1
        )
        
        item2 = MaterialItem(
            text="测试内容",
            source_file="/test/file.txt",
            line_number=1
        )
        
        self.assertEqual(item1.id, item2.id)
    
    def test_is_valid(self):
        """
        测试有效性判断
        """
        valid_item = MaterialItem(
            text="这是一段有效的测试内容",
            source_file="/test/file.txt",
            line_number=1
        )
        self.assertTrue(valid_item.is_valid())
        
        invalid_item = MaterialItem(
            text="短",
            source_file="/test/file.txt",
            line_number=1
        )
        self.assertFalse(invalid_item.is_valid(min_length=5))


class TestFileReader(TestCase):
    """
    测试文件读取器
    """
    
    def setUp(self):
        """
        测试前准备：创建临时目录和测试文件
        """
        self.test_dir = tempfile.mkdtemp()
        
        test_file1 = Path(self.test_dir) / "test1.txt"
        test_file1.write_text(
            "第一行测试内容\n"
            "第二行测试内容\n"
            "\n"
            "第四行测试内容\n",
            encoding="utf-8"
        )
        
        test_file2 = Path(self.test_dir) / "test2.md"
        test_file2.write_text(
            "# 标题\n"
            "这是 Markdown 内容\n"
            "## 子标题\n"
            "更多内容\n",
            encoding="utf-8"
        )
    
    def tearDown(self):
        """
        测试后清理
        """
        shutil.rmtree(self.test_dir)
    
    def test_list_files(self):
        """
        测试列出文件
        """
        reader = FileReader(self.test_dir)
        files = reader.list_files()
        
        self.assertEqual(len(files), 2)
        file_names = {f.name for f in files}
        self.assertIn("test1.txt", file_names)
        self.assertIn("test2.md", file_names)
    
    def test_read_file(self):
        """
        测试读取单个文件
        """
        reader = FileReader(self.test_dir, min_length=1)
        test_file = Path(self.test_dir) / "test1.txt"
        
        items = list(reader.read_file(test_file))
        
        self.assertEqual(len(items), 3)
        self.assertEqual(items[0].line_number, 1)
        self.assertEqual(items[1].line_number, 2)
        self.assertEqual(items[2].line_number, 4)
    
    def test_read_all(self):
        """
        测试读取所有文件
        """
        reader = FileReader(self.test_dir, min_length=1)
        items = reader.read_all()
        
        self.assertGreater(len(items), 0)
    
    def test_read_materials_function(self):
        """
        测试便捷函数
        """
        items = read_materials(self.test_dir, min_length=1)
        
        self.assertGreater(len(items), 0)


class TestTextProcessor(TestCase):
    """
    测试文本处理器
    """
    
    def setUp(self):
        self.processor = TextProcessor()
    
    def test_tokenize_basic(self):
        """
        测试基本分词
        """
        text = "如何写出好的公众号文章标题"
        tokens = self.processor.tokenize(text)
        
        self.assertIsInstance(tokens, list)
        self.assertGreater(len(tokens), 0)
    
    def test_tokenize_with_stopwords(self):
        """
        测试停用词过滤
        """
        text = "这是一个很好的测试"
        tokens = self.processor.tokenize(text)
        
        self.assertNotIn("这是", tokens)
        self.assertNotIn("一个", tokens)
    
    def test_extract_keywords(self):
        """
        测试关键词提取
        """
        text = "公众号文章的标题写作技巧，如何写出吸引用户的好标题"
        keywords = self.processor.extract_keywords(text, top_k=3)
        
        self.assertIsInstance(keywords, list)
        self.assertEqual(len(keywords), 3)
    
    def test_extract_keywords_from_multiple(self):
        """
        测试从多个文本提取关键词
        """
        texts = [
            "公众号标题写作技巧",
            "如何写出好的公众号文章",
            "公众号标题吸引力提升方法"
        ]
        
        keywords = self.processor.extract_keywords_from_multiple(texts, top_k=3)
        
        self.assertIn("公众号", keywords)


class TestSimilarityCalculator(TestCase):
    """
    测试相似度计算器
    """
    
    def setUp(self):
        self.calculator = SimilarityCalculator()
        
        self.items = [
            MaterialItem(
                text="公众号文章标题写作技巧",
                source_file="/test/1.txt",
                line_number=1
            ),
            MaterialItem(
                text="如何写出好的公众号标题",
                source_file="/test/1.txt",
                line_number=2
            ),
            MaterialItem(
                text="短视频拍摄角度和构图技巧",
                source_file="/test/2.txt",
                line_number=1
            ),
            MaterialItem(
                text="拍短视频时如何构图更好看",
                source_file="/test/2.txt",
                line_number=2
            ),
            MaterialItem(
                text="用户痛点分析方法与技巧",
                source_file="/test/3.txt",
                line_number=1
            ),
        ]
    
    def test_calculate_similarity_matrix(self):
        """
        测试相似度矩阵计算
        """
        matrix = self.calculator.calculate_similarity_matrix(self.items)
        
        self.assertEqual(matrix.shape, (5, 5))
        
        for i in range(5):
            self.assertAlmostEqual(matrix[i, i], 1.0, places=5)
    
    def test_find_duplicates(self):
        """
        测试重复检测
        """
        clusters = self.calculator.find_duplicates(
            self.items,
            threshold=0.3,
            min_cluster_size=2
        )
        
        self.assertIsInstance(clusters, list)
    
    def test_get_pairwise_similarity(self):
        """
        测试两两相似度计算
        """
        similarities = self.calculator.get_pairwise_similarity(
            self.items,
            threshold=0.0
        )
        
        self.assertEqual(len(similarities), 10)
        
        self.assertTrue(all(s.similarity >= 0 for s in similarities))
        self.assertTrue(all(s.similarity <= 1 for s in similarities))


class TestTopicClusterer(TestCase):
    """
    测试主题聚类器
    """
    
    def setUp(self):
        self.clusterer = TopicClusterer()
        
        self.items = [
            MaterialItem(text="公众号文章标题写作技巧", source_file="/test/1.txt", line_number=1),
            MaterialItem(text="如何写出好的公众号标题", source_file="/test/1.txt", line_number=2),
            MaterialItem(text="公众号文章结构设计方法", source_file="/test/1.txt", line_number=3),
            MaterialItem(text="短视频拍摄角度选择", source_file="/test/2.txt", line_number=1),
            MaterialItem(text="短视频构图技巧分享", source_file="/test/2.txt", line_number=2),
            MaterialItem(text="拍短视频时如何构图", source_file="/test/2.txt", line_number=3),
            MaterialItem(text="用户痛点分析方法", source_file="/test/3.txt", line_number=1),
            MaterialItem(text="如何挖掘用户真实需求", source_file="/test/3.txt", line_number=2),
        ]
    
    def test_estimate_optimal_clusters(self):
        """
        测试最佳聚类数估计
        """
        vectorizer = Vectorizer()
        tfidf_matrix = vectorizer.fit_transform(self.items)
        
        n = self.clusterer.estimate_optimal_clusters(
            tfidf_matrix,
            min_clusters=2,
            max_clusters=5
        )
        
        self.assertGreaterEqual(n, 1)
        self.assertLessEqual(n, 5)
    
    def test_cluster_by_topics(self):
        """
        测试主题聚类
        """
        topics, item_to_topic, tfidf_matrix = self.clusterer.cluster_by_topics(
            self.items,
            n_topics=3
        )
        
        self.assertIsInstance(topics, list)
        self.assertGreater(len(topics), 0)
        
        self.assertEqual(len(item_to_topic), len(self.items))
        
        for topic in topics:
            self.assertIsInstance(topic, TopicGroup)
            self.assertTrue(topic.topic_id)
            self.assertTrue(topic.topic_name)
            self.assertIsInstance(topic.keywords, list)
            self.assertGreater(len(topic.item_ids), 0)
    
    def test_process(self):
        """
        测试完整处理流程
        """
        result = self.clusterer.process(
            self.items,
            n_topics=3,
            similarity_threshold=0.5,
            min_duplicate_size=2
        )
        
        self.assertIsInstance(result, ProcessingResult)
        
        self.assertEqual(len(result.all_items), len(self.items))
        
        self.assertIsInstance(result.topic_groups, list)
        self.assertIsInstance(result.duplicate_clusters, list)
        
        for item in self.items:
            self.assertIn(item.id, result.item_to_topic)
    
    def test_process_materials_function(self):
        """
        测试便捷函数
        """
        result = process_materials(
            self.items,
            n_topics=3,
            similarity_threshold=0.5
        )
        
        self.assertIsInstance(result, ProcessingResult)


class TestStateManager(TestCase):
    """
    测试状态管理器
    """
    
    def setUp(self):
        """
        测试前准备
        """
        self.test_output_dir = tempfile.mkdtemp()
        self.test_source_dir = tempfile.mkdtemp()
        
        self.state_manager = StateManager(
            output_directory=self.test_output_dir,
            source_directory=self.test_source_dir
        )
        
        self.test_items = [
            MaterialItem(text="测试内容1", source_file="/test/1.txt", line_number=1),
            MaterialItem(text="测试内容2", source_file="/test/1.txt", line_number=2),
            MaterialItem(text="测试内容3", source_file="/test/2.txt", line_number=1),
        ]
    
    def tearDown(self):
        """
        测试后清理
        """
        shutil.rmtree(self.test_output_dir)
        shutil.rmtree(self.test_source_dir)
    
    def test_initialization(self):
        """
        测试初始化
        """
        self.assertIsNotNone(self.state_manager)
        
        stats = self.state_manager.get_statistics()
        self.assertEqual(stats["total"], 0)
    
    def test_set_and_get_status(self):
        """
        测试设置和获取状态
        """
        item_id = self.test_items[0].id
        
        record = self.state_manager.set_status(
            item_id=item_id,
            status=MaterialStatus.PENDING,
            source_file=self.test_items[0].source_file,
            line_number=self.test_items[0].line_number,
            original_text=self.test_items[0].text
        )
        
        self.assertIsInstance(record, MaterialStateRecord)
        
        status = self.state_manager.get_status(item_id)
        self.assertEqual(status, MaterialStatus.PENDING)
    
    def test_get_record(self):
        """
        测试获取记录
        """
        item = self.test_items[0]
        
        self.state_manager.set_status(
            item_id=item.id,
            status=MaterialStatus.USED,
            source_file=item.source_file,
            line_number=item.line_number,
            original_text=item.text,
            notes="测试备注"
        )
        
        record = self.state_manager.get_record(item.id)
        
        self.assertIsNotNone(record)
        self.assertEqual(record.status, MaterialStatus.USED)
        self.assertEqual(record.notes, "测试备注")
    
    def test_get_all_statuses(self):
        """
        测试获取所有状态
        """
        for item in self.test_items:
            self.state_manager.set_status(
                item_id=item.id,
                status=MaterialStatus.PENDING,
                source_file=item.source_file,
                line_number=item.line_number,
                original_text=item.text
            )
        
        all_statuses = self.state_manager.get_all_statuses()
        
        self.assertEqual(len(all_statuses), len(self.test_items))
        
        for status in all_statuses.values():
            self.assertEqual(status, MaterialStatus.PENDING)
    
    def test_get_items_by_status(self):
        """
        测试按状态获取素材
        """
        self.state_manager.set_status(
            item_id=self.test_items[0].id,
            status=MaterialStatus.PENDING,
            source_file=self.test_items[0].source_file,
            line_number=self.test_items[0].line_number
        )
        self.state_manager.set_status(
            item_id=self.test_items[1].id,
            status=MaterialStatus.USED,
            source_file=self.test_items[1].source_file,
            line_number=self.test_items[1].line_number
        )
        self.state_manager.set_status(
            item_id=self.test_items[2].id,
            status=MaterialStatus.SHELVED,
            source_file=self.test_items[2].source_file,
            line_number=self.test_items[2].line_number
        )
        
        pending = self.state_manager.get_items_by_status(MaterialStatus.PENDING)
        used = self.state_manager.get_items_by_status(MaterialStatus.USED)
        shelved = self.state_manager.get_items_by_status(MaterialStatus.SHELVED)
        
        self.assertEqual(len(pending), 1)
        self.assertEqual(len(used), 1)
        self.assertEqual(len(shelved), 1)
    
    def test_merge_with_current_items(self):
        """
        测试合并当前素材
        """
        self.state_manager.merge_with_current_items(self.test_items)
        
        stats = self.state_manager.get_statistics()
        self.assertEqual(stats["total"], len(self.test_items))
        
        for item in self.test_items:
            status = self.state_manager.get_status(item.id)
            self.assertEqual(status, MaterialStatus.UNSET)
    
    def test_set_statuses(self):
        """
        测试批量设置状态
        """
        updates = {
            self.test_items[0].id: MaterialStatus.PENDING,
            self.test_items[1].id: MaterialStatus.USED,
        }
        
        records = self.state_manager.set_statuses(updates)
        
        self.assertEqual(len(records), 2)
        
        self.assertEqual(
            self.state_manager.get_status(self.test_items[0].id),
            MaterialStatus.PENDING
        )
        self.assertEqual(
            self.state_manager.get_status(self.test_items[1].id),
            MaterialStatus.USED
        )
    
    def test_persistence(self):
        """
        测试状态持久化
        """
        self.state_manager.set_status(
            item_id=self.test_items[0].id,
            status=MaterialStatus.PENDING,
            source_file=self.test_items[0].source_file,
            line_number=self.test_items[0].line_number,
            original_text=self.test_items[0].text
        )
        
        new_manager = StateManager(
            output_directory=self.test_output_dir,
            source_directory=self.test_source_dir
        )
        
        status = new_manager.get_status(self.test_items[0].id)
        self.assertEqual(status, MaterialStatus.PENDING)


class TestMaterialStatus(TestCase):
    """
    测试状态枚举
    """
    
    def test_from_string(self):
        """
        测试从字符串转换
        """
        self.assertEqual(MaterialStatus.from_string("pending"), MaterialStatus.PENDING)
        self.assertEqual(MaterialStatus.from_string("待写"), MaterialStatus.PENDING)
        self.assertEqual(MaterialStatus.from_string("used"), MaterialStatus.USED)
        self.assertEqual(MaterialStatus.from_string("已用"), MaterialStatus.USED)
        self.assertEqual(MaterialStatus.from_string("shelved"), MaterialStatus.SHELVED)
        self.assertEqual(MaterialStatus.from_string("先搁置"), MaterialStatus.SHELVED)
        self.assertEqual(MaterialStatus.from_string("unknown"), MaterialStatus.UNSET)
    
    def test_get_display_name(self):
        """
        测试获取显示名称
        """
        self.assertEqual(MaterialStatus.get_display_name(MaterialStatus.PENDING), "待写")
        self.assertEqual(MaterialStatus.get_display_name(MaterialStatus.USED), "已用")
        self.assertEqual(MaterialStatus.get_display_name(MaterialStatus.SHELVED), "先搁置")
        self.assertEqual(MaterialStatus.get_display_name(MaterialStatus.UNSET), "未设置")
    
    def test_get_all_statuses(self):        """
        测试获取所有状态
        """
        statuses = MaterialStatus.get_all_statuses()
        self.assertEqual(len(statuses), 4)


class TestExporter(TestCase):
    """
    测试导出器
    """
    
    def setUp(self):
        """
        测试前准备
        """
        self.test_output_dir = tempfile.mkdtemp()
        self.test_source_dir = tempfile.mkdtemp()
        
        self.items = [
            MaterialItem(text="公众号文章标题写作技巧", source_file="/test/1.txt", line_number=1),
            MaterialItem(text="如何写出好的公众号标题", source_file="/test/1.txt", line_number=2),
            MaterialItem(text="短视频拍摄角度选择", source_file="/test/2.txt", line_number=1),
            MaterialItem(text="短视频构图技巧分享", source_file="/test/2.txt", line_number=2),
        ]
        
        self.result = process_materials(
            self.items,
            n_topics=2,
            similarity_threshold=0.5
        )
        
        self.state_manager = StateManager(
            output_directory=self.test_output_dir,
            source_directory=self.test_source_dir
        )
        self.state_manager.merge_with_current_items(self.items)
    
    def tearDown(self):
        """
        测试后清理
        """
        shutil.rmtree(self.test_output_dir)
        shutil.rmtree(self.test_source_dir)
    
    def test_json_exporter(self):
        """
        测试 JSON 导出器
        """
        exporter = JSONExporter(
            processing_result=self.result,
            state_manager=self.state_manager,
            source_dir=self.test_source_dir,
            output_dir=self.test_output_dir
        )
        
        data = exporter.export()
        
        self.assertIn("metadata", data)
        self.assertIn("statistics", data)
        self.assertIn("topics", data)
        self.assertIn("materials", data)
        self.assertIn("state_summary", data)
        
        self.assertIn("total_materials", data["statistics"])
        self.assertIn("total_topics", data["statistics"])
        
        self.assertEqual(len(data["materials"]), len(self.items))
    
    def test_json_exporter_save(self):
        """
        测试 JSON 保存到文件
        """
        exporter = JSONExporter(
            processing_result=self.result,
            state_manager=self.state_manager,
            source_dir=self.test_source_dir,
            output_dir=self.test_output_dir
        )
        
        output_path = Path(self.test_output_dir) / "test_output.json"
        saved_path = exporter.save_to_file(str(output_path))
        
        self.assertTrue(Path(saved_path).exists())
        
        import json
        with open(saved_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.assertIn("metadata", data)
    
    def test_markdown_exporter(self):        """
        测试 Markdown 导出器
        """
        exporter = MarkdownExporter(
            processing_result=self.result,
            state_manager=self.state_manager,
            source_dir=self.test_source_dir,
            output_dir=self.test_output_dir
        )
        
        content = exporter.export()
        
        self.assertIsInstance(content, str)
        self.assertGreater(len(content), 0)
        
        self.assertIn("# 选题素材看板", content)
        self.assertIn("## 📊 概览统计", content)
    
    def test_markdown_exporter_save(self):
        """
        测试 Markdown 保存到文件
        """
        exporter = MarkdownExporter(
            processing_result=self.result,
            state_manager=self.state_manager,
            source_dir=self.test_source_dir,
            output_dir=self.test_output_dir
        )
        
        output_path = Path(self.test_output_dir) / "test_output.md"
        saved_path = exporter.save_to_file(str(output_path))
        
        self.assertTrue(Path(saved_path).exists())
        
        with open(saved_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        self.assertIn("# 选题素材看板", content)
    
    def test_export_all_function(self):
        """
        测试便捷导出函数
        """
        exported = export_all(
            processing_result=self.result,
            state_manager=self.state_manager,
            output_dir=self.test_output_dir,
            source_dir=self.test_source_dir
        )
        
        self.assertIn("json", exported)
        self.assertIn("markdown", exported)
        
        self.assertTrue(Path(exported["json"]).exists())
        self.assertTrue(Path(exported["markdown"]).exists())


class TestHelperFunctions(TestCase):
    """
    测试辅助函数
    """
    
    def setUp(self):
        self.items = [
            MaterialItem(text="公众号文章标题写作技巧分享", source_file="/test/1.txt", line_number=1),
            MaterialItem(text="如何写出吸引用户的公众号标题", source_file="/test/1.txt", line_number=2),
            MaterialItem(text="公众号标题的吸引力提升方法", source_file="/test/1.txt", line_number=3),
        ]
    
    def test_extract_cluster_keywords(self):
        """
        测试提取簇关键词
        """
        keywords = extract_cluster_keywords(self.items, top_k=3)
        
        self.assertIsInstance(keywords, list)
        self.assertEqual(len(keywords), 3)
        self.assertIn("公众号", keywords)
    
    def test_get_cluster_representative(self):
        """
        测试获取簇代表
        """
        representative = get_cluster_representative(self.items)
        
        self.assertIsInstance(representative, MaterialItem)
        
        max_length = max(len(item.clean_text) for item in self.items)
        self.assertEqual(len(representative.clean_text), max_length)
