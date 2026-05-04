<?php

namespace CacheAnalyzer\Analyzer;

use CacheAnalyzer\Model\CacheEvent;

class PerformanceAnalyzer implements AnalyzerInterface
{
    public function getName(): string
    {
        return 'Performance Analyzer';
    }
    
    public function getDescription(): string
    {
        return 'Analyzes cache performance metrics including latency, P95, P99, and source fetch time';
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
        
        $hitLatencies = [];
        $missLatencies = [];
        $setLatencies = [];
        $sourceFetchTimes = [];
        
        $backendStats = [];
        $keyStats = [];
        $routeStats = [];
        
        $filterBackend = $options['backend'] ?? null;
        $filterRoute = $options['route'] ?? null;
        
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
            
            $backend = $event->getBackend();
            $key = $event->getKey();
            $route = $event->getRoute();
            $type = $event->getType();
            $latency = $event->getLatencyMs();
            
            if (!isset($backendStats[$backend])) {
                $backendStats[$backend] = $this->createStatEntry();
            }
            
            if (!isset($keyStats[$key])) {
                $keyStats[$key] = $this->createStatEntry();
            }
            
            if ($route !== null && !isset($routeStats[$route])) {
                $routeStats[$route] = $this->createStatEntry();
            }
            
            if ($latency !== null) {
                switch ($type) {
                    case CacheEvent::TYPE_HIT:
                        $hitLatencies[] = $latency;
                        $backendStats[$backend]['hitLatencies'][] = $latency;
                        $keyStats[$key]['hitLatencies'][] = $latency;
                        if ($route !== null) {
                            $routeStats[$route]['hitLatencies'][] = $latency;
                        }
                        break;
                        
                    case CacheEvent::TYPE_MISS:
                        $missLatencies[] = $latency;
                        $backendStats[$backend]['missLatencies'][] = $latency;
                        $keyStats[$key]['missLatencies'][] = $latency;
                        if ($route !== null) {
                            $routeStats[$route]['missLatencies'][] = $latency;
                        }
                        
                        $estimatedSourceTime = $latency * 10;
                        $sourceFetchTimes[] = $estimatedSourceTime;
                        $backendStats[$backend]['sourceFetchTimes'][] = $estimatedSourceTime;
                        $keyStats[$key]['sourceFetchTimes'][] = $estimatedSourceTime;
                        if ($route !== null) {
                            $routeStats[$route]['sourceFetchTimes'][] = $estimatedSourceTime;
                        }
                        break;
                        
                    case CacheEvent::TYPE_SET:
                        $setLatencies[] = $latency;
                        $backendStats[$backend]['setLatencies'][] = $latency;
                        $keyStats[$key]['setLatencies'][] = $latency;
                        if ($route !== null) {
                            $routeStats[$route]['setLatencies'][] = $latency;
                        }
                        break;
                }
            }
        }
        
        $result = [
            'overall' => $this->calculatePerformanceMetrics($hitLatencies, $missLatencies, $setLatencies, $sourceFetchTimes),
            'by_backend' => $this->calculateGroupStats($backendStats),
            'by_key' => $this->calculateGroupStats($keyStats),
            'by_route' => $this->calculateGroupStats($routeStats),
        ];
        
