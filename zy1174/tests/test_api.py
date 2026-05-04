import unittest
import sys
import os
import json
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import Corpus, VectorVersion, QueryRecord, SimilarityResult, Annotation
from config import Config


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


class TestAPI(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
    
    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
    
    def test_health_check(self):
        response = self.client.get('/api/health')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(data['status'], 'healthy')
    
    def test_add_document(self):
        response = self.client.post('/api/corpus', 
            json={
                'doc_id': 'test_doc_001',
                'content': '这是一个测试文档的内容',
                'metadata': {'source': 'test'}
            },
            content_type='application/json'
        )
        
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 201)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['doc_id'], 'test_doc_001')
    
    def test_add_document_missing_content(self):
        response = self.client.post('/api/corpus', 
            json={'doc_id': 'test_doc_001'},
            content_type='application/json'
        )
        
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertFalse(data['success'])
    
    def test_get_corpus(self):
        with self.app.app_context():
            for i in range(15):
                doc = Corpus(
                    doc_id=f'doc_{i:03d}',
                    content=f'文档 {i} 的内容',
                    metadata='{}'
                )
                db.session.add(doc)
            db.session.commit()
        
        response = self.client.get('/api/corpus?page=1&per_page=10')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(len(data['data']['items']), 10)
        self.assertEqual(data['data']['total'], 15)
        self.assertEqual(data['data']['pages'], 2)
    
    def test_get_document(self):
        with self.app.app_context():
            doc = Corpus(
                doc_id='test_doc',
                content='测试文档内容',
                metadata='{"source": "test"}'
            )
            db.session.add(doc)
            db.session.commit()
            doc_id = doc.id
        
        response = self.client.get(f'/api/corpus/{doc_id}')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['doc_id'], 'test_doc')
    
    def test_update_document(self):
        with self.app.app_context():
            doc = Corpus(
                doc_id='test_doc',
                content='原始内容',
                metadata='{}'
            )
            db.session.add(doc)
            db.session.commit()
            doc_id = doc.id
        
        response = self.client.put(f'/api/corpus/{doc_id}',
            json={'content': '更新后的内容'},
            content_type='application/json'
        )
        
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        
        with self.app.app_context():
            updated = Corpus.query.get(doc_id)
            self.assertEqual(updated.content, '更新后的内容')
    
    def test_delete_document(self):
        with self.app.app_context():
            doc = Corpus(
                doc_id='test_doc',
                content='测试内容',
                metadata='{}'
            )
            db.session.add(doc)
            db.session.commit()
            doc_id = doc.id
        
        response = self.client.delete(f'/api/corpus/{doc_id}')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        
        with self.app.app_context():
            self.assertIsNone(Corpus.query.get(doc_id))
    
    def test_corpus_stats_empty(self):
        response = self.client.get('/api/corpus/stats')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['total_docs'], 0)
    
    def test_corpus_stats_with_docs(self):
        with self.app.app_context():
            for i in range(5):
                doc = Corpus(
                    doc_id=f'doc_{i}',
                    content=f'这是第 {i} 个测试文档，包含一些中文内容',
                    metadata='{}'
                )
                db.session.add(doc)
            db.session.commit()
        
        response = self.client.get('/api/corpus/stats')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['total_docs'], 5)
        self.assertGreater(data['data']['total_tokens'], 0)
    
    def test_vectorize_no_docs(self):
        response = self.client.post('/api/vectorize',
            json={'vectorization': 'tfidf'},
            content_type='application/json'
        )
        
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertFalse(data['success'])
    
    def test_search_not_vectorized(self):
        response = self.client.post('/api/search',
            json={'query': '测试查询', 'top_k': 5},
            content_type='application/json'
        )
        
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertFalse(data['success'])
    
    def test_vector_versions_empty(self):
        response = self.client.get('/api/vector-versions')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(data['data'], [])
    
    def test_query_history_empty(self):
        response = self.client.get('/api/query-history')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['total'], 0)
    
    def test_evaluate_no_annotations(self):
        response = self.client.post('/api/evaluate',
            json={'top_k': 5},
            content_type='application/json'
        )
        
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertFalse(data['success'])
    
    def test_annotation_create(self):
        with self.app.app_context():
            doc = Corpus(doc_id='doc1', content='内容1', metadata='{}')
            db.session.add(doc)
            db.session.flush()
            
            vv = VectorVersion(version_name='v1', tokenizer='jieba', stopword_lang='chinese',
                               vectorization='tfidf', normalize=True, dimensions=100, vocabulary_size=50)
            db.session.add(vv)
            db.session.flush()
            
            qr = QueryRecord(query_text='测试查询', vector_version_id=vv.id, top_k=5)
            db.session.add(qr)
            db.session.commit()
            
            corpus_id = doc.id
            qr_id = qr.id
        
        response = self.client.post('/api/annotations',
            json={
                'query_record_id': qr_id,
                'corpus_id': corpus_id,
                'relevance': 2
            },
            content_type='application/json'
        )
        
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
    
    def test_annotation_invalid_relevance(self):
        response = self.client.post('/api/annotations',
            json={
                'query_record_id': 1,
                'corpus_id': 1,
                'relevance': 5
            },
            content_type='application/json'
        )
        
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertFalse(data['success'])
    
    def test_annotation_missing_fields(self):
        response = self.client.post('/api/annotations',
            json={'query_record_id': 1},
            content_type='application/json'
        )
        
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertFalse(data['success'])


