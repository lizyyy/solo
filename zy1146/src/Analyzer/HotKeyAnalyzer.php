<?php

namespace CacheAnalyzer\Analyzer;

use CacheAnalyzer\Model\CacheEvent;
use Exception;

class HotKeyAnalyzer implements AnalyzerInterface
{
    public function getName(): string
    {
        return 'Hot Key Analyzer';
    }
    
    public function getDescription(): string
    {
        return 'Analyzes hot keys and their access patterns';
    }
    
    /**
     * @param CacheEvent[] $events
     * @param array $options
     * @return array
     */
    public function analyze(array $events, array $options = []): array
    {
        $threshold = $options['threshold'] ?? 0.01;
        $topN = $options['top_n'] ?? 20;
        
        $accessStats = [];
        $latencyStats = [];
        $sizeStats = [];
        $backendStats = [];
        $routeStats = [];
        
        $totalAccesses = 0;
        
        foreach ($events as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            $type = $event->getType();
            $key = $event->getKey();
            $backend = $event->getBackend();
            $route = $event->getRoute();
            $latency = $event->getLatencyMs();
            $size = $event->getSizeBytes();
            
            if (in_array($type, [CacheEvent::TYPE_HIT, CacheEvent::TYPE_MISS], true)) {
                $totalAccesses++;
                
                if (!isset($accessStats[$key])) {
                    $accessStats[$key] = [
                        'key' => $key,
                        'hits' => 0,
                        'misses' => 0,
                        'total_accesses' => 0,
                        'backend' => $backend,
                        'routes' => [],
                        'first_access' => $event->getTimestamp(),
                        'last_access' => $event->getTimestamp(),
                    ];
                }
                
                $accessStats[$key]['total_accesses']++;
                $accessStats[$key]['last_access'] = max(
                    $accessStats[$key]['last_access'],
                    $event->getTimestamp()
                );
                $accessStats[$key]['first_access'] = min(
                    $accessStats[$key]['first_access'],
                    $event->getTimestamp()
                );
                
                if ($type === CacheEvent::TYPE_HIT) {
                    $accessStats[$key]['hits']++;
                } else {
                    $accessStats[$key]['misses']++;
                }
                
                if ($route !== null) {
                    if (!isset($accessStats[$key]['routes'][$route])) {
                        $accessStats[$key]['routes'][$route] = 0;
                    }
                    $accessStats[$key]['routes'][$route]++;
                }
                
                if (!isset($backendStats[$backend])) {
                    $backendStats[$backend] = [
                        'backend' => $backend,
                        'total_accesses' => 0,
                        'hits' => 0,
                        'misses' => 0,
                    ];
                }
                $backendStats[$backend]['total_accesses']++;
                if ($type === CacheEvent::TYPE_HIT) {
                    $backendStats[$backend]['hits']++;
                } else {
                    $backendStats[$backend]['misses']++;
                }
                
                if ($route !== null) {
                    if (!isset($routeStats[$route])) {
                        $routeStats[$route] = [
                            'route' => $route,
                            'total_accesses' => 0,
                            'hits' => 0,
                            'misses' => 0,
                            'keys' => [],
                        ];
                    }
                    $routeStats[$route]['total_accesses']++;
                    if ($type === CacheEvent::TYPE_HIT) {
                        $routeStats[$route]['hits']++;
                    } else {
                        $routeStats[$route]['misses']++;
                    }
                    if (!isset($routeStats[$route]['keys'][$key])) {
                        $routeStats[$route]['keys'][$key] = 0;
                    }
                    $routeStats[$route]['keys'][$key]++;
                }
            }
            
            if ($latency !== null) {
                if (!isset($latencyStats[$key])) {
                    $latencyStats[$key] = [];
                }
                $latencyStats[$key][] = $latency;
            }
            
            if ($size !== null) {
                if (!isset($sizeStats[$key])) {
                    $sizeStats[$key] = [];
                }
                $sizeStats[$key][] = $size;
            }
        }
        
        foreach ($accessStats as $key => &$stats) {
            $total = $stats['hits'] + $stats['misses'];
            $stats['hit_rate'] = $total > 0 ? $stats['hits'] / $total : 0;
            $stats['miss_rate'] = $total > 0 ? $stats['misses'] / $total : 0;
            $stats['access_ratio'] = $totalAccesses > 0 ? $total / $totalAccesses : 0;
            
            if (isset($latencyStats[$key])) {
                $latencies = $latencyStats[$key];
                sort($latencies);
                $stats['latency_avg_ms'] = array_sum($latencies) / count($latencies);
                $stats['latency_p50_ms'] = $this->getPercentile($latencies, 50);
                $stats['latency_p95_ms'] = $this->getPercentile($latencies, 95);
                $stats['latency_p99_ms'] = $this->getPercentile($latencies, 99);
            }
            
            if (isset($sizeStats[$key])) {
                $sizes = $sizeStats[$key];
                $stats['size_avg_bytes'] = array_sum($sizes) / count($sizes);
                $stats['size_min_bytes'] = min($sizes);
                $stats['size_max_bytes'] = max($sizes);
            }
            
            arsort($stats['routes']);
            $stats['top_routes'] = array_slice($stats['routes'], 0, 5, true);
            unset($stats['routes']);
        }
        
        usort($accessStats, function ($a, $b) {
            return $b['total_accesses'] <=> $a['total_accesses'];
        });
        
        $hotKeys = [];
        foreach ($accessStats as $stats) {
            if ($stats['access_ratio'] >= $threshold || count($hotKeys) < $topN) {
                $hotKeys[] = $stats;
            }
        }
        
        $hotKeys = array_slice($hotKeys, 0, $topN);
        
        foreach ($backendStats as &$stats) {
            $total = $stats['hits'] + $stats['misses'];
            $stats['hit_rate'] = $total > 0 ? $stats['hits'] / $total : 0;
        }
        
        foreach ($routeStats as &$stats) {
            $total = $stats['hits'] + $stats['misses'];
            $stats['hit_rate'] = $total > 0 ? $stats['hits'] / $total : 0;
            arsort($stats['keys']);
            $stats['top_keys'] = array_slice($stats['keys'], 0, 10, true);
            unset($stats['keys']);
        }
        
        usort($routeStats, function ($a, $b) {
            return $b['total_accesses'] <=> $a['total_accesses'];
        });
        
        $concentrationMetrics = $this->calculateConcentrationMetrics($accessStats, $totalAccesses);
        
        return [
            'summary' => [
                'total_events' => count($events),
                'total_accesses' => $totalAccesses,
                'unique_keys' => count($accessStats),
                'hot_key_count' => count($hotKeys),
            ],
            'hot_keys' => $hotKeys,
            'by_backend' => $backendStats,
            'by_route' => array_slice($routeStats, 0, 20),
            'concentration' => $concentrationMetrics,
            'recommendations' => $this->generateRecommendations($hotKeys, $concentrationMetrics),
        ];
    }
    
