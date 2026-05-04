import numpy as np
from typing import List, Tuple, Optional, Dict, Any
from sklearn.metrics.pairwise import cosine_similarity

def normalize_vectors(vectors: np.ndarray, norm: str = 'l2') -> np.ndarray:
    if vectors.ndim == 1:
        vectors = vectors.reshape(1, -1)
    
    if norm == 'l2':
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return vectors / norms
    elif norm == 'l1':
        norms = np.sum(np.abs(vectors), axis=1, keepdims=True)
        norms[norms == 0] = 1
        return vectors / norms
    else:
        return vectors

def cosine_similarity_matrix(vectors1: np.ndarray, vectors2: Optional[np.ndarray] = None) -> np.ndarray:
    if vectors2 is None:
        vectors2 = vectors1
    
    if vectors1.ndim == 1:
        vectors1 = vectors1.reshape(1, -1)
    if vectors2.ndim == 1:
        vectors2 = vectors2.reshape(1, -1)
    
    return cosine_similarity(vectors1, vectors2)

def dot_product_similarity(vectors1: np.ndarray, vectors2: Optional[np.ndarray] = None) -> np.ndarray:
    if vectors2 is None:
        vectors2 = vectors1
    
    if vectors1.ndim == 1:
        vectors1 = vectors1.reshape(1, -1)
    if vectors2.ndim == 1:
        vectors2 = vectors2.reshape(1, -1)
    
    return np.dot(vectors1, vectors2.T)

class SimilarityCalculator:
    def __init__(self, metric: str = 'cosine'):
        self.metric = metric.lower()
    
    def calculate(self, query_vector: np.ndarray, corpus_vectors: np.ndarray) -> np.ndarray:
        if self.metric == 'cosine':
            return cosine_similarity(query_vector.reshape(1, -1), corpus_vectors).flatten()
        elif self.metric == 'dot':
            return np.dot(corpus_vectors, query_vector)
        elif self.metric == 'euclidean':
            return -np.linalg.norm(corpus_vectors - query_vector, axis=1)
        else:
            return cosine_similarity(query_vector.reshape(1, -1), corpus_vectors).flatten()
    
    def calculate_matrix(self, vectors: np.ndarray) -> np.ndarray:
        if self.metric == 'cosine':
            return cosine_similarity_matrix(vectors)
        elif self.metric == 'dot':
            return dot_product_similarity(vectors)
        elif self.metric == 'euclidean':
            n = vectors.shape[0]
            matrix = np.zeros((n, n))
            for i in range(n):
                for j in range(n):
                    matrix[i, j] = -np.linalg.norm(vectors[i] - vectors[j])
            return matrix
        else:
            return cosine_similarity_matrix(vectors)

class VectorRetriever:
    def __init__(self, metric: str = 'cosine'):
        self.similarity_calculator = SimilarityCalculator(metric)
        self.corpus_vectors = None
        self.corpus_ids = None
        self.corpus_contents = None
    
    def index(self, vectors: np.ndarray, ids: Optional[List[Any]] = None, 
              contents: Optional[List[str]] = None) -> 'VectorRetriever':
        self.corpus_vectors = vectors
        
        if ids is not None:
            self.corpus_ids = ids
        else:
            self.corpus_ids = list(range(vectors.shape[0]))
        
        if contents is not None:
            self.corpus_contents = contents
        
        return self
    
    def search(self, query_vector: np.ndarray, top_k: int = 5) -> List[Dict[str, Any]]:
        if self.corpus_vectors is None:
            raise RuntimeError("Corpus not indexed. Call index() first.")
        
        similarities = self.similarity_calculator.calculate(query_vector, self.corpus_vectors)
        
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for rank, idx in enumerate(top_indices):
            result = {
                'index': int(idx),
                'id': self.corpus_ids[idx] if self.corpus_ids else idx,
                'similarity_score': float(similarities[idx]),
                'rank': rank + 1
            }
            if self.corpus_contents:
                result['content'] = self.corpus_contents[idx]
            results.append(result)
        
        return results
    
    def search_batch(self, query_vectors: np.ndarray, top_k: int = 5) -> List[List[Dict[str, Any]]]:
        if self.corpus_vectors is None:
            raise RuntimeError("Corpus not indexed. Call index() first.")
        
        all_results = []
        for i in range(query_vectors.shape[0]):
            results = self.search(query_vectors[i], top_k)
            all_results.append(results)
        
        return all_results
    
    def get_similarity_matrix(self) -> np.ndarray:
        if self.corpus_vectors is None:
            raise RuntimeError("Corpus not indexed. Call index() first.")
        
        return self.similarity_calculator.calculate_matrix(self.corpus_vectors)

