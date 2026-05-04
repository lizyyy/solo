<?php

namespace CacheAnalyzer\Analyzer;

use CacheAnalyzer\Model\CacheEvent;
use CacheAnalyzer\Model\CacheConfig;
use CacheAnalyzer\Model\SlowQuery;
use Exception;

class RiskAnalyzer implements AnalyzerInterface
{
    public const RISK_LEVEL_LOW = 'low';
    public const RISK_LEVEL_MEDIUM = 'medium';
    public const RISK_LEVEL_HIGH = 'high';
    public const RISK_LEVEL_CRITICAL = 'critical';
    
    public function getName(): string
    {
        return 'Risk Analyzer';
    }
    
    public function getDescription(): string
    {
        return 'Analyzes cache risks including breakdown, penetration, avalanche, and configuration issues';
    }
    
    /**
     * @param CacheEvent[] $events
     * @param array $options
     * @return array
     */
    public function analyze(array $events, array $options = []): array
    {
        $cacheConfigs = $options['cache_configs'] ?? [];
        $slowQueries = $options['slow_queries'] ?? [];
        
        $risks = [];
        
        $breakdownRisk = $this->analyzeBreakdownRisk($events);
        if ($breakdownRisk['level'] !== self::RISK_LEVEL_LOW) {
            $risks[] = $breakdownRisk;
        }
        
        $penetrationRisk = $this->analyzePenetrationRisk($events);
        if ($penetrationRisk['level'] !== self::RISK_LEVEL_LOW) {
            $risks[] = $penetrationRisk;
        }
        
        $avalancheRisk = $this->analyzeAvalancheRisk($events);
        if ($avalancheRisk['level'] !== self::RISK_LEVEL_LOW) {
            $risks[] = $avalancheRisk;
        }
        
        $ttlClusteringRisk = $this->analyzeTtlClusteringRisk($events);
        if ($ttlClusteringRisk['level'] !== self::RISK_LEVEL_LOW) {
            $risks[] = $ttlClusteringRisk;
        }
        
        $opcacheRisks = $this->analyzeOpcacheRisks($cacheConfigs);
        foreach ($opcacheRisks as $risk) {
            $risks[] = $risk;
        }
        
        $slowQueryRisks = $this->analyzeSlowQueryRisks($slowQueries);
        foreach ($slowQueryRisks as $risk) {
            $risks[] = $risk;
        }
        
        usort($risks, function ($a, $b) {
            $priority = [
                self::RISK_LEVEL_CRITICAL => 4,
                self::RISK_LEVEL_HIGH => 3,
                self::RISK_LEVEL_MEDIUM => 2,
                self::RISK_LEVEL_LOW => 1,
            ];
            return ($priority[$b['level']] ?? 0) <=> ($priority[$a['level']] ?? 0);
        });
        
        return [
            'overall_risk_level' => $this->getOverallRiskLevel($risks),
            'risk_count' => [
                'critical' => count(array_filter($risks, fn($r) => $r['level'] === self::RISK_LEVEL_CRITICAL)),
                'high' => count(array_filter($risks, fn($r) => $r['level'] === self::RISK_LEVEL_HIGH)),
                'medium' => count(array_filter($risks, fn($r) => $r['level'] === self::RISK_LEVEL_MEDIUM)),
                'low' => count(array_filter($risks, fn($r) => $r['level'] === self::RISK_LEVEL_LOW)),
            ],
            'risks' => $risks,
            'recommendations' => $this->generateRecommendations($risks),
        ];
    }
    
    private function analyzeBreakdownRisk(array $events): array
    {
        $missByKey = [];
        $hitsByKey = [];
        $setByKey = [];
        $timestampsByKey = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            $key = $event->getKey();
            $type = $event->getType();
            $ts = $event->getTimestamp();
            
            if (!isset($timestampsByKey[$key])) {
                $timestampsByKey[$key] = [];
            }
            $timestampsByKey[$key][] = $ts;
            
            if ($type === CacheEvent::TYPE_MISS) {
                $missByKey[$key] = ($missByKey[$key] ?? 0) + 1;
            } elseif ($type === CacheEvent::TYPE_HIT) {
                $hitsByKey[$key] = ($hitsByKey[$key] ?? 0) + 1;
            } elseif ($type === CacheEvent::TYPE_SET) {
                $setByKey[$key] = ($setByKey[$key] ?? 0) + 1;
            }
        }
        
