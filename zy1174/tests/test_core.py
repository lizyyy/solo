import unittest
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.tokenizer import Tokenizer, StopWordFilter, TextProcessor
from app.utils.vectorizer import TFIDFVectorizer, SimpleEmbeddingVectorizer, VectorizerFactory
from app.utils.similarity import (
    normalize_vectors, cosine_similarity_matrix, SimilarityCalculator,
    VectorRetriever, EvaluationMetrics, VectorDimensionAnalyzer
)
from app.utils.data_io import DataImporter, DataExporter, ReportExporter

import numpy as np


class TestTokenizer(unittest.TestCase):
    def setUp(self):
        self.chinese_text = "人工智能是计算机科学的一个重要分支"
        self.english_text = "Artificial intelligence is an important branch of computer science"
    
    def test_jieba_tokenizer(self):
        tokenizer = Tokenizer('jieba')
        tokens = tokenizer.tokenize(self.chinese_text)
        self.assertIsInstance(tokens, list)
        self.assertGreater(len(tokens), 0)
        self.assertIn('人工智能', tokens)
    
    def test_space_tokenizer(self):
        tokenizer = Tokenizer('space')
        tokens = tokenizer.tokenize(self.english_text)
        self.assertEqual(len(tokens), 9)
        self.assertEqual(tokens[0], 'Artificial')
    
    def test_char_tokenizer(self):
        tokenizer = Tokenizer('char')
        tokens = tokenizer.tokenize(self.chinese_text)
        self.assertEqual(len(tokens), len(self.chinese_text))
    
    def test_empty_text(self):
        tokenizer = Tokenizer('jieba')
        tokens = tokenizer.tokenize('')
        self.assertEqual(tokens, [])
        
        tokens = tokenizer.tokenize(None)
        self.assertEqual(tokens, [])
    
    def test_batch_tokenize(self):
        tokenizer = Tokenizer('jieba')
        texts = [self.chinese_text, self.chinese_text]
        results = tokenizer.tokenize_batch(texts)
        self.assertEqual(len(results), 2)
        self.assertIsInstance(results[0], list)


class TestStopWordFilter(unittest.TestCase):
    def setUp(self):
        self.tokens = ['人工智能', '是', '计算机', '科学', '的', '一个', '分支']
    
    def test_chinese_stopwords(self):
        filter = StopWordFilter('chinese')
        filtered = filter.filter(self.tokens)
        self.assertNotIn('是', filtered)
        self.assertNotIn('的', filtered)
        self.assertIn('人工智能', filtered)
    
    def test_english_stopwords(self):
        filter = StopWordFilter('english')
        tokens = ['the', 'quick', 'brown', 'fox', 'is', 'jumping']
        filtered = filter.filter(tokens)
        self.assertNotIn('the', filtered)
        self.assertNotIn('is', filtered)
    
    def test_custom_stopwords(self):
        custom = ['人工智能']
        filter = StopWordFilter('chinese', custom)
        filtered = filter.filter(self.tokens)
        self.assertNotIn('人工智能', filtered)
    
    def test_add_remove_stopword(self):
        filter = StopWordFilter('chinese')
        filter.add_stopword('新词')
        self.assertIn('新词', filter.stopwords)
        
        filter.remove_stopword('新词')
        self.assertNotIn('新词', filter.stopwords)
    
    def test_empty_tokens(self):
        filter = StopWordFilter('chinese')
        filtered = filter.filter([])
        self.assertEqual(filtered, [])


class TestTextProcessor(unittest.TestCase):
    def setUp(self):
        self.text = "人工智能是计算机科学的一个重要分支，它应用于各个领域。"
    
    def test_process(self):
        processor = TextProcessor('jieba', 'chinese')
        tokens = processor.process(self.text)
        self.assertIsInstance(tokens, list)
        self.assertGreater(len(tokens), 0)
    
    def test_clean_text(self):
        processor = TextProcessor()
        dirty_text = "  人工智能\t\n是... 计算机   科学  "
        clean = processor.clean_text(dirty_text)
        self.assertNotIn('\t', clean)
        self.assertNotIn('\n', clean)
    
    def test_batch_process(self):
        processor = TextProcessor('jieba', 'chinese')
        texts = [self.text, self.text]
        results = processor.process_batch(texts)
        self.assertEqual(len(results), 2)


