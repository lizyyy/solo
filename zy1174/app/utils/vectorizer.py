import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize
from app.utils.tokenizer import TextProcessor

class TFIDFVectorizer:
    def __init__(self, tokenizer_type: str = 'jieba', stopword_lang: str = 'chinese',
                 max_features: Optional[int] = 10000, ngram_range: Tuple[int, int] = (1, 1),
                 custom_stopwords: Optional[List[str]] = None):
        self.tokenizer_type = tokenizer_type
        self.stopword_lang = stopword_lang
        self.max_features = max_features
        self.ngram_range = ngram_range
        self.custom_stopwords = custom_stopwords
        
        self.processor = TextProcessor(tokenizer_type, stopword_lang, custom_stopwords)
        self.vectorizer = None
        self.vocabulary_ = None
        self.idf_ = None
        self.is_fitted = False
    
    def _tokenize(self, text: str) -> List[str]:
        return self.processor.process(text)
    
    def fit(self, documents: List[str]) -> 'TFIDFVectorizer':
        self.vectorizer = TfidfVectorizer(
            tokenizer=self._tokenize,
            token_pattern=None,
            max_features=self.max_features,
            ngram_range=self.ngram_range,
            lowercase=True
        )
        
        self.vectorizer.fit(documents)
        self.vocabulary_ = self.vectorizer.vocabulary_
        self.idf_ = self.vectorizer.idf_
        self.is_fitted = True
        
        return self
    
    def transform(self, documents: List[str], normalize_vectors: bool = True) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Vectorizer not fitted. Call fit() first.")
        
        vectors = self.vectorizer.transform(documents).toarray()
        
        if normalize_vectors and vectors.shape[0] > 0 and vectors.shape[1] > 0:
            vectors = normalize(vectors, norm='l2', axis=1)
        
        return vectors
    
    def fit_transform(self, documents: List[str], normalize_vectors: bool = True) -> np.ndarray:
        self.fit(documents)
        return self.transform(documents, normalize_vectors)
    
    def get_feature_names(self) -> List[str]:
        if not self.is_fitted:
            raise RuntimeError("Vectorizer not fitted.")
        
        return self.vectorizer.get_feature_names_out().tolist()
    
    def get_top_features(self, vector: np.ndarray, top_k: int = 10) -> List[Tuple[str, float]]:
        if not self.is_fitted:
            raise RuntimeError("Vectorizer not fitted.")
        
        feature_names = self.get_feature_names()
        indices = np.argsort(vector)[::-1][:top_k]
        
        return [(feature_names[i], float(vector[i])) for i in indices if vector[i] > 0]
    
    def get_vocabulary_size(self) -> int:
        return len(self.vocabulary_) if self.vocabulary_ else 0
    
    def get_dimensions(self) -> int:
        if not self.is_fitted:
            raise RuntimeError("Vectorizer not fitted.")
        
        return len(self.vocabulary_)

class SimpleEmbeddingVectorizer:
    def __init__(self, tokenizer_type: str = 'jieba', stopword_lang: str = 'chinese',
                 embedding_dim: int = 100, custom_stopwords: Optional[List[str]] = None,
                 random_seed: int = 42):
        self.tokenizer_type = tokenizer_type
        self.stopword_lang = stopword_lang
        self.embedding_dim = embedding_dim
        self.custom_stopwords = custom_stopwords
        self.random_seed = random_seed
        
        self.processor = TextProcessor(tokenizer_type, stopword_lang, custom_stopwords)
        self.word_embeddings = {}
        self.vocabulary_ = {}
        self.is_fitted = False
        
        np.random.seed(random_seed)
    
    def fit(self, documents: List[str]) -> 'SimpleEmbeddingVectorizer':
        all_tokens = set()
        
        for doc in documents:
            tokens = self.processor.process(doc)
            all_tokens.update(tokens)
        
        self.vocabulary_ = {token: idx for idx, token in enumerate(sorted(all_tokens))}
        
        for token in self.vocabulary_:
            self.word_embeddings[token] = np.random.randn(self.embedding_dim).astype(np.float32)
        
        self.is_fitted = True
        
        return self
    
    def transform(self, documents: List[str], normalize_vectors: bool = True) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Vectorizer not fitted. Call fit() first.")
        
        vectors = []
        
        for doc in documents:
            tokens = self.processor.process(doc)
            
            if not tokens:
                vectors.append(np.zeros(self.embedding_dim, dtype=np.float32))
                continue
            
            token_embeddings = []
            for token in tokens:
                if token in self.word_embeddings:
                    token_embeddings.append(self.word_embeddings[token])
            
            if not token_embeddings:
                vectors.append(np.zeros(self.embedding_dim, dtype=np.float32))
            else:
                doc_embedding = np.mean(token_embeddings, axis=0)
                vectors.append(doc_embedding)
        
        vectors = np.array(vectors, dtype=np.float32)
        
        if normalize_vectors and vectors.shape[0] > 0:
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            norms[norms == 0] = 1
            vectors = vectors / norms
        
        return vectors
    
    def fit_transform(self, documents: List[str], normalize_vectors: bool = True) -> np.ndarray:
        self.fit(documents)
        return self.transform(documents, normalize_vectors)
    
    def get_vocabulary_size(self) -> int:
        return len(self.vocabulary_)
    
    def get_dimensions(self) -> int:
        return self.embedding_dim
    
    def get_top_tokens_for_vector(self, vector: np.ndarray, top_k: int = 10) -> List[Tuple[str, float]]:
        if not self.is_fitted:
            raise RuntimeError("Vectorizer not fitted.")
        
        token_similarities = []
        for token, embedding in self.word_embeddings.items():
            similarity = np.dot(vector, embedding) / (
                np.linalg.norm(vector) * np.linalg.norm(embedding) + 1e-10
            )
            token_similarities.append((token, float(similarity)))
        
        token_similarities.sort(key=lambda x: x[1], reverse=True)
        return token_similarities[:top_k]

class VectorizerFactory:
    @staticmethod
    def create(vectorization_type: str, **kwargs) -> Any:
        vectorization_type = vectorization_type.lower()
        
        if vectorization_type == 'tfidf':
            return TFIDFVectorizer(**kwargs)
        elif vectorization_type == 'embedding':
            return SimpleEmbeddingVectorizer(**kwargs)
        else:
            raise ValueError(f"Unknown vectorization type: {vectorization_type}")
