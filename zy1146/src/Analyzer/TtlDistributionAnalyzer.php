<?php

namespace CacheAnalyzer\Analyzer;

use CacheAnalyzer\Model\CacheEvent;
use Exception;

class TtlDistributionAnalyzer implements AnalyzerInterface
{
    public function getName(): string
    {
        return 'TTL Distribution Analyzer';
    }
    
    public function getDescription(): string
    {
        return 'Analyzes TTL distribution, clustering, and expiration patterns';
    }
    
    /**
     * @param CacheEvent[] $events
     * @param array $options
     * @return array
     */
    public function analyze(array $events, array $options = []): array
    {
        $ttlValues = [];
        $ttlByBackend = [];
        $ttlByKey = [];
        $expireTimestamps = [];
        $setEvents = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            $type = $event->getType();
            $ttl = $event->getTtl();
            $backend = $event->getBackend();
            $key = $event->getKey();
            $timestamp = $event->getTimestamp();
            
            if ($type === CacheEvent::TYPE_SET && $ttl !== null) {
                $ttlValues[] = $ttl;
                
                if (!isset($ttlByBackend[$backend])) {
                    $ttlByBackend[$backend] = [];
                }
                $ttlByBackend[$backend][] = $ttl;
                
                if (!isset($ttlByKey[$key])) {
                    $ttlByKey[$key] = [];
                }
                $ttlByKey[$key][] = $ttl;
                
                $setEvents[] = [
                    'key' => $key,
                    'backend' => $backend,
                    'ttl' => $ttl,
                    'set_timestamp' => $timestamp,
                    'expire_timestamp' => $timestamp + $ttl,
                ];
                
                $expireTimestamps[] = $timestamp + $ttl;
            }
        }
        
        if (empty($ttlValues)) {
            return [
                'summary' => [
                    'has_ttl_data' => false,
                    'message' => 'No TTL data found in cache events',
                ],
            ];
        }
        
        sort($ttlValues);
        
        $distribution = $this->calculateDistribution($ttlValues);
        $clustering = $this->analyzeClustering($ttlValues);
        $expirePatterns = $this->analyzeExpirePatterns($expireTimestamps, $setEvents);
        $backendComparison = $this->compareBackendTtls($ttlByBackend);
        