    private function calculateConcentrationMetrics(array $accessStats, int $totalAccesses): array
    {
        if (empty($accessStats) || $totalAccesses === 0) {
            return [
                'gini_coefficient' => 0,
                'top_1_percent_share' => 0,
                'top_5_percent_share' => 0,
                'top_10_percent_share' => 0,
                'entropy' => 0,
            ];
        }
        
        $sortedAccesses = array_column($accessStats, 'total_accesses');
        rsort($sortedAccesses);
        
        $n = count($sortedAccesses);
        $top1Count = (int) ceil($n * 0.01);
        $top5Count = (int) ceil($n * 0.05);
        $top10Count = (int) ceil($n * 0.1);
        
        $top1Accesses = array_sum(array_slice($sortedAccesses, 0, $top1Count));
        $top5Accesses = array_sum(array_slice($sortedAccesses, 0, $top5Count));
        $top10Accesses = array_sum(array_slice($sortedAccesses, 0, $top10Count));
        
        $gini = $this->calculateGiniCoefficient($sortedAccesses);
        $entropy = $this->calculateEntropy($sortedAccesses, $totalAccesses);
        
        return [
            'gini_coefficient' => round($gini, 4),
            'top_1_percent_share' => round($top1Accesses / $totalAccesses * 100, 2) . '%',
            'top_5_percent_share' => round($top5Accesses / $totalAccesses * 100, 2) . '%',
            'top_10_percent_share' => round($top10Accesses / $totalAccesses * 100, 2) . '%',
            'entropy' => round($entropy, 4),
            'interpretation' => $this->interpretConcentration($gini),
        ];
    }
    
