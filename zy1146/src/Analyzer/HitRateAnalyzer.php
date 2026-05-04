<?php

namespace CacheAnalyzer\Analyzer;

use CacheAnalyzer\Model\CacheEvent;
use Exception;

class HitRateAnalyzer implements AnalyzerInterface
{
    public function getName(): string
    {
        return 'Hit Rate Analyzer';
    }
    
    public function getDescription(): string
    {
        return 'Analyzes cache hit rate by key, route, and backend';
    }
    
    /**
     * @param CacheEvent[] $data
     * @param array $options
     * @return array
     */
    public function analyze(array $data, array $options = []): array
    {
        if (empty($data)) {
            return $this->emptyResult();
        }
        
        $groupBy = $options['group_by'] ?? 'overall';
        $filterBackend = $options['backend'] ?? null;
        $filterRoute = $options['route'] ?? null;
        
        $hits = 0;
        $misses = 0;
        $sets = 0;
        $deletes = 0;
        
        $keyStats = [];
        $routeStats = [];
        $backendStats = [];
        
        $firstTimestamp = null;
        $lastTimestamp = null;
        
        foreach ($data as $event) {
            if (!$event instanceof CacheEvent) {
                continue;
            }
            
            if ($filterBackend !== null && $event->getBackend() !== $filterBackend) {
                continue;
            }
            
            if ($filterRoute !== null && $event->getRoute() !== $filterRoute) {
                continue;
            }
            
            $key = $event->getKey();
            $type = $event->getType();
            $backend = $event->getBackend();
            $route = $event->getRoute();
            $timestamp = $event->getTimestamp();
            
            if ($firstTimestamp === null || $timestamp < $firstTimestamp) {
                $firstTimestamp = $timestamp;
            }
            if ($lastTimestamp === null || $timestamp > $lastTimestamp) {
                $lastTimestamp = $timestamp;
            }
            
            if (!isset($keyStats[$key])) {
                $keyStats[$key] = $this->createStatEntry();
            }
            
            if ($route !== null && !isset($routeStats[$route])) {
                $routeStats[$route] = $this->createStatEntry();
            }
            
            if (!isset($backendStats[$backend])) {
                $backendStats[$backend] = $this->createStatEntry();
            }
            
            switch ($type) {
                case CacheEvent::TYPE_HIT:
                    $hits++;
                    $keyStats[$key]['hits']++;
                    if ($route !== null) {
                        $routeStats[$route]['hits']++;
                    }
                    $backendStats[$backend]['hits']++;
                    
                    if ($event->getLatencyMs() !== null) {
                        $keyStats[$key]['latencyMs'][] = $event->getLatencyMs();
                        if ($route !== null) {
                            $routeStats[$route]['latencyMs'][] = $event->getLatencyMs();
                        }
                        $backendStats[$backend]['latencyMs'][] = $event->getLatencyMs();
                    }
                    break;
                    
                case CacheEvent::TYPE_MISS:
                    $misses++;
                    $keyStats[$key]['misses']++;
                    if ($route !== null) {
                        $routeStats[$route]['misses']++;
                    }
                    $backendStats[$backend]['misses']++;
                    break;
                    
                case CacheEvent::TYPE_SET:
                    $sets++;
                    $keyStats[$key]['sets']++;
                    if ($route !== null) {
                        $routeStats[$route]['sets']++;
                    }
                    $backendStats[$backend]['sets']++;
                    
                    if ($event->getTtl() !== null) {
                        $keyStats[$key]['ttls'][] = $event->getTtl();
                        if ($route !== null) {
                            $routeStats[$route]['ttls'][] = $event->getTtl();
                        }
                        $backendStats[$backend]['ttls'][] = $event->getTtl();
                    }
                    break;
                    
                case CacheEvent::TYPE_DELETE:
                    $deletes++;
                    $keyStats[$key]['deletes']++;
                    if ($route !== null) {
                        $routeStats[$route]['deletes']++;
                    }
                    $backendStats[$backend]['deletes']++;
                    break;
            }
        }
        
        $totalRequests = $hits + $misses;
        $hitRate = $totalRequests > 0 ? $hits / $totalRequests : 0;
        $missRate = $totalRequests > 0 ? $misses / $totalRequests : 0;
        
        $keyStats = $this->calculateStats($keyStats);
        $routeStats = $this->calculateStats($routeStats);
        $backendStats = $this->calculateStats($backendStats);
        
        $result = [
            'overall' => [
                'hits' => $hits,
                'misses' => $misses,
                'sets' => $sets,
                'deletes' => $deletes,
                'total_requests' => $totalRequests,
                'hit_rate' => $hitRate,
                'hit_rate_percent' => round($hitRate * 100, 2),
                'miss_rate' => $missRate,
                'miss_rate_percent' => round($missRate * 100, 2),
            ],
            'by_key' => $keyStats,
            'by_route' => $routeStats,
            'by_backend' => $backendStats,
            'time_range' => [
                'first' => $firstTimestamp,
                'last' => $lastTimestamp,
                'duration_seconds' => $lastTimestamp !== null && $firstTimestamp !== null ? $lastTimestamp - $firstTimestamp : 0,
            ],
        ];
        
        return $result;
    }
    