        return $result;
    }
    
    private function createStatEntry(): array
    {
        return [
            'hitLatencies' => [],
            'missLatencies' => [],
            'setLatencies' => [],
            'sourceFetchTimes' => [],
        ];
    }
    
    private function calculatePerformanceMetrics(
        array $hitLatencies,
        array $missLatencies,
        array $setLatencies,
        array $sourceFetchTimes
    ): array {
        return [
            'hits' => [
                'count' => count($hitLatencies),
                'avg_ms' => $this->getAverage($hitLatencies),
                'median_ms' => $this->getMedian($hitLatencies),
                'p50_ms' => $this->getPercentile($hitLatencies, 50),
                'p90_ms' => $this->getPercentile($hitLatencies, 90),
                'p95_ms' => $this->getPercentile($hitLatencies, 95),
                'p99_ms' => $this->getPercentile($hitLatencies, 99),
                'min_ms' => $this->getMin($hitLatencies),
                'max_ms' => $this->getMax($hitLatencies),
                'std_dev_ms' => $this->getStdDev($hitLatencies),
            ],
            'misses' => [
                'count' => count($missLatencies),
                'avg_ms' => $this->getAverage($missLatencies),
                'median_ms' => $this->getMedian($missLatencies),
                'p50_ms' => $this->getPercentile($missLatencies, 50),
                'p90_ms' => $this->getPercentile($missLatencies, 90),
                'p95_ms' => $this->getPercentile($missLatencies, 95),
                'p99_ms' => $this->getPercentile($missLatencies, 99),
                'min_ms' => $this->getMin($missLatencies),
                'max_ms' => $this->getMax($missLatencies),
                'std_dev_ms' => $this->getStdDev($missLatencies),
            ],
            'sets' => [
                'count' => count($setLatencies),
                'avg_ms' => $this->getAverage($setLatencies),
                'median_ms' => $this->getMedian($setLatencies),
                'p50_ms' => $this->getPercentile($setLatencies, 50),
                'p90_ms' => $this->getPercentile($setLatencies, 90),
                'p95_ms' => $this->getPercentile($setLatencies, 95),
                'p99_ms' => $this->getPercentile($setLatencies, 99),
                'min_ms' => $this->getMin($setLatencies),
                'max_ms' => $this->getMax($setLatencies),
                'std_dev_ms' => $this->getStdDev($setLatencies),
            ],
            'source_fetch' => [
                'count' => count($sourceFetchTimes),
                'avg_ms' => $this->getAverage($sourceFetchTimes),
                'median_ms' => $this->getMedian($sourceFetchTimes),
                'p95_ms' => $this->getPercentile($sourceFetchTimes, 95),
                'p99_ms' => $this->getPercentile($sourceFetchTimes, 99),
                'min_ms' => $this->getMin($sourceFetchTimes),
                'max_ms' => $this->getMax($sourceFetchTimes),
            ],
        ];
    }
    
    private function calculateGroupStats(array $stats): array
    {
        $result = [];
        
        foreach ($stats as $key => $stat) {
            $result[$key] = $this->calculatePerformanceMetrics(
                $stat['hitLatencies'],
                $stat['missLatencies'],
                $stat['setLatencies'],
                $stat['sourceFetchTimes']
            );
        }
        
        uasort($result, function ($a, $b) {
            $totalA = $a['hits']['count'] + $a['misses']['count'];
            $totalB = $b['hits']['count'] + $b['misses']['count'];
            return $totalB <=> $totalA;
        });
        
        return $result;
    }
    
    private function getAverage(array $values): ?float
    {
        if (empty($values)) {
            return null;
        }
        
        return array_sum($values) / count($values);
    }
    
    private function getMedian(array $values): ?float
    {
        if (empty($values)) {
            return null;
        }
        
        sort($values);
        $count = count($values);
        $mid = floor(($count - 1) / 2);
        
        if ($count % 2) {
            return (float) $values[$mid];
        }
        
        return (float) ($values[$mid] + $values[$mid + 1]) / 2;
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
    
    private function getMin(array $values): ?float
    {
        if (empty($values)) {
            return null;
        }
        
        return (float) min($values);
    }
    
    private function getMax(array $values): ?float
    {
        if (empty($values)) {
            return null;
        }
        
        return (float) max($values);
    }
    
    private function getStdDev(array $values): ?float
    {
        if (count($values) < 2) {
            return null;
        }
        
        $mean = array_sum($values) / count($values);
        $squaredDiffs = array_map(function ($x) use ($mean) {
            return pow($x - $mean, 2);
        }, $values);
        
        $variance = array_sum($squaredDiffs) / (count($values) - 1);
        
        return sqrt($variance);
    }
    
    private function emptyResult(): array
    {
        return [
            'overall' => [
                'hits' => [
                    'count' => 0,
                    'avg_ms' => null,
                    'median_ms' => null,
                    'p50_ms' => null,
                    'p90_ms' => null,
                    'p95_ms' => null,
                    'p99_ms' => null,
                    'min_ms' => null,
                    'max_ms' => null,
                    'std_dev_ms' => null,
                ],
                'misses' => [
                    'count' => 0,
                    'avg_ms' => null,
                    'median_ms' => null,
                    'p50_ms' => null,
                    'p90_ms' => null,
                    'p95_ms' => null,
                    'p99_ms' => null,
                    'min_ms' => null,
                    'max_ms' => null,
                    'std_dev_ms' => null,
                ],
                'sets' => [
                    'count' => 0,
                    'avg_ms' => null,
                    'median_ms' => null,
                    'p50_ms' => null,
                    'p90_ms' => null,
                    'p95_ms' => null,
                    'p99_ms' => null,
                    'min_ms' => null,
                    'max_ms' => null,
                    'std_dev_ms' => null,
                ],
                'source_fetch' => [
                    'count' => 0,
                    'avg_ms' => null,
                    'median_ms' => null,
                    'p95_ms' => null,
                    'p99_ms' => null,
                    'min_ms' => null,
                    'max_ms' => null,
                ],
            ],
            'by_backend' => [],
            'by_key' => [],
            'by_route' => [],
        ];
    }
}
