from dataclasses import dataclass
from typing import List, Tuple, Optional
import numpy as np


@dataclass
class ClassificationResult:
    class_name: str
    class_index: int
    confidence: float
    top_k: List[Tuple[str, int, float]]


class ClassificationSimulator:
    
    def __init__(self, class_labels: List[str] = None):
        if class_labels is None:
            self.class_labels = [
                "airplane", "automobile", "bird", "cat", "deer",
                "dog", "frog", "horse", "ship", "truck"
            ]
        else:
            self.class_labels = class_labels
    
    def simulate_inference(
        self,
        feature_vector_size: int,
        top_k: int = 5
    ) -> ClassificationResult:
        np.random.seed(hash(feature_vector_size) % 4294967295)
        
        logits = np.random.randn(len(self.class_labels))
        probs = np.exp(logits - np.max(logits))
        probs = probs / np.sum(probs)
        
        top_indices = np.argsort(probs)[::-1][:top_k]
        top_k_results = [
            (self.class_labels[i], int(i), float(probs[i])) for i in top_indices]
        ]
        
        return ClassificationResult(
            class_name=top_k_results[0][0],
            class_index=top_k_results[0][1],
            confidence=top_k_results[0][2],
            top_k=top_k_results
        )
    
    def set_class_labels(self, labels: List[str]):
        self.class_labels = labels
