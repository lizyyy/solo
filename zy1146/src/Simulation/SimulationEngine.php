<?php

namespace CacheAnalyzer\Simulation;

use CacheAnalyzer\Model\CacheEvent;
use Exception;

class SimulationEngine
{
    public const STRATEGY_TTL_ADJUSTMENT = 'ttl_adjustment';
    public const STRATEGY_PREWARMING = 'prewarming';
    public const STRATEGY_MUTEX_LOCK = 'mutex_lock';
    public const STRATEGY_BLOOM_FILTER = 'bloom_filter';
    public const STRATEGY_STALE_WHILE_REVALIDATE = 'stale_while_revalidate';
    public const STRATEGY_KEY_TIERING = 'key_tiering';
    public const STRATEGY_TAG_INVALIDATION = 'tag_invalidation';
    public const STRATEGY_TTL_JITTER = 'ttl_jitter';
    public const STRATEGY_NEGATIVE_CACHING = 'negative_caching';
    
    private array $baselineMetrics = [];
    private array $simulatedEvents = [];
    
    public function __construct()
    {
    }
    
    public function setBaseline(array $events, array $metrics = []): void
    {
        $this->simulatedEvents = $events;
        
        if (empty($metrics)) {
            $this->baselineMetrics = $this->calculateMetrics($events);
        } else {
            $this->baselineMetrics = $metrics;
        }
    }
    
    public function getBaselineMetrics(): array
    {
        return $this->baselineMetrics;
    }
    
    public function simulateStrategy(string $strategy, array $parameters): array
    {
        $events = $this->simulatedEvents;
        
        switch ($strategy) {
            case self::STRATEGY_TTL_ADJUSTMENT:
                return $this->simulateTtlAdjustment($events, $parameters);
                
            case self::STRATEGY_PREWARMING:
                return $this->simulatePrewarming($events, $parameters);
                
            case self::STRATEGY_MUTEX_LOCK:
                return $this->simulateMutexLock($events, $parameters);
                
            case self::STRATEGY_BLOOM_FILTER:
                return $this->simulateBloomFilter($events, $parameters);
                
            case self::STRATEGY_STALE_WHILE_REVALIDATE:
                return $this->simulateStaleWhileRevalidate($events, $parameters);
                
            case self::STRATEGY_KEY_TIERING:
                return $this->simulateKeyTiering($events, $parameters);
                
            case self::STRATEGY_TAG_INVALIDATION:
                return $this->simulateTagInvalidation($events, $parameters);
                
            case self::STRATEGY_TTL_JITTER:
                return $this->simulateTtlJitter($events, $parameters);
                
            case self::STRATEGY_NEGATIVE_CACHING:
                return $this->simulateNegativeCaching($events, $parameters);
                
            default:
                throw new Exception(sprintf('Unknown strategy: %s', $strategy));
        }
    }
    
    public function compareStrategies(array $strategies): array
    {
        $results = [
            'baseline' => $this->baselineMetrics,
            'comparisons' => [],
        ];
        
        foreach ($strategies as $strategyConfig) {
            $strategy = $strategyConfig['strategy'];
            $parameters = $strategyConfig['parameters'] ?? [];
            
            $simulationResult = $this->simulateStrategy($strategy, $parameters);
            
            $comparison = $this->compareWithBaseline($simulationResult);
            
            $results['comparisons'][] = [
                'strategy' => $strategy,
                'parameters' => $parameters,
                'result' => $simulationResult,
                'comparison' => $comparison,
            ];
        }
        
        $results['recommendations'] = $this->generateComparisonRecommendations($results['comparisons']);
        
        return $results;
    }
    
