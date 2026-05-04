<?php

namespace CacheAnalyzer\Controller;

use CacheAnalyzer\Analyzer\HitRateAnalyzer;
use CacheAnalyzer\Analyzer\PerformanceAnalyzer;
use CacheAnalyzer\Analyzer\RiskAnalyzer;
use CacheAnalyzer\Analyzer\HotKeyAnalyzer;
use CacheAnalyzer\Analyzer\TtlDistributionAnalyzer;
use CacheAnalyzer\Storage\Database;
use Exception;

class AnalysisController
{
    private Database $database;
    
    public function __construct(Database $database)
    {
        $this->database = $database;
    }
    
    private function getJsonInput(): array
    {
        $content = file_get_contents('php://input');
        if ($content === false || empty($content)) {
            return [];
        }
        
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [];
        }
        
        return $data ?? [];
    }
    
    private function jsonResponse(array $data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    private function errorResponse(string $message, int $statusCode = 400, ?array $details = null): void
    {
        $response = [
            'error' => $message,
            'success' => false,
        ];
        
        if ($details !== null) {
            $response['details'] = $details;
        }
        
        $this->jsonResponse($response, $statusCode);
    }
    
    private function getEventsFromQueryParams(): array
    {
        $filters = [];
        
        if (isset($_GET['backend']) && $_GET['backend'] !== '') {
            $filters['backend'] = $_GET['backend'];
        }
        
        if (isset($_GET['route']) && $_GET['route'] !== '') {
            $filters['route'] = $_GET['route'];
        }
        
        if (isset($_GET['start_time']) && is_numeric($_GET['start_time'])) {
            $filters['start_time'] = (float) $_GET['start_time'];
        }
        
        if (isset($_GET['end_time']) && is_numeric($_GET['end_time'])) {
            $filters['end_time'] = (float) $_GET['end_time'];
        }
        
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : null;
        $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : null;
        
        return $this->database->getCacheEvents($filters, $limit, $offset);
    }
    
    public function getHitRateAnalysis(): void
    {
        try {
            $events = $this->getEventsFromQueryParams();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for analysis', 404);
                return;
            }
            
            $analyzer = new HitRateAnalyzer();
            
            $options = [];
            if (isset($_GET['group_by'])) {
                $options['group_by'] = $_GET['group_by'];
            }
            
            $result = $analyzer->analyze($events, $options);
            
            $this->jsonResponse([
                'success' => true,
                'analysis_type' => 'hit_rate',
                'result' => $result,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function getPerformanceAnalysis(): void
    {
        try {
            $events = $this->getEventsFromQueryParams();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for analysis', 404);
                return;
            }
            
            $analyzer = new PerformanceAnalyzer();
            
            $options = [];
            if (isset($_GET['backend'])) {
                $options['backend'] = $_GET['backend'];
            }
            if (isset($_GET['route'])) {
                $options['route'] = $_GET['route'];
            }
            
            $result = $analyzer->analyze($events, $options);
            
            $this->jsonResponse([
                'success' => true,
                'analysis_type' => 'performance',
                'result' => $result,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function getHotKeysAnalysis(): void
    {
        try {
            $events = $this->getEventsFromQueryParams();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for analysis', 404);
                return;
            }
            
            $analyzer = new HotKeyAnalyzer();
            
            $options = [];
            if (isset($_GET['threshold']) && is_numeric($_GET['threshold'])) {
                $options['threshold'] = (float) $_GET['threshold'];
            }
            if (isset($_GET['top_n']) && is_numeric($_GET['top_n'])) {
                $options['top_n'] = (int) $_GET['top_n'];
            }
            
            $result = $analyzer->analyze($events, $options);
            
            $this->jsonResponse([
                'success' => true,
                'analysis_type' => 'hot_keys',
                'result' => $result,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function getTtlDistributionAnalysis(): void
    {
        try {
            $events = $this->getEventsFromQueryParams();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for analysis', 404);
                return;
            }
            
            $analyzer = new TtlDistributionAnalyzer();
            
            $result = $analyzer->analyze($events, []);
            
            $this->jsonResponse([
                'success' => true,
                'analysis_type' => 'ttl_distribution',
                'result' => $result,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function getRiskAnalysis(): void
    {
        try {
            $events = $this->getEventsFromQueryParams();
            $configs = $this->database->getCacheConfigs();
            $slowQueries = $this->database->getSlowQueries();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for analysis', 404);
                return;
            }
            
            $analyzer = new RiskAnalyzer();
            
            $options = [
                'cache_configs' => $configs,
                'slow_queries' => $slowQueries,
            ];
            
            $result = $analyzer->analyze($events, $options);
            
            $this->jsonResponse([
                'success' => true,
                'analysis_type' => 'risk',
                'result' => $result,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function runFullAnalysis(): void
    {
        try {
            $events = $this->getEventsFromQueryParams();
            $configs = $this->database->getCacheConfigs();
            $slowQueries = $this->database->getSlowQueries();
            $routes = $this->database->getRoutes();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for analysis', 404);
                return;
            }
            
            $results = [];
            
            $hitRateAnalyzer = new HitRateAnalyzer();
            $results['hit_rate'] = $hitRateAnalyzer->analyze($events);
            
            $performanceAnalyzer = new PerformanceAnalyzer();
            $results['performance'] = $performanceAnalyzer->analyze($events);
            
            $hotKeyAnalyzer = new HotKeyAnalyzer();
            $results['hot_keys'] = $hotKeyAnalyzer->analyze($events);
            
            $ttlAnalyzer = new TtlDistributionAnalyzer();
            $results['ttl_distribution'] = $ttlAnalyzer->analyze($events);
            
            $riskAnalyzer = new RiskAnalyzer();
            $results['risk'] = $riskAnalyzer->analyze($events, [
                'cache_configs' => $configs,
                'slow_queries' => $slowQueries,
            ]);
            
            $summary = $this->generateSummary($results, $events, $configs, $slowQueries, $routes);
            
            $fullResult = [
                'summary' => $summary,
                'analyses' => $results,
                'metadata' => [
                    'generated_at' => microtime(true),
                    'event_count' => count($events),
                    'config_count' => count($configs),
                    'query_count' => count($slowQueries),
                    'route_count' => count($routes),
                ],
            ];
            
            $this->database->saveAnalysisResult('full', $fullResult);
            
            $this->jsonResponse([
                'success' => true,
                'analysis_type' => 'full',
                'result' => $fullResult,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    private function generateSummary(array $results, array $events, array $configs, array $slowQueries, array $routes): array
    {
        $hitRate = $results['hit_rate']['overall'] ?? [];
        $risk = $results['risk'] ?? [];
        $hotKeys = $results['hot_keys'] ?? [];
        
        $overallHitRate = $hitRate['hit_rate_percent'] ?? 0;
        
        $riskLevel = $risk['overall_risk_level'] ?? 'low';
        
        $hotKeyCount = $hotKeys['summary']['hot_key_count'] ?? 0;
        
        $giniCoefficient = $hotKeys['concentration']['gini_coefficient'] ?? 0;
        
        $recommendations = [];
        
        if ($overallHitRate < 60) {
            $recommendations[] = [
                'type' => 'low_hit_rate',
                'priority' => 'high',
                'message' => sprintf('Overall hit rate is %.2f%%, which is below ideal threshold', $overallHitRate),
                'recommendation' => 'Review caching strategy. Consider longer TTLs, pre-warming, or increasing cache size.',
            ];
        }
        
        if ($riskLevel === 'high' || $riskLevel === 'critical') {
            $recommendations[] = [
                'type' => 'high_risk',
                'priority' => 'critical',
                'message' => sprintf('Overall risk level is %s', $riskLevel),
                'recommendation' => 'Address high-priority risks immediately. Check the risk analysis for details.',
            ];
        }
        
        if ($giniCoefficient > 0.7) {
            $recommendations[] = [
                'type' => 'extreme_concentration',
                'priority' => 'high',
                'message' => 'Extreme access concentration detected (Gini > 0.7)',
                'recommendation' => 'Consider sharding or read replicas for hot keys. Implement L1 local caching.',
            ];
        }
        
        $slowReadQueries = array_filter($slowQueries, function ($q) {
            return $q->isReadQuery() && $q->shouldCache();
        });
        
        if (!empty($slowReadQueries)) {
            $recommendations[] = [
                'type' => 'uncached_slow_queries',
                'priority' => 'high',
                'message' => sprintf('Found %d slow read queries that should be cached', count($slowReadQueries)),
                'recommendation' => 'Cache these query results with appropriate TTL. Consider query optimization.',
            ];
        }
        
        return [
            'overall_health_score' => $this->calculateHealthScore($results),
            'overall_hit_rate' => $overallHitRate,
            'overall_risk_level' => $riskLevel,
            'hot_key_count' => $hotKeyCount,
            'concentration_gini' => $giniCoefficient,
            'recommendations' => $recommendations,
            'quick_facts' => [
                'total_events' => count($events),
                'total_configs' => count($configs),
                'total_slow_queries' => count($slowQueries),
                'total_routes' => count($routes),
            ],
        ];
    }
    
    private function calculateHealthScore(array $results): int
    {
        $score = 100;
        
        $hitRate = $results['hit_rate']['overall']['hit_rate_percent'] ?? 50;
        if ($hitRate < 50) {
            $score -= 30;
        } elseif ($hitRate < 70) {
            $score -= 15;
        } elseif ($hitRate < 85) {
            $score -= 5;
        }
        
        $riskLevel = $results['risk']['overall_risk_level'] ?? 'low';
        if ($riskLevel === 'critical') {
            $score -= 40;
        } elseif ($riskLevel === 'high') {
            $score -= 20;
        } elseif ($riskLevel === 'medium') {
            $score -= 10;
        }
        
        $gini = $results['hot_keys']['concentration']['gini_coefficient'] ?? 0;
        if ($gini > 0.8) {
            $score -= 15;
        } elseif ($gini > 0.6) {
            $score -= 10;
        }
        
        return max(0, min(100, $score));
    }
}