        $highMissKeys = [];
        $concurrentMissPatterns = [];
        
        foreach ($missByKey as $key => $missCount) {
            $hitCount = $hitsByKey[$key] ?? 0;
            $total = $missCount + $hitCount;
            
            if ($total === 0) {
                continue;
            }
            
            $missRate = $missCount / $total;
            
            if ($missRate > 0.8 && $missCount > 10) {
                $highMissKeys[] = [
                    'key' => $key,
                    'miss_count' => $missCount,
                    'hit_count' => $hitCount,
                    'miss_rate' => $missRate,
                ];
            }
            
            $timestamps = $timestampsByKey[$key] ?? [];
            if (count($timestamps) < 2) {
                continue;
            }
            
            sort($timestamps);
            $concurrentCount = 0;
            $windowSize = 1;
            
            for ($i = 0; $i < count($timestamps); $i++) {
                $windowEnd = $timestamps[$i] + $windowSize;
                $windowCount = 1;
                
                for ($j = $i + 1; $j < count($timestamps); $j++) {
                    if ($timestamps[$j] <= $windowEnd) {
                        $windowCount++;
                    }
                }
                
                if ($windowCount > $concurrentCount) {
                    $concurrentCount = $windowCount;
                }
            }
            
            if ($concurrentCount > 5) {
                $concurrentMissPatterns[] = [
                    'key' => $key,
                    'max_concurrent_in_window' => $concurrentCount,
                    'window_seconds' => $windowSize,
                ];
            }
        }
        
        $level = self::RISK_LEVEL_LOW;
        $message = 'No significant cache breakdown risk detected';
        $details = [];
        
        if (!empty($concurrentMissPatterns)) {
            $level = self::RISK_LEVEL_HIGH;
            $message = 'Potential cache breakdown detected - high concurrent misses on same keys';
            $details['concurrent_miss_patterns'] = $concurrentMissPatterns;
        }
        
        if (!empty($highMissKeys)) {
            if ($level === self::RISK_LEVEL_LOW) {
                $level = self::RISK_LEVEL_MEDIUM;
                $message = 'Some keys have very high miss rates';
            }
            $details['high_miss_keys'] = array_slice($highMissKeys, 0, 10);
        }
        