class TestUploadAPI(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
    
    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
    
    def test_upload_no_file(self):
        response = self.client.post('/api/corpus/upload')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertFalse(data['success'])
    
    def test_upload_empty_filename(self):
        data = {}
        response = self.client.post('/api/corpus/upload',
            data={'file': (None, '')},
            content_type='multipart/form-data'
        )
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertFalse(data['success'])
    
    def test_upload_invalid_file_type(self):
        response = self.client.post('/api/corpus/upload',
            data={'file': (None, 'test.exe')},
            content_type='multipart/form-data'
        )
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertFalse(data['success'])


class TestModels(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        
        with self.app.app_context():
            db.create_all()
    
    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
    
    def test_corpus_creation(self):
        with self.app.app_context():
            doc = Corpus(
                doc_id='test_001',
                content='测试文档内容',
                metadata='{"source": "test"}'
            )
            db.session.add(doc)
            db.session.commit()
            
            retrieved = Corpus.query.first()
            self.assertEqual(retrieved.doc_id, 'test_001')
            self.assertEqual(retrieved.content, '测试文档内容')
    
    def test_corpus_to_dict(self):
        with self.app.app_context():
            doc = Corpus(
                doc_id='test_001',
                content='内容',
                metadata='{}'
            )
            db.session.add(doc)
            db.session.commit()
            
            doc_dict = doc.to_dict()
            self.assertIn('id', doc_dict)
            self.assertIn('doc_id', doc_dict)
            self.assertIn('content', doc_dict)
            self.assertIn('created_at', doc_dict)
    
    def test_vector_version_creation(self):
        with self.app.app_context():
            vv = VectorVersion(
                version_name='v1_test',
                tokenizer='jieba',
                stopword_lang='chinese',
                vectorization='tfidf',
                normalize=True,
                dimensions=100,
                vocabulary_size=50
            )
            db.session.add(vv)
            db.session.commit()
            
            retrieved = VectorVersion.query.first()
            self.assertEqual(retrieved.version_name, 'v1_test')
            self.assertEqual(retrieved.dimensions, 100)
    
    def test_query_record_creation(self):
        with self.app.app_context():
            vv = VectorVersion(version_name='v1', tokenizer='jieba', stopword_lang='chinese',
                               vectorization='tfidf', normalize=True, dimensions=100, vocabulary_size=50)
            db.session.add(vv)
            db.session.flush()
            
            qr = QueryRecord(
                query_text='测试查询',
                vector_version_id=vv.id,
                top_k=5
            )
            db.session.add(qr)
            db.session.commit()
            
            retrieved = QueryRecord.query.first()
            self.assertEqual(retrieved.query_text, '测试查询')
            self.assertEqual(retrieved.top_k, 5)
    
    def test_annotation_creation(self):
        with self.app.app_context():
            doc = Corpus(doc_id='doc1', content='内容1', metadata='{}')
            db.session.add(doc)
            db.session.flush()
            
            vv = VectorVersion(version_name='v1', tokenizer='jieba', stopword_lang='chinese',
                               vectorization='tfidf', normalize=True, dimensions=100, vocabulary_size=50)
            db.session.add(vv)
            db.session.flush()
            
            qr = QueryRecord(query_text='测试', vector_version_id=vv.id, top_k=5)
            db.session.add(qr)
            db.session.flush()
            
            anno = Annotation(
                query_record_id=qr.id,
                corpus_id=doc.id,
                relevance=2,
                notes='测试标注'
            )
            db.session.add(anno)
            db.session.commit()
            
            retrieved = Annotation.query.first()
            self.assertEqual(retrieved.relevance, 2)
            self.assertEqual(retrieved.notes, '测试标注')
    
    def test_relationships(self):
        with self.app.app_context():
            doc = Corpus(doc_id='doc1', content='内容', metadata='{}')
            db.session.add(doc)
            db.session.flush()
            
            vv = VectorVersion(version_name='v1', tokenizer='jieba', stopword_lang='chinese',
                               vectorization='tfidf', normalize=True, dimensions=100, vocabulary_size=50)
            db.session.add(vv)
            db.session.flush()
            
            qr = QueryRecord(query_text='测试', vector_version_id=vv.id, top_k=5)
            db.session.add(qr)
            db.session.flush()
            
            sim = SimilarityResult(
                query_record_id=qr.id,
                corpus_id=doc.id,
                similarity_score=0.85,
                rank=1
            )
            db.session.add(sim)
            db.session.commit()
            
            qr = QueryRecord.query.first()
            self.assertEqual(len(qr.results), 1)
            self.assertEqual(qr.results[0].similarity_score, 0.85)


if __name__ == '__main__':
    unittest.main()