    private function calculateGiniCoefficient(array $values): float
    {
        $n = count($values);
        if ($n === 0) {
            return 0.0;
        }
        
        sort($values);
        $sum = 0;
        $total = array_sum($values);
        
        if ($total === 0) {
            return 0.0;
        }
        
        for ($i = 0; $i < $n; $i++) {
            $sum += ($i + 1) * $values[$i];
        }
        
        return (2 * $sum) / ($n * $total) - ($n + 1) / $n;
    }
    
    private function calculateEntropy(array $values, int $total): float
    {
        if ($total === 0) {
            return 0.0;
        }
        
        $entropy = 0.0;
        
        foreach ($values as $value) {
            if ($value > 0) {
                $p = $value / $total;
                $entropy -= $p * log($p);
            }
        }
        
        return $entropy;
    }
    
    private function interpretConcentration(float $gini): string
    {
        if ($gini < 0.3) {
            return 'Low concentration - access is relatively evenly distributed';
        } elseif ($gini < 0.5) {
            return 'Moderate concentration - some keys are more frequently accessed';
        } elseif ($gini < 0.7) {
            return 'High concentration - hot keys are significant';
        } else {
            return 'Very high concentration - extreme skew, potential hot key issues';
        }
    }
    
    private function getPercentile(array $sortedArray, float $percentile): float
    {
        $count = count($sortedArray);
        if ($count === 0) {
            return 0;
        }
        
        $index = (int) ceil(($percentile / 100) * $count) - 1;
        $index = max(0, min($index, $count - 1));
        
        return (float) $sortedArray[$index];
    }
    
    private function generateRecommendations(array $hotKeys, array $concentration): array
    {
        $recommendations = [];
        
        $gini = $concentration['gini_coefficient'] ?? 0;
        
        if ($gini >= 0.7) {
            $recommendations[] = [
                'type' => 'hot_key',
                'severity' => 'high',
                'message' => 'Extremely high access concentration detected',
                'recommendation' => 'Implement key sharding or consistent hashing. Consider local caching (L1 cache) for top hot keys. Use multi-layer caching strategy.',
            ];
        } elseif ($gini >= 0.5) {
            $recommendations[] = [
                'type' => 'hot_key',
                'severity' => 'medium',
                'message' => 'High access concentration detected',
                'recommendation' => 'Monitor top hot keys closely. Consider read replicas or scaling. Pre-warm cache for frequently accessed data.',
            ];
        }
        
        if (!empty($hotKeys)) {
            $highMissKeys = array_filter($hotKeys, function ($k) {
                return isset($k['miss_rate']) && $k['miss_rate'] > 0.3;
            });
            
            if (!empty($highMissKeys)) {
                $recommendations[] = [
                    'type' => 'hot_key_miss',
                    'severity' => 'high',
                    'message' => 'Some hot keys have high miss rates',
                    'recommendation' => 'Check TTL settings for hot keys. Consider longer TTL or permanent caching. Implement pre-fetching strategies.',
                ];
            }
        }
        
        return $recommendations;
    }
}