class EvaluationMetrics:
    @staticmethod
    def precision_at_k(relevant_ids: List[Any], retrieved_ids: List[Any], k: int) -> float:
        retrieved_at_k = retrieved_ids[:k]
        relevant_retrieved = sum(1 for doc_id in retrieved_at_k if doc_id in relevant_ids)
        return relevant_retrieved / k if k > 0 else 0.0
    
    @staticmethod
    def recall_at_k(relevant_ids: List[Any], retrieved_ids: List[Any], k: int) -> float:
        if not relevant_ids:
            return 0.0
        
        retrieved_at_k = retrieved_ids[:k]
        relevant_retrieved = sum(1 for doc_id in retrieved_at_k if doc_id in relevant_ids)
        return relevant_retrieved / len(relevant_ids)
    
    @staticmethod
    def f1_score(precision: float, recall: float) -> float:
        if precision + recall == 0:
            return 0.0
        return 2 * precision * recall / (precision + recall)
    
    @staticmethod
    def mean_average_precision(relevant_ids_list: List[List[Any]], 
                                retrieved_ids_list: List[List[Any]],
                                k: Optional[int] = None) -> float:
        if not relevant_ids_list or not retrieved_ids_list:
            return 0.0
        
        aps = []
        for relevant_ids, retrieved_ids in zip(relevant_ids_list, retrieved_ids_list):
            if not relevant_ids:
                continue
            
            ap = 0.0
            num_relevant = 0
            
            for i, doc_id in enumerate(retrieved_ids[:k] if k else retrieved_ids):
                if doc_id in relevant_ids:
                    num_relevant += 1
                    precision = num_relevant / (i + 1)
                    ap += precision
            
            if num_relevant > 0:
                ap /= len(relevant_ids)
                aps.append(ap)
        
        return np.mean(aps) if aps else 0.0
    
    @staticmethod
    def reciprocal_rank(relevant_ids: List[Any], retrieved_ids: List[Any]) -> float:
        for rank, doc_id in enumerate(retrieved_ids, 1):
            if doc_id in relevant_ids:
                return 1.0 / rank
        return 0.0
    
    @staticmethod
    def mean_reciprocal_rank(relevant_ids_list: List[List[Any]],
                              retrieved_ids_list: List[List[Any]]) -> float:
        if not relevant_ids_list or not retrieved_ids_list:
            return 0.0
        
        rrs = [EvaluationMetrics.reciprocal_rank(rel, ret) 
               for rel, ret in zip(relevant_ids_list, retrieved_ids_list)]
        
        return np.mean(rrs) if rrs else 0.0
    
    @staticmethod
    def ndcg_at_k(relevance_scores: List[int], retrieved_ranks: List[int], k: int) -> float:
        def dcg(scores):
            return sum(score / np.log2(i + 2) for i, score in enumerate(scores[:k]))
        
        if not relevance_scores or len(relevance_scores) == 0:
            return 0.0
        
        actual_scores = [relevance_scores[rank] if rank < len(relevance_scores) else 0 
                         for rank in retrieved_ranks[:k]]
        
        ideal_scores = sorted(relevance_scores, reverse=True)[:k]
        
        actual_dcg = dcg(actual_scores)
        ideal_dcg = dcg(ideal_scores)
        
        if ideal_dcg == 0:
            return 0.0
        
        return actual_dcg / ideal_dcg

class VectorDimensionAnalyzer:
    def __init__(self, vectorizer: Any):
        self.vectorizer = vectorizer
        self.is_tfidf = hasattr(vectorizer, 'get_feature_names')
    
    def analyze_query_impact(self, query_vector: np.ndarray, top_k: int = 20) -> Dict[str, Any]:
        if self.is_tfidf:
            feature_names = self.vectorizer.get_feature_names()
            top_features = self.vectorizer.get_top_features(query_vector, top_k)
            
            return {
                'type': 'tfidf',
                'top_features': [{'feature': f, 'weight': w} for f, w in top_features],
                'total_dimensions': len(feature_names),
                'non_zero_dimensions': int(np.sum(query_vector > 0))
            }
        else:
            top_tokens = self.vectorizer.get_top_tokens_for_vector(query_vector, top_k)
            
            return {
                'type': 'embedding',
                'top_tokens': [{'token': t, 'similarity': s} for t, s in top_tokens],
                'total_dimensions': self.vectorizer.get_dimensions()
            }
    
    def analyze_corpus_dimensions(self, corpus_vectors: np.ndarray) -> Dict[str, Any]:
        mean_vector = np.mean(corpus_vectors, axis=0)
        std_vector = np.std(corpus_vectors, axis=0)
        
        variance_per_dim = np.var(corpus_vectors, axis=0)
        top_variance_indices = np.argsort(variance_per_dim)[::-1][:20]
        
        if self.is_tfidf:
            feature_names = self.vectorizer.get_feature_names()
            top_variance_features = [
                {'dimension': int(i), 'feature': feature_names[i] if i < len(feature_names) else str(i),
                 'variance': float(variance_per_dim[i])}
                for i in top_variance_indices
            ]
        else:
            top_variance_features = [
                {'dimension': int(i), 'variance': float(variance_per_dim[i])}
                for i in top_variance_indices
            ]
        
        return {
            'total_dimensions': corpus_vectors.shape[1],
            'num_documents': corpus_vectors.shape[0],
            'mean_vector_magnitude': float(np.linalg.norm(mean_vector)),
            'std_vector_magnitude': float(np.linalg.norm(std_vector)),
            'top_variance_dimensions': top_variance_features,
            'sparsity': float(np.mean(corpus_vectors == 0)) if self.is_tfidf else None
        }