class TestTFIDFVectorizer(unittest.TestCase):
    def setUp(self):
        self.documents = [
            "人工智能是计算机科学的重要分支",
            "机器学习是人工智能的一个子领域",
            "深度学习是机器学习的一种方法",
            "Python是一种编程语言"
        ]
    
    def test_fit_transform(self):
        vectorizer = TFIDFVectorizer(tokenizer_type='jieba', stopword_lang='chinese')
        vectors = vectorizer.fit_transform(self.documents)
        
        self.assertEqual(vectors.shape[0], 4)
        self.assertGreater(vectors.shape[1], 0)
        self.assertTrue(vectorizer.is_fitted)
    
    def test_transform(self):
        vectorizer = TFIDFVectorizer(tokenizer_type='jieba', stopword_lang='chinese')
        vectorizer.fit(self.documents)
        
        new_doc = ["人工智能和机器学习的关系"]
        vectors = vectorizer.transform(new_doc)
        
        self.assertEqual(vectors.shape[0], 1)
    
    def test_normalize_vectors(self):
        vectorizer = TFIDFVectorizer(tokenizer_type='jieba', stopword_lang='chinese')
        vectors = vectorizer.fit_transform(self.documents, normalize_vectors=True)
        
        norms = np.linalg.norm(vectors, axis=1)
        for norm in norms:
            self.assertAlmostEqual(norm, 1.0, places=5)
    
    def test_get_feature_names(self):
        vectorizer = TFIDFVectorizer(tokenizer_type='jieba', stopword_lang='chinese')
        vectorizer.fit(self.documents)
        
        features = vectorizer.get_feature_names()
        self.assertIsInstance(features, list)
        self.assertGreater(len(features), 0)
    
    def test_vocabulary_size(self):
        vectorizer = TFIDFVectorizer(tokenizer_type='jieba', stopword_lang='chinese')
        vectorizer.fit(self.documents)
        
        size = vectorizer.get_vocabulary_size()
        self.assertGreater(size, 0)
    
    def test_not_fitted_error(self):
        vectorizer = TFIDFVectorizer()
        with self.assertRaises(RuntimeError):
            vectorizer.transform(["测试"])


class TestSimpleEmbeddingVectorizer(unittest.TestCase):
    def setUp(self):
        self.documents = [
            "人工智能是计算机科学的重要分支",
            "机器学习是人工智能的一个子领域",
            "深度学习是机器学习的一种方法"
        ]
    
    def test_fit_transform(self):
        vectorizer = SimpleEmbeddingVectorizer(
            tokenizer_type='jieba',
            stopword_lang='chinese',
            embedding_dim=50
        )
        vectors = vectorizer.fit_transform(self.documents)
        
        self.assertEqual(vectors.shape[0], 3)
        self.assertEqual(vectors.shape[1], 50)
        self.assertTrue(vectorizer.is_fitted)
    
    def test_embedding_dimensions(self):
        vectorizer = SimpleEmbeddingVectorizer(embedding_dim=100)
        self.assertEqual(vectorizer.get_dimensions(), 100)
    
    def test_normalize_vectors(self):
        vectorizer = SimpleEmbeddingVectorizer(embedding_dim=50)
        vectors = vectorizer.fit_transform(self.documents, normalize_vectors=True)
        
        norms = np.linalg.norm(vectors, axis=1)
        for norm in norms:
            self.assertAlmostEqual(norm, 1.0, places=5)
    
    def test_empty_documents(self):
        vectorizer = SimpleEmbeddingVectorizer(embedding_dim=50)
        vectorizer.fit(self.documents)
        
        empty_vectors = vectorizer.transform([""])
        self.assertEqual(empty_vectors.shape[1], 50)


class TestVectorizerFactory(unittest.TestCase):
    def test_create_tfidf(self):
        vectorizer = VectorizerFactory.create('tfidf', tokenizer_type='jieba')
        self.assertIsInstance(vectorizer, TFIDFVectorizer)
    
    def test_create_embedding(self):
        vectorizer = VectorizerFactory.create('embedding', embedding_dim=100)
        self.assertIsInstance(vectorizer, SimpleEmbeddingVectorizer)
    
    def test_unknown_type(self):
        with self.assertRaises(ValueError):
            VectorizerFactory.create('unknown')