        return [
            'type' => 'cache_breakdown',
            'level' => $level,
            'message' => $message,
            'details' => $details,
            'recommendation' => $this->getBreakdownMitigation(),
        ];
    }
    
    private function analyzePenetrationRisk(array $events): array
    {
        $missEvents = [];
        $setEvents = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            $type = $event->getType();
            
            if ($type === CacheEvent::TYPE_MISS) {
                $missEvents[] = $event;
            } elseif ($type === CacheEvent::TYPE_SET) {
                $setEvents[$event->getKey()] = $event;
            }
        }
        
        $unrecoveredMisses = 0;
        $slowMissPatterns = [];
        
        foreach ($missEvents as $miss) {
            $key = $miss->getKey();
            
            if (!isset($setEvents[$key])) {
                $unrecoveredMisses++;
            }
            
            $latency = $miss->getLatencyMs();
            if ($latency !== null && $latency > 1000) {
                $slowMissPatterns[] = [
                    'key' => $key,
                    'latency_ms' => $latency,
                    'timestamp' => $miss->getTimestamp(),
                ];
            }
        }
        
        $level = self::RISK_LEVEL_LOW;
        $message = 'No significant cache penetration risk detected';
        $details = [];
        
        if (!empty($slowMissPatterns)) {
            $level = self::RISK_LEVEL_HIGH;
            $message = 'Slow miss responses detected - potential cache penetration';
            $details['slow_misses'] = array_slice($slowMissPatterns, 0, 10);
            $details['slow_miss_count'] = count($slowMissPatterns);
        }
        
        $totalMisses = count($missEvents);
        if ($totalMisses > 0) {
            $unrecoveredRate = $unrecoveredMisses / $totalMisses;
            if ($unrecoveredRate > 0.3) {
                if ($level === self::RISK_LEVEL_LOW) {
                    $level = self::RISK_LEVEL_MEDIUM;
                    $message = 'High rate of misses without subsequent SET operations';
                }
                $details['unrecovered_misses'] = $unrecoveredMisses;
                $details['unrecovered_rate'] = round($unrecoveredRate * 100, 2) . '%';
            }
        }
        
        return [
            'type' => 'cache_penetration',
            'level' => $level,
            'message' => $message,
            'details' => $details,
            'recommendation' => $this->getPenetrationMitigation(),
        ];
    }
    
    private function analyzeAvalancheRisk(array $events): array
    {
        $ttlEvents = [];
        $setEvents = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            $type = $event->getType();
            $ttl = $event->getTtl();
            
            if ($type === CacheEvent::TYPE_SET && $ttl !== null) {
                $setEvents[] = [
                    'key' => $event->getKey(),
                    'timestamp' => $event->getTimestamp(),
                    'ttl' => $ttl,
                    'expire_at' => $event->getTimestamp() + $ttl,
                ];
            }
            
            if ($type === CacheEvent::TYPE_EXPIRE) {
                $ttlEvents[] = $event;
            }
        }
        
        $expireClusters = [];
        $timeWindow = 60;
        
        if (!empty($setEvents)) {
            usort($setEvents, function ($a, $b) {
                return $a['expire_at'] <=> $b['expire_at'];
            });
            
            $currentCluster = [];
            $clusterStart = null;
            
            foreach ($setEvents as $event) {
                $expireAt = $event['expire_at'];
                
                if ($clusterStart === null) {
                    $clusterStart = $expireAt;
                    $currentCluster = [$event];
                } elseif ($expireAt - $clusterStart <= $timeWindow) {
                    $currentCluster[] = $event;
                } else {
                    if (count($currentCluster) >= 5) {
                        $expireClusters[] = [
                            'start_time' => $clusterStart,
                            'end_time' => $expireAt,
                            'count' => count($currentCluster),
                            'keys' => array_slice(array_column($currentCluster, 'key'), 0, 5),
                        ];
                    }
                    $clusterStart = $expireAt;
                    $currentCluster = [$event];
                }
            }
            
            if (count($currentCluster) >= 5) {
                $expireClusters[] = [
                    'start_time' => $clusterStart,
                    'end_time' => $currentCluster[array_key_last($currentCluster)]['expire_at'],
                    'count' => count($currentCluster),
                    'keys' => array_slice(array_column($currentCluster, 'key'), 0, 5),
                ];
            }
        }
        
        $level = self::RISK_LEVEL_LOW;
        $message = 'No significant cache avalanche risk detected';
        $details = [];
        
        if (!empty($expireClusters)) {
            $maxCluster = max(array_column($expireClusters, 'count'));
            
            if ($maxCluster > 20) {
                $level = self::RISK_LEVEL_CRITICAL;
                $message = 'Critical cache avalanche risk detected - large number of keys expire simultaneously';
            } elseif ($maxCluster > 10) {
                $level = self::RISK_LEVEL_HIGH;
                $message = 'High cache avalanche risk - multiple keys expire in same time window';
            } else {
                $level = self::RISK_LEVEL_MEDIUM;
                $message = 'Potential cache avalanche risk - some keys expire in clusters';
            }
            
            $details['expire_clusters'] = $expireClusters;
            $details['max_cluster_size'] = $maxCluster;
        }
        
        return [
            'type' => 'cache_avalanche',
            'level' => $level,
            'message' => $message,
            'details' => $details,
            'recommendation' => $this->getAvalancheMitigation(),
        ];
    }
    
    private function analyzeTtlClusteringRisk(array $events): array
    {
        $ttlValues = [];
        $ttlByKey = [];
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            if ($event->getType() === CacheEvent::TYPE_SET && $event->getTtl() !== null) {
                $ttl = $event->getTtl();
                $ttlValues[] = $ttl;
                
                $key = $event->getKey();
                if (!isset($ttlByKey[$key])) {
                    $ttlByKey[$key] = [];
                }
                $ttlByKey[$key][] = $ttl;
            }
        }
        
        if (empty($ttlValues)) {
            return [
                'type' => 'ttl_clustering',
                'level' => self::RISK_LEVEL_LOW,
                'message' => 'No TTL data available for analysis',
                'details' => [],
                'recommendation' => '',
            ];
        }
        
        $ttlHistogram = array_count_values($ttlValues);
        arsort($ttlHistogram);
        
        $commonTtls = [];
        $total = count($ttlValues);
        
        foreach ($ttlHistogram as $ttl => $count) {
            $percentage = ($count / $total) * 100;
            if ($percentage > 5) {
                $commonTtls[] = [
                    'ttl_seconds' => $ttl,
                    'ttl_formatted' => $this->formatTtl($ttl),
                    'count' => $count,
                    'percentage' => round($percentage, 2),
                ];
            }
        }
        
        $level = self::RISK_LEVEL_LOW;
        $message = 'TTL distribution appears healthy';
        $details = [];
        
        if (!empty($commonTtls)) {
            $topPercentage = $commonTtls[0]['percentage'] ?? 0;
            
            if ($topPercentage > 50) {
                $level = self::RISK_LEVEL_HIGH;
                $message = 'High TTL clustering - majority of keys use same TTL';
            } elseif ($topPercentage > 30) {
                $level = self::RISK_LEVEL_MEDIUM;
                $message = 'Moderate TTL clustering detected';
            }
            
            $details['common_ttls'] = $commonTtls;
            $details['ttl_histogram'] = array_slice($ttlHistogram, 0, 10, true);
        }
        
        return [
            'type' => 'ttl_clustering',
            'level' => $level,
            'message' => $message,
            'details' => $details,
            'recommendation' => $this->getTtlClusteringMitigation(),
        ];
    }
    
    private function analyzeOpcacheRisks(array $cacheConfigs): array
    {
        $risks = [];
        
        foreach ($cacheConfigs as $config) {
            if (!$config instanceof CacheConfig) {
                continue;
            }
            
            $issues = $config->hasOpcacheIssues();
            
            foreach ($issues as $issue) {
                $severityMap = [
                    'high' => self::RISK_LEVEL_HIGH,
                    'medium' => self::RISK_LEVEL_MEDIUM,
                    'low' => self::RISK_LEVEL_LOW,
                ];
                
                $risks[] = [
                    'type' => 'opcache_config',
                    'level' => $severityMap[$issue['severity']] ?? self::RISK_LEVEL_LOW,
                    'message' => $issue['message'],
                    'details' => [
                        'backend' => $config->getBackend(),
                        'issue_type' => $issue['type'],
                        'config_name' => $config->getName(),
                    ],
                    'recommendation' => $issue['recommendation'],
                ];
            }
        }
        
        return $risks;
    }
    
    private function analyzeSlowQueryRisks(array $slowQueries): array
    {
        $risks = [];
        
        $uncachedReadQueries = [];
        $slowWriteQueries = [];
        
        foreach ($slowQueries as $query) {
            if (!$query instanceof SlowQuery) {
                continue;
            }
            
            if ($query->isReadQuery()) {
                $isCacheable = $query->isCacheable();
                $shouldCache = $query->shouldCache();
                
                if ($shouldCache && ($isCacheable === null || $isCacheable === true)) {
                    $uncachedReadQueries[] = [
                        'query' => substr($query->getQuery(), 0, 200) . (strlen($query->getQuery()) > 200 ? '...' : ''),
                        'execution_time_ms' => $query->getExecutionTimeMs(),
                        'table' => $query->getTable(),
                        'rows_examined' => $query->getRowsExamined(),
                        'rows_sent' => $query->getRowsSent(),
                    ];
                }
            } else {
                if ($query->getExecutionTimeMs() > 1000) {
                    $slowWriteQueries[] = [
                        'query' => substr($query->getQuery(), 0, 200) . (strlen($query->getQuery()) > 200 ? '...' : ''),
                        'query_type' => $query->getQueryType(),
                        'execution_time_ms' => $query->getExecutionTimeMs(),
                        'table' => $query->getTable(),
                    ];
                }
            }
        }
        
        if (!empty($uncachedReadQueries)) {
            $risks[] = [
                'type' => 'uncached_slow_queries',
                'level' => self::RISK_LEVEL_HIGH,
                'message' => sprintf('Found %d slow read queries that should be cached', count($uncachedReadQueries)),
                'details' => [
                    'queries' => array_slice($uncachedReadQueries, 0, 10),
                    'total_count' => count($uncachedReadQueries),
                ],
                'recommendation' => 'Consider caching these query results with appropriate TTL',
            ];
        }
        
        if (!empty($slowWriteQueries)) {
            $risks[] = [
                'type' => 'slow_write_queries',
                'level' => self::RISK_LEVEL_MEDIUM,
                'message' => sprintf('Found %d slow write queries', count($slowWriteQueries)),
                'details' => [
                    'queries' => array_slice($slowWriteQueries, 0, 10),
                    'total_count' => count($slowWriteQueries),
                ],
                'recommendation' => 'Optimize write patterns, consider batch operations or sharding',
            ];
        }
        
        return $risks;
    }
    
    private function getOverallRiskLevel(array $risks): string
    {
        if (empty($risks)) {
            return self::RISK_LEVEL_LOW;
        }
        
        $levels = array_column($risks, 'level');
        
        if (in_array(self::RISK_LEVEL_CRITICAL, $levels, true)) {
            return self::RISK_LEVEL_CRITICAL;
        }
        
        if (in_array(self::RISK_LEVEL_HIGH, $levels, true)) {
            return self::RISK_LEVEL_HIGH;
        }
        
        if (in_array(self::RISK_LEVEL_MEDIUM, $levels, true)) {
            return self::RISK_LEVEL_MEDIUM;
        }
        
        return self::RISK_LEVEL_LOW;
    }
    
    private function generateRecommendations(array $risks): array
    {
        $recommendations = [];
        
        foreach ($risks as $risk) {
            if (!empty($risk['recommendation'])) {
                $recommendations[] = [
                    'risk_type' => $risk['type'],
                    'level' => $risk['level'],
                    'recommendation' => $risk['recommendation'],
                ];
            }
        }
        
        return $recommendations;
    }
    
    private function getBreakdownMitigation(): string
    {
        return 'Implement mutex locks (SETNX) for concurrent key access. Consider using a semaphore or distributed lock (Redis Redlock). Use "stale-while-revalidate" pattern to serve stale data while refreshing.';
    }
    
    private function getPenetrationMitigation(): string
    {
        return 'Implement bloom filters to check existence before querying database. Cache negative results (empty values) with short TTL. Validate and sanitize all input parameters. Consider rate limiting for unusual request patterns.';
    }
    
    private function getAvalancheMitigation(): string
    {
        return 'Add random jitter to TTL values (±10-20%). Use different base TTLs for different key categories. Implement key-level preheating for hot keys. Use hierarchical caching with multiple TTL levels.';
    }
    
    private function getTtlClusteringMitigation(): string
    {
        return 'Distribute expiration times by adding random offsets. Use formula: base_ttl + rand(-max_jitter, +max_jitter). Consider time-based expiration buckets. For critical data, consider permanent caching with explicit invalidation.';
    }
    
    private function formatTtl(int $seconds): string
    {
        if ($seconds < 60) {
            return $seconds . 's';
        } elseif ($seconds < 3600) {
            return round($seconds / 60) . 'm';
        } elseif ($seconds < 86400) {
            return round($seconds / 3600) . 'h';
        } else {
            return round($seconds / 86400) . 'd';
        }
    }
}
