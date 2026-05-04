import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'vector-retrieval-lab-2024'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024
    
    ALLOWED_EXTENSIONS = {'csv', 'jsonl', 'txt'}
    
    DEFAULT_TOKENIZER = 'jieba'
    DEFAULT_STOPWORD_LANG = 'chinese'
    DEFAULT_VECTORIZATION = 'tfidf'
    DEFAULT_NORMALIZE = True
    DEFAULT_TOP_K = 5
    DEFAULT_SIMILARITY_METRIC = 'cosine'
    
    RANDOM_SEED = 42
