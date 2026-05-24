import hashlib
from typing import List, Dict, Tuple
from collections import defaultdict
from fuzzywuzzy import fuzz

from .types import FailureRecord, FailureCluster, NormalizedSignature
from .config import ClusterConfig
from .normalizer import SignatureNormalizer


class FailureClusterer:
    def __init__(self, config: ClusterConfig):
        self.config = config
        self.normalizer = SignatureNormalizer(config)

    def cluster(self, records: List[FailureRecord]) -> Tuple[List[FailureCluster], List[FailureRecord]]:
        if not records:
            return [], []

        signatures: Dict[str, NormalizedSignature] = {}
        for record in records:
            signatures[record.id] = self.normalizer.normalize(record)

        clusters = self._hash_based_cluster(records, signatures)
        clusters = self._merge_similar_clusters(clusters, signatures)

        final_clusters = []
        unclustered = []

        for cluster in clusters:
            if len(cluster) >= self.config.min_cluster_size:
                final_cluster = self._build_failure_cluster(cluster, signatures)
                final_clusters.append(final_cluster)
            else:
                unclustered.extend(cluster)

        final_clusters.sort(key=lambda c: (-c.size, c.cluster_id))

        return final_clusters, unclustered

    def _hash_based_cluster(
        self, records: List[FailureRecord], signatures: Dict[str, NormalizedSignature]
    ) -> List[List[FailureRecord]]:
        hash_groups: Dict[str, List[FailureRecord]] = defaultdict(list)

        for record in records:
            sig = signatures[record.id]
            hash_groups[sig.signature_hash].append(record)

        return list(hash_groups.values())

    def _merge_similar_clusters(
        self, clusters: List[List[FailureRecord]], signatures: Dict[str, NormalizedSignature]
    ) -> List[List[FailureRecord]]:
        if len(clusters) <= 1:
            return clusters

        cluster_signatures: List[NormalizedSignature] = []
        for cluster in clusters:
            representative = cluster[0]
            cluster_signatures.append(signatures[representative.id])

        merged = clusters.copy()
        changed = True

        while changed:
            changed = False
            for i in range(len(merged)):
                for j in range(i + 1, len(merged)):
                    if merged[i] is None or merged[j] is None:
                        continue

                    sig_i = signatures[merged[i][0].id]
                    sig_j = signatures[merged[j][0].id]

                    similarity = self._signature_similarity(sig_i, sig_j)

                    if similarity >= self.config.similarity_threshold:
                        merged[i].extend(merged[j])
                        merged[j] = None
                        changed = True

            merged = [c for c in merged if c is not None]

        return merged

    def _signature_similarity(self, sig1: NormalizedSignature, sig2: NormalizedSignature) -> float:
        if sig1.error_type and sig2.error_type and sig1.error_type != sig2.error_type:
            return 0.0

        error_sim = fuzz.token_sort_ratio(sig1.normalized_error, sig2.normalized_error) / 100.0

        tokens1 = set(sig1.tokens)
        tokens2 = set(sig2.tokens)
        if tokens1 or tokens2:
            token_sim = len(tokens1 & tokens2) / len(tokens1 | tokens2)
        else:
            token_sim = 0.0

        stack_sim = 0.0
        if sig1.normalized_stack and sig2.normalized_stack:
            stack_sim = fuzz.token_sort_ratio(sig1.normalized_stack, sig2.normalized_stack) / 100.0

        weights = [0.5, 0.3, 0.2]
        scores = [error_sim, token_sim, stack_sim]

        total = sum(w * s for w, s in zip(weights, scores))
        return total

    def _build_failure_cluster(
        self, members: List[FailureRecord], signatures: Dict[str, NormalizedSignature]
    ) -> FailureCluster:
        representative = members[0]
        signature = signatures[representative.id]

        cluster_id = self._generate_cluster_id(signature, members)

        jitter_score = self._calculate_jitter(members)
        matrix_coverage = self._calculate_matrix_coverage(members)

        return FailureCluster(
            cluster_id=cluster_id,
            signature=signature,
            members=members,
            jitter_score=jitter_score,
            matrix_coverage=matrix_coverage,
        )

    def _generate_cluster_id(self, signature: NormalizedSignature, members: List[FailureRecord]) -> str:
        content = f"{signature.signature_hash}:{len(members)}:{signature.error_type or 'unknown'}"
        return hashlib.md5(content.encode()).hexdigest()[:8]

    def _calculate_jitter(self, members: List[FailureRecord]) -> float:
        if len(members) < 2:
            return 0.0

        window_size = self.config.jitter_window_size
        recent_members = members[-window_size:] if len(members) > window_size else members

        unique_commits = len(set(m.commit_sha for m in recent_members))
        unique_jobs = len(set(m.job_name for m in recent_members))

        commit_diversity = unique_commits / len(recent_members)
        job_diversity = unique_jobs / len(recent_members)

        jitter = (commit_diversity + job_diversity) / 2
        return round(jitter, 3)

    def _calculate_matrix_coverage(self, members: List[FailureRecord]) -> Dict[str, Dict]:
        coverage: Dict[str, Dict] = {}

        for member in members:
            matrix = member.matrix_params.to_dict()
            for key, value in matrix.items():
                if key not in coverage:
                    coverage[key] = {}
                str_value = str(value)
                coverage[key][str_value] = coverage[key].get(str_value, 0) + 1

        result = {}
        for dim, values in coverage.items():
            total = sum(values.values())
            result[dim] = {
                "values": values,
                "unique_count": len(values),
                "most_common": max(values.items(), key=lambda x: x[1])[0],
                "coverage_percent": round((len(values) / max(len(values), 1)) * 100, 1),
            }

        return result