class TestSimilarityCalculator(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        self.vectors = np.random.randn(5, 10)
        self.vectors = self.vectors / np.linalg.norm(self.vectors, axis=1, keepdims=True)
    
    def test_cosine_similarity(self):
        calc = SimilarityCalculator('cosine')
        sim = calc.calculate(self.vectors[0], self.vectors)
        
        self.assertEqual(len(sim), 5)
        self.assertAlmostEqual(sim[0], 1.0, places=5)
    
    def test_dot_product(self):
        calc = SimilarityCalculator('dot')
        sim = calc.calculate(self.vectors[0], self.vectors)
        
        self.assertEqual(len(sim), 5)
    
    def test_similarity_matrix(self):
        calc = SimilarityCalculator('cosine')
        matrix = calc.calculate_matrix(self.vectors)
        
        self.assertEqual(matrix.shape, (5, 5))
        self.assertAlmostEqual(matrix[0, 0], 1.0, places=5)


class TestVectorRetriever(unittest.TestCase):
    def setUp(self):
        np.random.seed(42)
        self.vectors = np.random.randn(10, 20)
        self.vectors = self.vectors / np.linalg.norm(self.vectors, axis=1, keepdims=True)
        self.ids = [f'doc_{i}' for i in range(10)]
        self.contents = [f"文档 {i} 内容" for i in range(10)]
    
    def test_index(self):
        retriever = VectorRetriever('cosine')
        retriever.index(self.vectors, self.ids, self.contents)
        
        self.assertIsNotNone(retriever.corpus_vectors)
        self.assertEqual(len(retriever.corpus_ids), 10)
    
    def test_search(self):
        retriever = VectorRetriever('cosine')
        retriever.index(self.vectors, self.ids, self.contents)
        
        query_vector = self.vectors[0]
        results = retriever.search(query_vector, top_k=3)
        
        self.assertEqual(len(results), 3)
        self.assertEqual(results[0]['rank'], 1)
        self.assertEqual(results[0]['id'], 'doc_0')
    
    def test_search_batch(self):
        retriever = VectorRetriever('cosine')
        retriever.index(self.vectors, self.ids, self.contents)
        
        query_vectors = self.vectors[:2]
        all_results = retriever.search_batch(query_vectors, top_k=2)
        
        self.assertEqual(len(all_results), 2)
        self.assertEqual(len(all_results[0]), 2)
    
    def test_get_similarity_matrix(self):
        retriever = VectorRetriever('cosine')
        retriever.index(self.vectors, self.ids)
        
        matrix = retriever.get_similarity_matrix()
        self.assertEqual(matrix.shape, (10, 10))
    
    def test_not_indexed_error(self):
        retriever = VectorRetriever('cosine')
        with self.assertRaises(RuntimeError):
            retriever.search(np.random.randn(20))


class TestEvaluationMetrics(unittest.TestCase):
    def setUp(self):
        self.relevant_ids = [1, 3, 5]
        self.retrieved_ids = [1, 2, 3, 4, 5]
    
    def test_precision_at_k(self):
        precision = EvaluationMetrics.precision_at_k(
            self.relevant_ids, self.retrieved_ids, k=3
        )
        self.assertEqual(precision, 2/3)
    
    def test_recall_at_k(self):
        recall = EvaluationMetrics.recall_at_k(
            self.relevant_ids, self.retrieved_ids, k=5
        )
        self.assertEqual(recall, 1.0)
    
    def test_f1_score(self):
        f1 = EvaluationMetrics.f1_score(0.8, 0.6)
        self.assertAlmostEqual(f1, 0.6857, places=4)
    
    def test_mean_average_precision(self):
        relevant_list = [self.relevant_ids]
        retrieved_list = [self.retrieved_ids]
        
        map_score = EvaluationMetrics.mean_average_precision(
            relevant_list, retrieved_list, k=5
        )
        self.assertGreater(map_score, 0)
    
    def test_reciprocal_rank(self):
        rr = EvaluationMetrics.reciprocal_rank(
            self.relevant_ids, self.retrieved_ids
        )
        self.assertEqual(rr, 1.0)
    
    def test_mean_reciprocal_rank(self):
        relevant_list = [self.relevant_ids]
        retrieved_list = [self.retrieved_ids]
        
        mrr = EvaluationMetrics.mean_reciprocal_rank(
            relevant_list, retrieved_list
        )
        self.assertGreater(mrr, 0)
    
    def test_ndcg_at_k(self):
        relevance_scores = [3, 2, 1, 0, 3]
        ranks = [0, 1, 2, 3, 4]
        
        ndcg = EvaluationMetrics.ndcg_at_k(relevance_scores, ranks, k=3)
        self.assertGreater(ndcg, 0)
    
    def test_empty_relevant(self):
        precision = EvaluationMetrics.precision_at_k([], self.retrieved_ids, k=5)
        self.assertEqual(precision, 0.0)
        
        recall = EvaluationMetrics.recall_at_k([], self.retrieved_ids, k=5)
        self.assertEqual(recall, 0.0)


class TestVectorDimensionAnalyzer(unittest.TestCase):
    def setUp(self):
        self.documents = [
            "人工智能是计算机科学的重要分支",
            "机器学习是人工智能的一个子领域",
            "深度学习是机器学习的一种方法",
            "Python是一种编程语言"
        ]
        self.vectorizer = TFIDFVectorizer(tokenizer_type='jieba', stopword_lang='chinese')
        self.vectors = self.vectorizer.fit_transform(self.documents)
    
    def test_analyze_query_impact_tfidf(self):
        analyzer = VectorDimensionAnalyzer(self.vectorizer)
        query_vector = self.vectors[0]
        
        impact = analyzer.analyze_query_impact(query_vector, top_k=5)
        
        self.assertEqual(impact['type'], 'tfidf')
        self.assertIn('top_features', impact)
        self.assertGreater(len(impact['top_features']), 0)
    
    def test_analyze_corpus_dimensions(self):
        analyzer = VectorDimensionAnalyzer(self.vectorizer)
        analysis = analyzer.analyze_corpus_dimensions(self.vectors)
        
        self.assertEqual(analysis['num_documents'], 4)
        self.assertGreater(analysis['total_dimensions'], 0)
        self.assertIn('top_variance_dimensions', analysis)


class TestDataImporter(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.dirname(os.path.abspath(__file__))
        self.csv_file = os.path.join(
            os.path.dirname(self.test_dir), 'examples', 'sample_docs.csv'
        )
        self.jsonl_file = os.path.join(
            os.path.dirname(self.test_dir), 'examples', 'sample_docs.jsonl'
        )
    
    def test_detect_format_csv(self):
        format = DataImporter.detect_format(self.csv_file)
        self.assertEqual(format, 'csv')
    
    def test_detect_format_jsonl(self):
        format = DataImporter.detect_format(self.jsonl_file)
        self.assertEqual(format, 'jsonl')
    
    def test_import_csv(self):
        if os.path.exists(self.csv_file):
            docs = DataImporter.import_csv(self.csv_file)
            self.assertGreater(len(docs), 0)
            self.assertIn('doc_id', docs[0])
            self.assertIn('content', docs[0])
    
    def test_import_jsonl(self):
        if os.path.exists(self.jsonl_file):
            docs = DataImporter.import_jsonl(self.jsonl_file)
            self.assertGreater(len(docs), 0)
            self.assertIn('doc_id', docs[0])
            self.assertIn('content', docs[0])
    
    def test_file_not_found(self):
        with self.assertRaises(FileNotFoundError):
            DataImporter.import_file('/nonexistent/file.csv')
    
    def test_unsupported_format(self):
        with self.assertRaises(ValueError):
            DataImporter.import_file('test.xyz', format='xyz')


class TestReportExporter(unittest.TestCase):
    def setUp(self):
        self.corpus_stats = {
            'total_docs': 10,
            'total_tokens': 500,
            'avg_doc_length': 50,
            'vocab_size': 100
        }
        self.vectorization_config = {
            'tokenizer': 'jieba',
            'stopword_lang': 'chinese',
            'vectorization': 'tfidf',
            'dimensions': 100,
            'normalize': True,
            'top_k': 5
        }
        self.query_results = [
            {
                'query_text': '测试查询',
                'results': [
                    {'rank': 1, 'id': 1, 'similarity_score': 0.9, 'content': '文档内容'}
                ]
            }
        ]
    
    def test_generate_markdown_report(self):
        report = ReportExporter.generate_markdown_report(
            corpus_stats=self.corpus_stats,
            vectorization_config=self.vectorization_config,
            query_results=self.query_results
        )
        
        self.assertIsInstance(report, str)
        self.assertIn('# 文本向量检索实验报告', report)
        self.assertIn('语料库统计', report)
        self.assertIn('向量化配置', report)
    
    def test_generate_json_report(self):
        report = ReportExporter.generate_json_report(
            corpus_stats=self.corpus_stats,
            vectorization_config=self.vectorization_config,
            query_results=self.query_results
        )
        
        self.assertIsInstance(report, dict)
        self.assertIn('corpus_stats', report)
        self.assertIn('vectorization_config', report)
        self.assertIn('query_results', report)
    
    def test_report_with_evaluation(self):
        evaluation = {
            'MAP': 0.85,
            'MRR': 0.9,
            'avg_precision': 0.7
        }
        
        report = ReportExporter.generate_markdown_report(
            corpus_stats=self.corpus_stats,
            vectorization_config=self.vectorization_config,
            query_results=self.query_results,
            evaluation_metrics=evaluation
        )
        
        self.assertIn('评估指标', report)
    
    def test_report_with_similarity_matrix(self):
        matrix = [[1.0, 0.5], [0.5, 1.0]]
        
        report = ReportExporter.generate_markdown_report(
            corpus_stats=self.corpus_stats,
            vectorization_config=self.vectorization_config,
            query_results=self.query_results,
            similarity_matrix=matrix
        )
        
        self.assertIn('相似度矩阵', report)
    
    def test_report_with_dimension_analysis(self):
        dimension_analysis = {
            'type': 'tfidf',
            'top_features': [{'feature': '人工智能', 'weight': 0.8}],
            'total_dimensions': 100
        }
        
        report = ReportExporter.generate_markdown_report(
            corpus_stats=self.corpus_stats,
            vectorization_config=self.vectorization_config,
            query_results=self.query_results,
            dimension_analysis=dimension_analysis
        )
        
        self.assertIn('向量维度分析', report)


class TestNormalizeVectors(unittest.TestCase):
    def test_l2_normalize(self):
        vectors = np.array([[3, 4], [1, 1]], dtype=np.float64)
        normalized = normalize_vectors(vectors, norm='l2')
        
        norms = np.linalg.norm(normalized, axis=1)
        self.assertAlmostEqual(norms[0], 1.0, places=5)
        self.assertAlmostEqual(norms[1], 1.0, places=5)
    
    def test_l1_normalize(self):
        vectors = np.array([[3, 4], [1, 1]], dtype=np.float64)
        normalized = normalize_vectors(vectors, norm='l1')
        
        sums = np.sum(np.abs(normalized), axis=1)
        self.assertAlmostEqual(sums[0], 1.0, places=5)
    
    def test_single_vector(self):
        vector = np.array([3, 4], dtype=np.float64)
        normalized = normalize_vectors(vector, norm='l2')
        
        self.assertEqual(normalized.shape, (1, 2))
        self.assertAlmostEqual(np.linalg.norm(normalized), 1.0, places=5)


class TestCosineSimilarityMatrix(unittest.TestCase):
    def test_same_vectors(self):
        np.random.seed(42)
        vectors = np.random.randn(5, 10)
        vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
        
        matrix = cosine_similarity_matrix(vectors)
        
        self.assertEqual(matrix.shape, (5, 5))
        for i in range(5):
            self.assertAlmostEqual(matrix[i, i], 1.0, places=5)
    
    def test_different_vectors(self):
        np.random.seed(42)
        vectors1 = np.random.randn(3, 10)
        vectors2 = np.random.randn(5, 10)
        
        vectors1 = vectors1 / np.linalg.norm(vectors1, axis=1, keepdims=True)
        vectors2 = vectors2 / np.linalg.norm(vectors2, axis=1, keepdims=True)
        
        matrix = cosine_similarity_matrix(vectors1, vectors2)
        
        self.assertEqual(matrix.shape, (3, 5))


if __name__ == '__main__':
    unittest.main()