    private function calculateMetrics(array $events): array
    {
        $hits = 0;
        $misses = 0;
        $sets = 0;
        $deletes = 0;
        
        $hitLatencies = [];
        $missLatencies = [];
        $sourceFetchTimes = [];
        
        $keyStats = [];
        $backendStats = [];
        
        $ttlValues = [];
        $expireTimestamps = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            $type = $event->getType();
            $key = $event->getKey();
            $backend = $event->getBackend();
            $latency = $event->getLatencyMs();
            $ttl = $event->getTtl();
            $timestamp = $event->getTimestamp();
            
            if ($type === CacheEvent::TYPE_HIT) {
                $hits++;
                if ($latency !== null) {
                    $hitLatencies[] = $latency;
                }
                
                if (!isset($keyStats[$key])) {
                    $keyStats[$key] = ['hits' => 0, 'misses' => 0];
                }
                $keyStats[$key]['hits']++;
                
                if (!isset($backendStats[$backend])) {
                    $backendStats[$backend] = ['hits' => 0, 'misses' => 0];
                }
                $backendStats[$backend]['hits']++;
                
            } elseif ($type === CacheEvent::TYPE_MISS) {
                $misses++;
                if ($latency !== null) {
                    $missLatencies[] = $latency;
                    $sourceFetchTimes[] = $latency * 10;
                }
                
                if (!isset($keyStats[$key])) {
                    $keyStats[$key] = ['hits' => 0, 'misses' => 0];
                }
                $keyStats[$key]['misses']++;
                
                if (!isset($backendStats[$backend])) {
                    $backendStats[$backend] = ['hits' => 0, 'misses' => 0];
                }
                $backendStats[$backend]['misses']++;
                
            } elseif ($type === CacheEvent::TYPE_SET) {
                $sets++;
                if ($ttl !== null) {
                    $ttlValues[] = $ttl;
                    $expireTimestamps[] = $timestamp + $ttl;
                }
            } elseif ($type === CacheEvent::TYPE_DELETE) {
                $deletes++;
            }
        }
        
        $totalRequests = $hits + $misses;
        $hitRate = $totalRequests > 0 ? $hits / $totalRequests : 0;
        
        $concurrentMisses = $this->calculateConcurrentMisses($events);
        $ttlClustering = $this->calculateTtlClustering($ttlValues);
        
        $estimatedSourceLoad = array_sum($sourceFetchTimes);
        
