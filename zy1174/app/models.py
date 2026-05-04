from datetime import datetime
from app import db

class Corpus(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    doc_id = db.Column(db.String(100), unique=True, nullable=False)
    content = db.Column(db.Text, nullable=False)
    metadata = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'doc_id': self.doc_id,
            'content': self.content,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class VectorVersion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    version_name = db.Column(db.String(100), nullable=False)
    tokenizer = db.Column(db.String(50), default='jieba')
    stopword_lang = db.Column(db.String(50), default='chinese')
    vectorization = db.Column(db.String(50), default='tfidf')
    normalize = db.Column(db.Boolean, default=True)
    dimensions = db.Column(db.Integer)
    vocabulary_size = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'version_name': self.version_name,
            'tokenizer': self.tokenizer,
            'stopword_lang': self.stopword_lang,
            'vectorization': self.vectorization,
            'normalize': self.normalize,
            'dimensions': self.dimensions,
            'vocabulary_size': self.vocabulary_size,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class QueryRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    query_text = db.Column(db.Text, nullable=False)
    vector_version_id = db.Column(db.Integer, db.ForeignKey('vector_version.id'))
    top_k = db.Column(db.Integer, default=5)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    vector_version = db.relationship('VectorVersion', backref='queries')
    
    def to_dict(self):
        return {
            'id': self.id,
            'query_text': self.query_text,
            'vector_version_id': self.vector_version_id,
            'top_k': self.top_k,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class SimilarityResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    query_record_id = db.Column(db.Integer, db.ForeignKey('query_record.id'))
    corpus_id = db.Column(db.Integer, db.ForeignKey('corpus.id'))
    similarity_score = db.Column(db.Float, nullable=False)
    rank = db.Column(db.Integer, nullable=False)
    
    query_record = db.relationship('QueryRecord', backref='results')
    corpus = db.relationship('Corpus', backref='results')
    
    def to_dict(self):
        return {
            'id': self.id,
            'query_record_id': self.query_record_id,
            'corpus_id': self.corpus_id,
            'similarity_score': self.similarity_score,
            'rank': self.rank
        }

class Annotation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    query_record_id = db.Column(db.Integer, db.ForeignKey('query_record.id'))
    corpus_id = db.Column(db.Integer, db.ForeignKey('corpus.id'))
    relevance = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    query_record = db.relationship('QueryRecord', backref='annotations')
    corpus = db.relationship('Corpus', backref='annotations')
    
    def to_dict(self):
        return {
            'id': self.id,
            'query_record_id': self.query_record_id,
            'corpus_id': self.corpus_id,
            'relevance': self.relevance,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