    private function createStatEntry(): array
    {
        return [
            'hits' => 0,
            'misses' => 0,
            'sets' => 0,
            'deletes' => 0,
            'latencyMs' => [],
            'ttls' => [],
        ];
    }
    
    private function calculateStats(array $stats): array
    {
        foreach ($stats as $key => &$stat) {
            $total = $stat['hits'] + $stat['misses'];
            
            $stat['total_requests'] = $total;
            $stat['hit_rate'] = $total > 0 ? $stat['hits'] / $total : 0;
            $stat['hit_rate_percent'] = round($stat['hit_rate'] * 100, 2);
            
            if (!empty($stat['latencyMs'])) {
                sort($stat['latencyMs']);
                $stat['latency_avg'] = array_sum($stat['latencyMs']) / count($stat['latencyMs']);
                $stat['latency_median'] = $this->getMedian($stat['latencyMs']);
                $stat['latency_p95'] = $this->getPercentile($stat['latencyMs'], 95);
                $stat['latency_p99'] = $this->getPercentile($stat['latencyMs'], 99);
                $stat['latency_min'] = min($stat['latencyMs']);
                $stat['latency_max'] = max($stat['latencyMs']);
            }
            
            if (!empty($stat['ttls'])) {
                sort($stat['ttls']);
                $stat['ttl_avg'] = array_sum($stat['ttls']) / count($stat['ttls']);
                $stat['ttl_median'] = $this->getMedian($stat['ttls']);
                $stat['ttl_min'] = min($stat['ttls']);
                $stat['ttl_max'] = max($stat['ttls']);
            }
            
            unset($stat['latencyMs'], $stat['ttls']);
        }
        
        uasort($stats, function ($a, $b) {
            return $b['total_requests'] <=> $a['total_requests'];
        });
        
        return $stats;
    }
    
    private function getMedian(array $sortedArray): float
    {
        $count = count($sortedArray);
        $mid = floor(($count - 1) / 2);
        
        if ($count % 2) {
            return (float) $sortedArray[$mid];
        }
        
        return (float) ($sortedArray[$mid] + $sortedArray[$mid + 1]) / 2;
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
    
    private function emptyResult(): array
    {
        return [
            'overall' => [
                'hits' => 0,
                'misses' => 0,
                'sets' => 0,
                'deletes' => 0,
                'total_requests' => 0,
                'hit_rate' => 0,
                'hit_rate_percent' => 0,
                'miss_rate' => 0,
                'miss_rate_percent' => 0,
            ],
            'by_key' => [],
            'by_route' => [],
            'by_backend' => [],
            'time_range' => [
                'first' => null,
                'last' => null,
                'duration_seconds' => 0,
            ],
        ];
    }
}