        return [
            'summary' => [
                'hits' => $hits,
                'misses' => $misses,
                'sets' => $sets,
                'deletes' => $deletes,
                'total_requests' => $totalRequests,
                'hit_rate' => $hitRate,
                'hit_rate_percent' => round($hitRate * 100, 2),
            ],
            'latency' => [
                'hit_latency_avg_ms' => !empty($hitLatencies) ? array_sum($hitLatencies) / count($hitLatencies) : null,
                'hit_latency_p50_ms' => $this->getPercentile($hitLatencies, 50),
                'hit_latency_p95_ms' => $this->getPercentile($hitLatencies, 95),
                'miss_latency_avg_ms' => !empty($missLatencies) ? array_sum($missLatencies) / count($missLatencies) : null,
                'estimated_source_load_ms' => $estimatedSourceLoad,
            ],
            'risks' => [
                'concurrent_miss_clusters' => $concurrentMisses,
                'ttl_clustering' => $ttlClustering,
            ],
            'by_key' => array_slice($keyStats, 0, 50),
            'by_backend' => $backendStats,
        ];
    }
    
    private function calculateConcurrentMisses(array $events): array
    {
        $missEvents = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            if ($event->getType() === CacheEvent::TYPE_MISS) {
                $missEvents[] = [
                    'key' => $event->getKey(),
                    'timestamp' => $event->getTimestamp(),
                ];
            }
        }
        
        if (empty($missEvents)) {
            return ['has_clusters' => false, 'clusters' => []];
        }
        
        usort($missEvents, function ($a, $b) {
            return $a['timestamp'] <=> $b['timestamp'];
        });
        
        $clusters = [];
        $windowSize = 1.0;
        $minClusterSize = 5;
        
        $currentCluster = [];
        $clusterStart = null;
        
        foreach ($missEvents as $event) {
            $ts = $event['timestamp'];
            
            if ($clusterStart === null) {
                $clusterStart = $ts;
                $currentCluster = [$event];
            } elseif ($ts - $clusterStart <= $windowSize) {
                $currentCluster[] = $event;
            } else {
                if (count($currentCluster) >= $minClusterSize) {
                    $clusters[] = [
                        'start_time' => $clusterStart,
                        'end_time' => $currentCluster[array_key_last($currentCluster)]['timestamp'],
                        'size' => count($currentCluster),
                        'sample_keys' => array_slice(array_column($currentCluster, 'key'), 0, 5),
                    ];
                }
                $clusterStart = $ts;
                $currentCluster = [$event];
            }
        }
        
        if (count($currentCluster) >= $minClusterSize) {
            $clusters[] = [
                'start_time' => $clusterStart,
                'end_time' => $currentCluster[array_key_last($currentCluster)]['timestamp'],
                'size' => count($currentCluster),
                'sample_keys' => array_slice(array_column($currentCluster, 'key'), 0, 5),
            ];
        }
        
        return [
            'has_clusters' => !empty($clusters),
            'cluster_count' => count($clusters),
            'max_cluster_size' => !empty($clusters) ? max(array_column($clusters, 'size')) : 0,
            'clusters' => $clusters,
        ];
    }
    
    private function calculateTtlClustering(array $ttlValues): array
    {
        if (empty($ttlValues)) {
            return ['is_clustered' => false, 'clustered_percentage' => 0];
        }
        
        $frequency = array_count_values($ttlValues);
        arsort($frequency);
        
        $total = count($ttlValues);
        $clusteredCount = 0;
        
        foreach ($frequency as $count) {
            $percentage = $count / $total * 100;
            if ($percentage >= 5) {
                $clusteredCount += $count;
            }
        }
        
        $clusteredPercentage = $clusteredCount / $total * 100;
        
        return [
            'is_clustered' => $clusteredPercentage > 30,
            'clustered_count' => $clusteredCount,
            'clustered_percentage' => round($clusteredPercentage, 2),
            'top_ttls' => array_slice($frequency, 0, 5, true),
        ];
    }
    
    private function simulateTtlAdjustment(array $events, array $parameters): array
    {
        $ttlMultiplier = $parameters['ttl_multiplier'] ?? 2.0;
        $maxTtl = $parameters['max_ttl'] ?? 86400;
        
        $modifiedEvents = [];
        $ttlChanges = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                $modifiedEvents[] = $event;
                continue;
            }
            
            $ttl = $event->getTtl();
            
            if ($event->getType() === CacheEvent::TYPE_SET && $ttl !== null) {
                $oldTtl = $ttl;
                $newTtl = min((int) ($ttl * $ttlMultiplier), $maxTtl);
                
                $ttlChanges[] = [
                    'old_ttl' => $oldTtl,
                    'new_ttl' => $newTtl,
                    'change_percent' => round(($newTtl - $oldTtl) / $oldTtl * 100, 2),
                ];
                
                $modifiedEvent = CacheEvent::fromArray([
                    'id' => $event->getId(),
                    'key' => $event->getKey(),
                    'type' => $event->getType(),
                    'backend' => $event->getBackend(),
                    'timestamp' => $event->getTimestamp(),
                    'latency_ms' => $event->getLatencyMs(),
                    'ttl' => $newTtl,
                    'size_bytes' => $event->getSizeBytes(),
                    'route' => $event->getRoute(),
                    'tags' => $event->getTags(),
                    'error' => $event->getError(),
                ]);
                
                $modifiedEvents[] = $modifiedEvent;
            } else {
                $modifiedEvents[] = $event;
            }
        }
        
        $simulatedMetrics = $this->calculateMetrics($modifiedEvents);
        
        $simulatedMetrics['simulation_info'] = [
            'strategy' => self::STRATEGY_TTL_ADJUSTMENT,
            'parameters' => $parameters,
            'events_modified' => count($ttlChanges),
            'avg_ttl_increase_percent' => !empty($ttlChanges) 
                ? round(array_sum(array_column($ttlChanges, 'change_percent')) / count($ttlChanges), 2) 
                : 0,
        ];
        
        return $simulatedMetrics;
    }
    
    private function simulatePrewarming(array $events, array $parameters): array
    {
        $prewarmKeys = $parameters['prewarm_keys'] ?? [];
        $prewarmRatio = $parameters['prewarm_ratio'] ?? 0.8;
        
        $keyAccessCounts = [];
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            $type = $event->getType();
            if (in_array($type, [CacheEvent::TYPE_HIT, CacheEvent::TYPE_MISS], true)) {
                $key = $event->getKey();
                if (!isset($keyAccessCounts[$key])) {
                    $keyAccessCounts[$key] = 0;
                }
                $keyAccessCounts[$key]++;
            }
        }
        
        arsort($keyAccessCounts);
        
        $hotKeyCount = (int) (count($keyAccessCounts) * $prewarmRatio);
        $keysToPrewarm = array_slice(array_keys($keyAccessCounts), 0, $hotKeyCount);
        
        if (!empty($prewarmKeys)) {
            $keysToPrewarm = array_unique(array_merge($keysToPrewarm, $prewarmKeys));
        }
        
        $simulatedEvents = [];
        $hitConversions = 0;
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                $simulatedEvents[] = $event;
                continue;
            }
            
            $type = $event->getType();
            $key = $event->getKey();
            
            if ($type === CacheEvent::TYPE_MISS && in_array($key, $keysToPrewarm, true)) {
                $hitConversions++;
                $simulatedEvent = CacheEvent::fromArray([
                    'id' => $event->getId(),
                    'key' => $event->getKey(),
                    'type' => CacheEvent::TYPE_HIT,
                    'backend' => $event->getBackend(),
                    'timestamp' => $event->getTimestamp(),
                    'latency_ms' => max(1, ($event->getLatencyMs() ?? 100) / 10),
                    'ttl' => $event->getTtl(),
                    'size_bytes' => $event->getSizeBytes(),
                    'route' => $event->getRoute(),
                    'tags' => $event->getTags(),
                    'error' => $event->getError(),
                ]);
                $simulatedEvents[] = $simulatedEvent;
            } else {
                $simulatedEvents[] = $event;
            }
        }
        
        $simulatedMetrics = $this->calculateMetrics($simulatedEvents);
        
        $simulatedMetrics['simulation_info'] = [
            'strategy' => self::STRATEGY_PREWARMING,
            'parameters' => $parameters,
            'keys_prewarmed' => count($keysToPrewarm),
            'misses_converted_to_hits' => $hitConversions,
        ];
        
        return $simulatedMetrics;
    }
    
    private function simulateMutexLock(array $events, array $parameters): array
    {
        $lockTimeout = $parameters['lock_timeout_ms'] ?? 1000;
        $concurrentWindow = $parameters['concurrent_window_seconds'] ?? 1.0;
        
        $keyMissTimestamps = [];
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            if ($event->getType() === CacheEvent::TYPE_MISS) {
                $key = $event->getKey();
                if (!isset($keyMissTimestamps[$key])) {
                    $keyMissTimestamps[$key] = [];
                }
                $keyMissTimestamps[$key][] = $event->getTimestamp();
            }
        }
        
        $protectedKeys = [];
        $concurrentMissesAvoided = 0;
        
        foreach ($keyMissTimestamps as $key => $timestamps) {
            sort($timestamps);
            
            $lastLockTime = null;
            
            for ($i = 0; $i < count($timestamps); $i++) {
                $ts = $timestamps[$i];
                
                if ($lastLockTime === null || $ts - $lastLockTime > $concurrentWindow) {
                    $lastLockTime = $ts;
                    $protectedKeys[$key] = true;
                } else {
                    $concurrentMissesAvoided++;
                }
            }
        }
        
        $simulatedEvents = [];
        $sourceLoadReduction = 0;
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                $simulatedEvents[] = $event;
                continue;
            }
            
            if ($event->getType() === CacheEvent::TYPE_MISS && isset($protectedKeys[$event->getKey()])) {
                $latency = $event->getLatencyMs();
                if ($latency !== null) {
                    $sourceLoadReduction += $latency * 9;
                }
            }
            
            $simulatedEvents[] = $event;
        }
        
        $simulatedMetrics = $this->calculateMetrics($simulatedEvents);
        
        $simulatedMetrics['simulation_info'] = [
            'strategy' => self::STRATEGY_MUTEX_LOCK,
            'parameters' => $parameters,
            'protected_keys' => count($protectedKeys),
            'concurrent_misses_avoided' => $concurrentMissesAvoided,
            'estimated_source_load_reduction_ms' => $sourceLoadReduction,
        ];
        
        return $simulatedMetrics;
    }
    
    private function simulateBloomFilter(array $events, array $parameters): array
    {
        $falsePositiveRate = $parameters['false_positive_rate'] ?? 0.01;
        
        $existingKeys = [];
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            if ($event->getType() === CacheEvent::TYPE_SET || $event->getType() === CacheEvent::TYPE_HIT) {
                $existingKeys[$event->getKey()] = true;
            }
        }
        
        $missEvents = [];
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            if ($event->getType() === CacheEvent::TYPE_MISS) {
                $missEvents[] = $event;
            }
        }
        
        $nonExistentKeys = [];
        $penetrationMisses = 0;
        
        foreach ($missEvents as $event) {
            $key = $event->getKey();
            if (!isset($existingKeys[$key])) {
                $nonExistentKeys[$key] = true;
                
                $latency = $event->getLatencyMs();
                if ($latency !== null && $latency > 500) {
                    $penetrationMisses++;
                }
            }
        }
        
        $falsePositives = (int) (count($nonExistentKeys) * $falsePositiveRate);
        $blockedMisses = count($nonExistentKeys) - $falsePositives;
        
        $simulatedMetrics = $this->calculateMetrics($events);
        
        $simulatedMetrics['simulation_info'] = [
            'strategy' => self::STRATEGY_BLOOM_FILTER,
            'parameters' => $parameters,
            'total_non_existent_keys' => count($nonExistentKeys),
            'penetration_misses_identified' => $penetrationMisses,
            'misses_blocked' => $blockedMisses,
            'false_positives' => $falsePositives,
        ];
        
        $simulatedMetrics['risk_reduction'] = [
            'penetration_risk_reduced' => $penetrationMisses > 0,
            'potential_source_load_saved' => $blockedMisses * 100,
        ];
        
        return $simulatedMetrics;
    }
    
    private function simulateStaleWhileRevalidate(array $events, array $parameters): array
    {
        $staleWindow = $parameters['stale_window_seconds'] ?? 30;
        $revalidateInBackground = $parameters['revalidate_in_background'] ?? true;
        
        $keyExpireTimestamps = [];
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            if ($event->getType() === CacheEvent::TYPE_SET && $event->getTtl() !== null) {
                $key = $event->getKey();
                $expireAt = $event->getTimestamp() + $event->getTtl();
                if (!isset($keyExpireTimestamps[$key]) || $expireAt > $keyExpireTimestamps[$key]) {
                    $keyExpireTimestamps[$key] = $expireAt;
                }
            }
        }
        
        $convertedToHits = 0;
        $staleServed = 0;
        
        $simulatedEvents = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                $simulatedEvents[] = $event;
                continue;
            }
            
            if ($event->getType() === CacheEvent::TYPE_MISS) {
                $key = $event->getKey();
                $ts = $event->getTimestamp();
                
                if (isset($keyExpireTimestamps[$key])) {
                    $expireAt = $keyExpireTimestamps[$key];
                    
                    if ($ts >= $expireAt && $ts <= $expireAt + $staleWindow) {
                        $staleServed++;
                        $convertedToHits++;
                        
                        $simulatedEvent = CacheEvent::fromArray([
                            'id' => $event->getId(),
                            'key' => $event->getKey(),
                            'type' => CacheEvent::TYPE_HIT,
                            'backend' => $event->getBackend(),
                            'timestamp' => $event->getTimestamp(),
                            'latency_ms' => max(1, ($event->getLatencyMs() ?? 100) / 5),
                            'ttl' => $event->getTtl(),
                            'size_bytes' => $event->getSizeBytes(),
                            'route' => $event->getRoute(),
                            'tags' => $event->getTags(),
                            'error' => null,
                        ]);
                        $simulatedEvents[] = $simulatedEvent;
                        continue;
                    }
                }
            }
            
            $simulatedEvents[] = $event;
        }
        
        $simulatedMetrics = $this->calculateMetrics($simulatedEvents);
        
        $simulatedMetrics['simulation_info'] = [
            'strategy' => self::STRATEGY_STALE_WHILE_REVALIDATE,
            'parameters' => $parameters,
            'stale_served_count' => $staleServed,
            'misses_converted_to_hits' => $convertedToHits,
        ];
        
        return $simulatedMetrics;
    }
    
    private function simulateKeyTiering(array $events, array $parameters): array
    {
        $hotKeyThreshold = $parameters['hot_key_threshold'] ?? 0.01;
        $tierCount = $parameters['tier_count'] ?? 3;
        
        $keyStats = [];
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            $type = $event->getType();
            if (in_array($type, [CacheEvent::TYPE_HIT, CacheEvent::TYPE_MISS], true)) {
                $key = $event->getKey();
                if (!isset($keyStats[$key])) {
                    $keyStats[$key] = ['hits' => 0, 'misses' => 0];
                }
                if ($type === CacheEvent::TYPE_HIT) {
                    $keyStats[$key]['hits']++;
                } else {
                    $keyStats[$key]['misses']++;
                }
            }
        }
        
        $totalAccesses = array_sum(array_map(function ($s) {
            return $s['hits'] + $s['misses'];
        }, $keyStats));
        
        $tiers = [
            'hot' => ['keys' => [], 'min_access_ratio' => 0.01],
            'warm' => ['keys' => [], 'min_access_ratio' => 0.001],
            'cold' => ['keys' => [], 'min_access_ratio' => 0],
        ];
        
        foreach ($keyStats as $key => $stats) {
            $accessRatio = ($stats['hits'] + $stats['misses']) / $totalAccesses;
            
            if ($accessRatio >= 0.01) {
                $tiers['hot']['keys'][] = $key;
            } elseif ($accessRatio >= 0.001) {
                $tiers['warm']['keys'][] = $key;
            } else {
                $tiers['cold']['keys'][] = $key;
            }
        }
        
        $simulatedMetrics = $this->calculateMetrics($events);
        
        $simulatedMetrics['simulation_info'] = [
            'strategy' => self::STRATEGY_KEY_TIERING,
            'parameters' => $parameters,
            'tiers' => [
                'hot' => [
                    'key_count' => count($tiers['hot']['keys']),
                    'sample_keys' => array_slice($tiers['hot']['keys'], 0, 10),
                ],
                'warm' => [
                    'key_count' => count($tiers['warm']['keys']),
                    'sample_keys' => array_slice($tiers['warm']['keys'], 0, 10),
                ],
                'cold' => [
                    'key_count' => count($tiers['cold']['keys']),
                    'sample_keys' => array_slice($tiers['cold']['keys'], 0, 10),
                ],
            ],
        ];
        
        $simulatedMetrics['tiered_optimization_potential'] = [
            'hot_keys_can_use_l1_cache' => !empty($tiers['hot']['keys']),
            'warm_keys_can_use_medium_ttl' => !empty($tiers['warm']['keys']),
            'cold_keys_can_use_aggressive_ttl' => !empty($tiers['cold']['keys']),
        ];
        
        return $simulatedMetrics;
    }
    
    private function simulateTagInvalidation(array $events, array $parameters): array
    {
        $tagGroupSize = $parameters['tag_group_size'] ?? 100;
        $invalidationPattern = $parameters['invalidation_pattern'] ?? 'per_key';
        
        $keyTags = [];
        $tagKeys = [];
        
        $keyIndex = 0;
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            $key = $event->getKey();
            if (!isset($keyTags[$key])) {
                $tagIndex = (int) ($keyIndex / $tagGroupSize);
                $tag = 'group_' . $tagIndex;
                $keyTags[$key] = $tag;
                if (!isset($tagKeys[$tag])) {
                    $tagKeys[$tag] = [];
                }
                $tagKeys[$tag][] = $key;
                $keyIndex++;
            }
        }
        
        $deleteEvents = array_filter($events, function ($e) {
            return $e instanceof CacheEvent && $e->getType() === CacheEvent::TYPE_DELETE;
        });
        
        $tagBasedDeletes = 0;
        $keysInvalidatedByTag = 0;
        
        foreach ($deleteEvents as $event) {
            $key = $event->getKey();
            if (isset($keyTags[$key])) {
                $tag = $keyTags[$key];
                if (isset($tagKeys[$tag])) {
                    $tagBasedDeletes++;
                    $keysInvalidatedByTag += count($tagKeys[$tag]);
                }
            }
        }
        
        $simulatedMetrics = $this->calculateMetrics($events);
        
        $simulatedMetrics['simulation_info'] = [
            'strategy' => self::STRATEGY_TAG_INVALIDATION,
            'parameters' => $parameters,
            'tag_count' => count($tagKeys),
            'avg_keys_per_tag' => !empty($tagKeys) 
                ? round(array_sum(array_map('count', $tagKeys)) / count($tagKeys), 2) 
                : 0,
        ];
        
        if ($invalidationPattern === 'tag_based') {
            $simulatedMetrics['invalidation_efficiency'] = [
                'tag_based_deletes' => $tagBasedDeletes,
                'keys_invalidated_per_delete' => $tagBasedDeletes > 0 
                    ? round($keysInvalidatedByTag / $tagBasedDeletes, 2) 
                    : 0,
            ];
        }
        
        return $simulatedMetrics;
    }
    
    private function simulateTtlJitter(array $events, array $parameters): array
    {
        $jitterRange = $parameters['jitter_percent'] ?? 10;
        $jitterType = $parameters['jitter_type'] ?? 'additive';
        
        $modifiedEvents = [];
        $ttlChanges = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                $modifiedEvents[] = $event;
                continue;
            }
            
            $ttl = $event->getTtl();
            
            if ($event->getType() === CacheEvent::TYPE_SET && $ttl !== null) {
                $jitterAmount = (int) ($ttl * $jitterRange / 100);
                
                if ($jitterType === 'additive') {
                    $newTtl = $ttl + random_int(-$jitterAmount, $jitterAmount);
                } else {
                    $multiplier = 1 + (random_int(-$jitterRange, $jitterRange) / 100);
                    $newTtl = (int) ($ttl * $multiplier);
                }
                
                $newTtl = max(1, $newTtl);
                
                $ttlChanges[] = [
                    'old_ttl' => $ttl,
                    'new_ttl' => $newTtl,
                    'delta' => $newTtl - $ttl,
                ];
                
                $modifiedEvent = CacheEvent::fromArray([
                    'id' => $event->getId(),
                    'key' => $event->getKey(),
                    'type' => $event->getType(),
                    'backend' => $event->getBackend(),
                    'timestamp' => $event->getTimestamp(),
                    'latency_ms' => $event->getLatencyMs(),
                    'ttl' => $newTtl,
                    'size_bytes' => $event->getSizeBytes(),
                    'route' => $event->getRoute(),
                    'tags' => $event->getTags(),
                    'error' => $event->getError(),
                ]);
                
                $modifiedEvents[] = $modifiedEvent;
            } else {
                $modifiedEvents[] = $event;
            }
        }
        
        $baselineMetrics = $this->calculateMetrics($events);
        $simulatedMetrics = $this->calculateMetrics($modifiedEvents);
        
        $baselineClustering = $baselineMetrics['risks']['ttl_clustering'] ?? [];
        $simulatedClustering = $simulatedMetrics['risks']['ttl_clustering'] ?? [];
        
        $clusteringReduction = 0;
        if (isset($baselineClustering['clustered_percentage']) && isset($simulatedClustering['clustered_percentage'])) {
            $clusteringReduction = $baselineClustering['clustered_percentage'] - $simulatedClustering['clustered_percentage'];
        }
        
        $simulatedMetrics['simulation_info'] = [
            'strategy' => self::STRATEGY_TTL_JITTER,
            'parameters' => $parameters,
            'events_modified' => count($ttlChanges),
            'clustering_reduction_percent' => max(0, $clusteringReduction),
        ];
        
        return $simulatedMetrics;
    }
    
    private function simulateNegativeCaching(array $events, array $parameters): array
    {
        $negativeTtl = $parameters['negative_ttl_seconds'] ?? 60;
        $penetrationThreshold = $parameters['penetration_threshold_ms'] ?? 1000;
        
        $keyExistence = [];
        $missPatterns = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            $type = $event->getType();
            $key = $event->getKey();
            
            if ($type === CacheEvent::TYPE_SET) {
                $keyExistence[$key] = true;
            }
        }
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            if ($event->getType() === CacheEvent::TYPE_MISS) {
                $key = $event->getKey();
                $latency = $event->getLatencyMs();
                $ts = $event->getTimestamp();
                
                if (!isset($keyExistence[$key])) {
                    if (!isset($missPatterns[$key])) {
                        $missPatterns[$key] = [];
                    }
                    $missPatterns[$key][] = [
                        'timestamp' => $ts,
                        'latency' => $latency,
                        'is_penetration_candidate' => $latency !== null && $latency > $penetrationThreshold,
                    ];
                }
            }
        }
        
        $nonExistentKeys = count($missPatterns);
        $penetrationCandidates = 0;
        $totalMissesOnNonExistent = 0;
        
        foreach ($missPatterns as $misses) {
            $totalMissesOnNonExistent += count($misses);
            foreach ($misses as $miss) {
                if ($miss['is_penetration_candidate']) {
                    $penetrationCandidates++;
                    break;
                }
            }
        }
        
        $simulatedMetrics = $this->calculateMetrics($events);
        
        $simulatedMetrics['simulation_info'] = [
            'strategy' => self::STRATEGY_NEGATIVE_CACHING,
            'parameters' => $parameters,
            'non_existent_keys_identified' => $nonExistentKeys,
            'penetration_candidate_keys' => $penetrationCandidates,
            'total_misses_on_non_existent' => $totalMissesOnNonExistent,
        ];
        
        $missesPrevented = 0;
        if ($negativeTtl > 0) {
            foreach ($missPatterns as $key => $misses) {
                if (count($misses) < 2) {
                    continue;
                }
                
                usort($misses, function ($a, $b) {
                    return $a['timestamp'] <=> $b['timestamp'];
                });
                
                $lastCachedTime = null;
                for ($i = 1; $i < count($misses); $i++) {
                    $currentTs = $misses[$i]['timestamp'];
                    $firstMissTs = $misses[$i - 1]['timestamp'];
                    
                    if ($lastCachedTime === null) {
                        $lastCachedTime = $firstMissTs;
                    }
                    
                    if ($currentTs - $lastCachedTime <= $negativeTtl) {
                        $missesPrevented++;
                    } else {
                        $lastCachedTime = $currentTs;
                    }
                }
            }
        }
        
        $simulatedMetrics['simulated_impact'] = [
            'misses_prevented_by_negative_cache' => $missesPrevented,
            'estimated_source_load_saved_ms' => $missesPrevented * 100,
        ];
        
        return $simulatedMetrics;
    }
    
    private function compareWithBaseline(array $simulatedMetrics): array
    {
        $baseline = $this->baselineMetrics;
        
        $hitRateBaseline = $baseline['summary']['hit_rate'] ?? 0;
        $hitRateSimulated = $simulatedMetrics['summary']['hit_rate'] ?? 0;
        
        $sourceLoadBaseline = $baseline['latency']['estimated_source_load_ms'] ?? 0;
        $sourceLoadSimulated = $simulatedMetrics['latency']['estimated_source_load_ms'] ?? 0;
        
        $baselineClustered = $baseline['risks']['ttl_clustering']['clustered_percentage'] ?? 0;
        $simulatedClustered = $simulatedMetrics['risks']['ttl_clustering']['clustered_percentage'] ?? 0;
        
        $baselineClusters = $baseline['risks']['concurrent_miss_clusters']['cluster_count'] ?? 0;
        $simulatedClusters = $simulatedMetrics['risks']['concurrent_miss_clusters']['cluster_count'] ?? 0;
        
        return [
            'hit_rate_change' => [
                'baseline' => $hitRateBaseline,
                'simulated' => $hitRateSimulated,
                'absolute_change' => $hitRateSimulated - $hitRateBaseline,
                'percent_change' => $hitRateBaseline > 0 
                    ? round(($hitRateSimulated - $hitRateBaseline) / $hitRateBaseline * 100, 2) 
                    : null,
            ],
            'source_load_change' => [
                'baseline_ms' => $sourceLoadBaseline,
                'simulated_ms' => $sourceLoadSimulated,
                'reduction_ms' => $sourceLoadBaseline - $sourceLoadSimulated,
                'reduction_percent' => $sourceLoadBaseline > 0 
                    ? round(($sourceLoadBaseline - $sourceLoadSimulated) / $sourceLoadBaseline * 100, 2) 
                    : null,
            ],
            'ttl_clustering_change' => [
                'baseline_percent' => $baselineClustered,
                'simulated_percent' => $simulatedClustered,
                'reduction_percent' => $baselineClustered - $simulatedClustered,
            ],
            'concurrent_miss_clusters_change' => [
                'baseline_count' => $baselineClusters,
                'simulated_count' => $simulatedClusters,
                'reduction' => $baselineClusters - $simulatedClusters,
            ],
        ];
    }
    
    private function generateComparisonRecommendations(array $comparisons): array
    {
        $recommendations = [];
        
        foreach ($comparisons as $comp) {
            $strategy = $comp['strategy'];
            $comparison = $comp['comparison'];
            
            $hitRateImproved = ($comparison['hit_rate_change']['absolute_change'] ?? 0) > 0;
            $sourceLoadReduced = ($comparison['source_load_change']['reduction_percent'] ?? 0) > 0;
            $clusteringReduced = ($comparison['ttl_clustering_change']['reduction_percent'] ?? 0) > 0;
            $concurrentMissesReduced = ($comparison['concurrent_miss_clusters_change']['reduction'] ?? 0) > 0;
            
            if ($hitRateImproved || $sourceLoadReduced || $clusteringReduced || $concurrentMissesReduced) {
                $recommendations[] = [
                    'strategy' => $strategy,
                    'score' => $this->calculateStrategyScore($comparison),
                    'benefits' => [
                        'hit_rate_improved' => $hitRateImproved,
                        'source_load_reduced' => $sourceLoadReduced,
                        'ttl_clustering_reduced' => $clusteringReduced,
                        'concurrent_misses_reduced' => $concurrentMissesReduced,
                    ],
                    'metrics' => [
                        'hit_rate_improvement_percent' => $comparison['hit_rate_change']['percent_change'] ?? 0,
                        'source_load_reduction_percent' => $comparison['source_load_change']['reduction_percent'] ?? 0,
                    ],
                ];
            }
        }
        
        usort($recommendations, function ($a, $b) {
            return $b['score'] <=> $a['score'];
        });
        
        return $recommendations;
    }
    
    private function calculateStrategyScore(array $comparison): float
    {
        $score = 0;
        
        $hitRateChange = $comparison['hit_rate_change']['absolute_change'] ?? 0;
        $score += $hitRateChange * 100;
        
        $loadReduction = $comparison['source_load_change']['reduction_percent'] ?? 0;
        $score += $loadReduction * 0.5;
        
        $clusteringReduction = $comparison['ttl_clustering_change']['reduction_percent'] ?? 0;
        $score += $clusteringReduction * 0.3;
        
        $concurrentReduction = $comparison['concurrent_miss_clusters_change']['reduction'] ?? 0;
        $score += $concurrentReduction * 10;
        
        return $score;
    }
    
    private function getPercentile(array $values, float $percentile): ?float
    {
        if (empty($values)) {
            return null;
        }
        
        sort($values);
        $count = count($values);
        $index = (int) ceil(($percentile / 100) * $count) - 1;
        $index = max(0, min($index, $count - 1));
        
        return (float) $values[$index];
    }
}