        return [
            'summary' => [
                'has_ttl_data' => true,
                'total_ttl_events' => count($ttlValues),
                'unique_keys_with_ttl' => count($ttlByKey),
                'backends_with_ttl' => array_keys($ttlByBackend),
            ],
            'distribution' => $distribution,
            'clustering' => $clustering,
            'expire_patterns' => $expirePatterns,
            'by_backend' => $backendComparison,
            'recommendations' => $this->generateRecommendations($distribution, $clustering, $expirePatterns),
        ];
    }
    
    private function calculateDistribution(array $ttlValues): array
    {
        $count = count($ttlValues);
        $sum = array_sum($ttlValues);
        
        $buckets = $this->createTtlBuckets($ttlValues);
        
        $percentiles = [];
        foreach ([10, 25, 50, 75, 90, 95, 99] as $p) {
            $percentiles["p{$p}"] = $this->getPercentile($ttlValues, $p);
        }
        
        return [
            'count' => $count,
            'min' => min($ttlValues),
            'max' => max($ttlValues),
            'mean' => $sum / $count,
            'median' => $this->getMedian($ttlValues),
            'percentiles' => $percentiles,
            'standard_deviation' => $this->getStdDev($ttlValues, $sum / $count),
            'buckets' => $buckets,
            'formatted' => [
                'min' => $this->formatTtl(min($ttlValues)),
                'max' => $this->formatTtl(max($ttlValues)),
                'mean' => $this->formatTtl((int) ($sum / $count)),
                'median' => $this->formatTtl($this->getMedian($ttlValues)),
            ],
        ];
    }
    
    private function createTtlBuckets(array $ttlValues): array
    {
        $buckets = [
            '0s-1m' => ['min' => 0, 'max' => 60, 'count' => 0],
            '1m-10m' => ['min' => 60, 'max' => 600, 'count' => 0],
            '10m-1h' => ['min' => 600, 'max' => 3600, 'count' => 0],
            '1h-6h' => ['min' => 3600, 'max' => 21600, 'count' => 0],
            '6h-1d' => ['min' => 21600, 'max' => 86400, 'count' => 0],
            '1d-7d' => ['min' => 86400, 'max' => 604800, 'count' => 0],
            '7d+' => ['min' => 604800, 'max' => PHP_INT_MAX, 'count' => 0],
        ];
        
        foreach ($ttlValues as $ttl) {
            foreach ($buckets as $name => &$bucket) {
                if ($ttl >= $bucket['min'] && $ttl < $bucket['max']) {
                    $bucket['count']++;
                    break;
                }
            }
        }
        
        $total = count($ttlValues);
        foreach ($buckets as &$bucket) {
            $bucket['percentage'] = $total > 0 ? round($bucket['count'] / $total * 100, 2) : 0;
        }
        
        return $buckets;
    }
    
    private function analyzeClustering(array $ttlValues): array
    {
        $frequency = array_count_values($ttlValues);
        arsort($frequency);
        
        $total = count($ttlValues);
        $commonTtls = [];
        $clusteredCount = 0;
        
        foreach ($frequency as $ttl => $count) {
            $percentage = $count / $total * 100;
            if ($percentage >= 1) {
                $commonTtls[] = [
                    'ttl_seconds' => $ttl,
                    'ttl_formatted' => $this->formatTtl($ttl),
                    'count' => $count,
                    'percentage' => round($percentage, 2),
                ];
                $clusteredCount += $count;
            }
        }
        
        $topTtls = array_slice($commonTtls, 0, 10);
        $clusteredPercentage = $total > 0 ? $clusteredCount / $total * 100 : 0;
        
        $level = 'low';
        if ($clusteredPercentage > 60) {
            $level = 'high';
        } elseif ($clusteredPercentage > 30) {
            $level = 'medium';
        }
        
        return [
            'level' => $level,
            'clustered_count' => $clusteredCount,
            'clustered_percentage' => round($clusteredPercentage, 2),
            'top_common_ttls' => $topTtls,
            'unique_ttl_values' => count($frequency),
            'entropy' => $this->calculateTtlEntropy($frequency, $total),
        ];
    }
    
    private function analyzeExpirePatterns(array $expireTimestamps, array $setEvents): array
    {
        if (empty($expireTimestamps)) {
            return [
                'has_clusters' => false,
                'message' => 'No expiration timestamps to analyze',
            ];
        }
        
        sort($expireTimestamps);
        
        $clusters = [];
        $windowSize = 60;
        $minClusterSize = 5;
        
        $currentCluster = [];
        $clusterStart = null;
        
        foreach ($expireTimestamps as $ts) {
            if ($clusterStart === null) {
                $clusterStart = $ts;
                $currentCluster = [$ts];
            } elseif ($ts - $clusterStart <= $windowSize) {
                $currentCluster[] = $ts;
            } else {
                if (count($currentCluster) >= $minClusterSize) {
                    $clusters[] = [
                        'start_time' => $clusterStart,
                        'end_time' => $currentCluster[array_key_last($currentCluster)],
                        'duration_seconds' => $currentCluster[array_key_last($currentCluster)] - $clusterStart,
                        'key_count' => count($currentCluster),
                    ];
                }
                $clusterStart = $ts;
                $currentCluster = [$ts];
            }
        }
        
        if (count($currentCluster) >= $minClusterSize) {
            $clusters[] = [
                'start_time' => $clusterStart,
                'end_time' => $currentCluster[array_key_last($currentCluster)],
                'duration_seconds' => $currentCluster[array_key_last($currentCluster)] - $clusterStart,
                'key_count' => count($currentCluster),
            ];
        }
        
        $maxClusterSize = 0;
        foreach ($clusters as $cluster) {
            if ($cluster['key_count'] > $maxClusterSize) {
                $maxClusterSize = $cluster['key_count'];
            }
        }
        
        $riskLevel = 'low';
        if ($maxClusterSize > 20) {
            $riskLevel = 'critical';
        } elseif ($maxClusterSize > 10) {
            $riskLevel = 'high';
        } elseif ($maxClusterSize >= 5) {
            $riskLevel = 'medium';
        }
        
        return [
            'has_clusters' => !empty($clusters),
            'cluster_count' => count($clusters),
            'max_cluster_size' => $maxClusterSize,
            'risk_level' => $riskLevel,
            'clusters' => array_slice($clusters, 0, 10),
        ];
    }
    
    private function compareBackendTtls(array $ttlByBackend): array
    {
        $results = [];
        
        foreach ($ttlByBackend as $backend => $ttls) {
            sort($ttls);
            $count = count($ttls);
            $sum = array_sum($ttls);
            
            $results[$backend] = [
                'count' => $count,
                'min' => min($ttls),
                'max' => max($ttls),
                'mean' => $sum / $count,
                'median' => $this->getMedian($ttls),
                'formatted' => [
                    'min' => $this->formatTtl(min($ttls)),
                    'max' => $this->formatTtl(max($ttls)),
                    'mean' => $this->formatTtl((int) ($sum / $count)),
                ],
            ];
        }
        
        return $results;
    }
    
    private function calculateTtlEntropy(array $frequency, int $total): float
    {
        if ($total === 0) {
            return 0.0;
        }
        
        $entropy = 0.0;
        foreach ($frequency as $count) {
            $p = $count / $total;
            if ($p > 0) {
                $entropy -= $p * log($p);
            }
        }
        
        return round($entropy, 4);
    }
    
    private function getPercentile(array $sortedArray, float $percentile): int
    {
        $count = count($sortedArray);
        if ($count === 0) {
            return 0;
        }
        
        $index = (int) ceil(($percentile / 100) * $count) - 1;
        $index = max(0, min($index, $count - 1));
        
        return (int) $sortedArray[$index];
    }
    
    private function getMedian(array $sortedArray): int
    {
        $count = count($sortedArray);
        if ($count === 0) {
            return 0;
        }
        
        $mid = (int) floor(($count - 1) / 2);
        
        if ($count % 2) {
            return (int) $sortedArray[$mid];
        }
        
        return (int) (($sortedArray[$mid] + $sortedArray[$mid + 1]) / 2);
    }
    
    private function getStdDev(array $values, float $mean): float
    {
        $count = count($values);
        if ($count < 2) {
            return 0.0;
        }
        
        $variance = 0.0;
        foreach ($values as $value) {
            $variance += pow($value - $mean, 2);
        }
        
        return sqrt($variance / ($count - 1));
    }
    
    private function formatTtl(int $seconds): string
    {
        if ($seconds < 60) {
            return $seconds . 's';
        } elseif ($seconds < 3600) {
            return round($seconds / 60) . 'm';
        } elseif ($seconds < 86400) {
            return round($seconds / 3600) . 'h';
        } elseif ($seconds < 604800) {
            return round($seconds / 86400) . 'd';
        } else {
            return round($seconds / 604800) . 'w';
        }
    }
    
    private function generateRecommendations(array $distribution, array $clustering, array $expirePatterns): array
    {
        $recommendations = [];
        
        if (isset($clustering['level']) && $clustering['level'] !== 'low') {
            $severity = $clustering['level'] === 'high' ? 'high' : 'medium';
            $recommendations[] = [
                'type' => 'ttl_clustering',
                'severity' => $severity,
                'message' => sprintf(
                    'TTL values are highly clustered: %.2f%% of keys use only %d common TTL values',
                    $clustering['clustered_percentage'] ?? 0,
                    count($clustering['top_common_ttls'] ?? [])
                ),
                'recommendation' => 'Add random jitter to TTL values to distribute expiration times. Use formula: base_ttl + rand(-max_jitter, +max_jitter). Recommended jitter: 10-20% of base TTL.',
            ];
        }
        
        if (isset($expirePatterns['risk_level']) && $expirePatterns['risk_level'] !== 'low') {
            $severity = $expirePatterns['risk_level'] === 'critical' ? 'critical' : 
                       ($expirePatterns['risk_level'] === 'high' ? 'high' : 'medium');
            $recommendations[] = [
                'type' => 'expire_clustering',
                'severity' => $severity,
                'message' => sprintf(
                    'Detected %d expiration clusters with max size %d keys',
                    $expirePatterns['cluster_count'] ?? 0,
                    $expirePatterns['max_cluster_size'] ?? 0
                ),
                'recommendation' => 'Keys expire in clusters, risking cache avalanche. Apply TTL jitter immediately. Consider tiered expiration or pre-warming critical keys.',
            ];
        }
        
        if (isset($distribution['buckets'])) {
            $shortTermCount = ($distribution['buckets']['0s-1m']['count'] ?? 0) + 
                              ($distribution['buckets']['1m-10m']['count'] ?? 0);
            $total = $distribution['count'] ?? 0;
            
            if ($total > 0 && $shortTermCount / $total > 0.5) {
                $recommendations[] = [
                    'type' => 'short_ttl',
                    'severity' => 'medium',
                    'message' => sprintf(
                        'Over 50%% of keys have very short TTL (<10min). This may cause frequent cache misses.',
                    ),
                    'recommendation' => 'Review short TTL usage. Consider if data really needs such frequent refresh. For hot keys with short TTL, consider stale-while-revalidate pattern.',
                ];
            }
        }
        
        return $recommendations;
    }
}
