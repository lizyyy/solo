<?php

namespace CacheAnalyzer\Controller;

use CacheAnalyzer\Analyzer\HitRateAnalyzer;
use CacheAnalyzer\Analyzer\PerformanceAnalyzer;
use CacheAnalyzer\Analyzer\RiskAnalyzer;
use CacheAnalyzer\Analyzer\HotKeyAnalyzer;
use CacheAnalyzer\Analyzer\TtlDistributionAnalyzer;
use CacheAnalyzer\Storage\Database;
use Exception;

class ExportController
{
    private Database $database;
    
    public function __construct(Database $database)
    {
        $this->database = $database;
    }
    
    private function jsonResponse(array $data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    private function errorResponse(string $message, int $statusCode = 400): void
    {
        $this->jsonResponse([
            'error' => $message,
            'success' => false,
        ], $statusCode);
    }
    
    private function getFullAnalysisData(): ?array
    {
        $events = $this->database->getCacheEvents();
        $configs = $this->database->getCacheConfigs();
        $slowQueries = $this->database->getSlowQueries();
        $routes = $this->database->getRoutes();
        
        if (empty($events)) {
            return null;
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
        
        return [
            'results' => $results,
            'events' => $events,
            'configs' => $configs,
            'slowQueries' => $slowQueries,
            'routes' => $routes,
        ];
    }
    
    public function exportJson(): void
    {
        try {
            $data = $this->getFullAnalysisData();
            
            if ($data === null) {
                $this->errorResponse('No cache events available for export', 404);
                return;
            }
            
            $export = [
                'metadata' => [
                    'exported_at' => date('Y-m-d H:i:s'),
                    'export_format' => 'json',
                ],
                'summary' => $this->generateSummary($data),
                'analyses' => $data['results'],
                'data' => [
                    'event_count' => count($data['events']),
                    'config_count' => count($data['configs']),
                    'query_count' => count($data['slowQueries']),
                    'route_count' => count($data['routes']),
                ],
            ];
            
            header('Content-Type: application/json');
            header('Content-Disposition: attachment; filename="cache-analysis-' . date('Y-m-d') . '.json"');
            echo json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            exit;
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function exportMarkdown(): void
    {
        try {
            $data = $this->getFullAnalysisData();
            
            if ($data === null) {
                $this->errorResponse('No cache events available for export', 404);
                return;
            }
            
            $markdown = $this->generateMarkdownReport($data);
            
            header('Content-Type: text/markdown');
            header('Content-Disposition: attachment; filename="cache-analysis-' . date('Y-m-d') . '.md"');
            echo $markdown;
            exit;
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function exportCsv(): void
    {
        try {
            $events = $this->database->getCacheEvents();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for export', 404);
                return;
            }
            
            $output = fopen('php://temp', 'r+');
            
            fputcsv($output, [
                'id', 'key', 'type', 'backend', 'timestamp', 'latency_ms', 
                'ttl', 'size_bytes', 'route', 'error'
            ]);
            
            foreach ($events as $event) {
                fputcsv($output, [
                    $event->getId(),
                    $event->getKey(),
                    $event->getType(),
                    $event->getBackend(),
                    $event->getTimestamp(),
                    $event->getLatencyMs() ?? '',
                    $event->getTtl() ?? '',
                    $event->getSizeBytes() ?? '',
                    $event->getRoute() ?? '',
                    $event->getError() ?? '',
                ]);
            }
            
            rewind($output);
            
            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="cache-events-' . date('Y-m-d') . '.csv"');
            fpassthru($output);
            fclose($output);
            exit;
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    private function generateSummary(array $data): array
    {
        $results = $data['results'];
        $hitRate = $results['hit_rate']['overall'] ?? [];
        $risk = $results['risk'] ?? [];
        $hotKeys = $results['hot_keys'] ?? [];
        
        return [
            'overall_hit_rate' => $hitRate['hit_rate_percent'] ?? 0,
            'total_events' => count($data['events']),
            'overall_risk_level' => $risk['overall_risk_level'] ?? 'low',
            'hot_key_count' => $hotKeys['summary']['hot_key_count'] ?? 0,
            'concentration_gini' => $hotKeys['concentration']['gini_coefficient'] ?? 0,
        ];
    }
    
    private function generateMarkdownReport(array $data): string
    {
        $results = $data['results'];
        $summary = $this->generateSummary($data);
        
        $md = "# 缓存分析报告\n\n";
        $md .= "生成时间: " . date('Y-m-d H:i:s') . "\n\n";
        
        $md .= "## 执行摘要\n\n";
        
        $healthScore = $this->calculateHealthScore($results);
        $md .= "**健康分数: {$healthScore}/100**\n\n";
        
        $md .= "| 指标 | 数值 |\n";
        $md .= "|------|------|\n";
        $md .= "| 整体命中率 | " . number_format($summary['overall_hit_rate'], 2) . "% |\n";
        $md .= "| 事件总数 | " . count($data['events']) . " |\n";
        $md .= "| 风险等级 | " . ucfirst($summary['overall_risk_level']) . " |\n";
        $md .= "| 热Key数量 | " . $summary['hot_key_count'] . " |\n";
        $md .= "| 访问集中度(Gini) | " . number_format($summary['concentration_gini'], 4) . " |\n\n";
        
        $hitRate = $results['hit_rate']['overall'] ?? [];
        $md .= "## 1. 命中率分析\n\n";
        $md .= "| 指标 | 数值 |\n";
        $md .= "|------|------|\n";
        $md .= "| 命中次数 | " . ($hitRate['hits'] ?? 0) . " |\n";
        $md .= "| 未命中次数 | " . ($hitRate['misses'] ?? 0) . " |\n";
        $md .= "| 总请求数 | " . ($hitRate['total_requests'] ?? 0) . " |\n";
        $md .= "| 命中率 | " . number_format($hitRate['hit_rate_percent'] ?? 0, 2) . "% |\n\n";
        
        if (isset($results['hit_rate']['by_backend']) && is_array($results['hit_rate']['by_backend'])) {
            $md .= "### 按缓存后端统计\n\n";
            $md .= "| 后端 | 命中率 | 命中 | 未命中 |\n";
            $md .= "|------|--------|------|--------|\n";
            foreach ($results['hit_rate']['by_backend'] as $backend => $stats) {
                $md .= "| {$backend} | " . number_format($stats['hit_rate_percent'] ?? 0, 2) . "% | " . 
                    ($stats['hits'] ?? 0) . " | " . ($stats['misses'] ?? 0) . " |\n";
            }
            $md .= "\n";
        }
        
        $performance = $results['performance'] ?? [];
        $md .= "## 2. 性能分析\n\n";
        
        if (isset($performance['latency'])) {
            $latency = $performance['latency'];
            $md .= "### 延迟统计\n\n";
            $md .= "| 指标 | P50 | P95 | P99 | 平均值 |\n";
            $md .= "|------|-----|-----|-----|--------|\n";
            
            $hitStats = $latency['hit_latency'] ?? [];
            $missStats = $latency['miss_latency'] ?? [];
            
            $md .= "| 命中延迟 | " . ($hitStats['p50_ms'] ?? '-') . "ms | " . 
                ($hitStats['p95_ms'] ?? '-') . "ms | " . ($hitStats['p99_ms'] ?? '-') . "ms | " . 
                ($hitStats['avg_ms'] ?? '-') . "ms |\n";
            $md .= "| 未命中延迟 | " . ($missStats['p50_ms'] ?? '-') . "ms | " . 
                ($missStats['p95_ms'] ?? '-') . "ms | " . ($missStats['p99_ms'] ?? '-') . "ms | " . 
                ($missStats['avg_ms'] ?? '-') . "ms |\n\n";
        }
        
        $hotKeys = $results['hot_keys'] ?? [];
        $md .= "## 3. 热Key分析\n\n";
        
        if (isset($hotKeys['summary'])) {
            $s = $hotKeys['summary'];
            $md .= "### 摘要\n\n";
            $md .= "- 热Key数量: " . ($s['hot_key_count'] ?? 0) . "\n";
            $md .= "- 热Key访问占比: " . number_format(($s['hot_key_access_ratio'] ?? 0) * 100, 2) . "%\n\n";
        }
        
        if (isset($hotKeys['concentration'])) {
            $c = $hotKeys['concentration'];
            $md .= "### 访问集中度\n\n";
            $md .= "| 指标 | 数值 |\n";
            $md .= "|------|------|\n";
            $md .= "| 基尼系数 | " . number_format($c['gini_coefficient'] ?? 0, 4) . " |\n";
            $md .= "| 集中度等级 | " . ($c['level'] ?? 'low') . " |\n\n";
        }
        
        if (isset($hotKeys['top_keys']) && is_array($hotKeys['top_keys'])) {
            $md .= "### Top 10 热Key\n\n";
            $md .= "| 排名 | Key | 访问次数 | 占比 |\n";
            $md .= "|------|-----|----------|------|\n";
            $count = 0;
            foreach ($hotKeys['top_keys'] as $keyData) {
                if ($count >= 10) break;
                $md .= "| " . ($count + 1) . " | " . ($keyData['key'] ?? 'N/A') . " | " . 
                    ($keyData['access_count'] ?? 0) . " | " . 
                    number_format(($keyData['ratio'] ?? 0) * 100, 2) . "% |\n";
                $count++;
            }
            $md .= "\n";
        }
        
        $ttlDist = $results['ttl_distribution'] ?? [];
        $md .= "## 4. TTL分布分析\n\n";
        
        if (isset($ttlDist['statistics'])) {
            $stats = $ttlDist['statistics'];
            $md .= "### 统计摘要\n\n";
            $md .= "| 指标 | 数值 |\n";
            $md .= "|------|------|\n";
            $md .= "| 有TTL的Set操作 | " . ($stats['count_with_ttl'] ?? 0) . " |\n";
            $md .= "| 最小TTL | " . ($stats['min_seconds'] ?? '-') . "s |\n";
            $md .= "| 最大TTL | " . ($stats['max_seconds'] ?? '-') . "s |\n";
            $md .= "| 平均TTL | " . ($stats['mean_seconds'] ?? '-') . "s |\n";
            $md .= "| 中位数TTL | " . ($stats['median_seconds'] ?? '-') . "s |\n\n";
        }
        
        if (isset($ttlDist['clustering'])) {
            $c = $ttlDist['clustering'];
            $md .= "### TTL聚集风险\n\n";
            $md .= "- 是否聚集: " . (isset($c['is_clustered']) && $c['is_clustered'] ? '是' : '否') . "\n";
            $md .= "- 聚集百分比: " . number_format($c['clustered_percentage'] ?? 0, 2) . "%\n\n";
        }
        
        $risk = $results['risk'] ?? [];
        $md .= "## 5. 风险分析\n\n";
        
        $md .= "**整体风险等级: " . ucfirst($risk['overall_risk_level'] ?? 'low') . "**\n\n";
        
        if (isset($risk['breakdown_risk'])) {
            $b = $risk['breakdown_risk'];
            $md .= "### 击穿风险 (Cache Breakdown)\n\n";
            $md .= "- 风险等级: " . ucfirst($b['risk_level'] ?? 'low') . "\n";
            $md .= "- 风险分数: " . ($b['risk_score'] ?? 0) . "/100\n";
            $md .= "- 并发未命中簇数量: " . ($b['concurrent_miss_clusters'] ?? 0) . "\n";
            if (isset($b['details']) && is_array($b['details'])) {
                foreach ($b['details'] as $d) {
                    $md .= "  - " . ($d['message'] ?? '') . "\n";
                }
            }
            $md .= "\n";
        }
        
        if (isset($risk['penetration_risk'])) {
            $p = $risk['penetration_risk'];
            $md .= "### 穿透风险 (Cache Penetration)\n\n";
            $md .= "- 风险等级: " . ucfirst($p['risk_level'] ?? 'low') . "\n";
            $md .= "- 风险分数: " . ($p['risk_score'] ?? 0) . "/100\n";
            $md .= "- 疑似穿透事件: " . ($p['suspected_penetrations'] ?? 0) . "\n";
            if (isset($p['details']) && is_array($p['details'])) {
                foreach ($p['details'] as $d) {
                    $md .= "  - " . ($d['message'] ?? '') . "\n";
                }
            }
            $md .= "\n";
        }
        
        if (isset($risk['avalanche_risk'])) {
            $a = $risk['avalanche_risk'];
            $md .= "### 雪崩风险 (Cache Avalanche)\n\n";
            $md .= "- 风险等级: " . ucfirst($a['risk_level'] ?? 'low') . "\n";
            $md .= "- 风险分数: " . ($a['risk_score'] ?? 0) . "/100\n";
            $md .= "- TTL聚集百分比: " . number_format($a['ttl_clustering_percent'] ?? 0, 2) . "%\n";
            if (isset($a['details']) && is_array($a['details'])) {
                foreach ($a['details'] as $d) {
                    $md .= "  - " . ($d['message'] ?? '') . "\n";
                }
            }
            $md .= "\n";
        }
        
        if (isset($risk['opcache_issues']) && !empty($risk['opcache_issues'])) {
            $md .= "### OPcache配置异常\n\n";
            foreach ($risk['opcache_issues'] as $issue) {
                $md .= "- **" . ($issue['type'] ?? 'unknown') . "**: " . ($issue['message'] ?? '') . "\n";
                $md .= "  严重程度: " . ($issue['severity'] ?? 'low') . "\n";
            }
            $md .= "\n";
        }
        
        if (isset($risk['slow_query_analysis'])) {
            $sq = $risk['slow_query_analysis'];
            $md .= "### 慢查询分析\n\n";
            $md .= "- 慢查询总数: " . ($sq['total_count'] ?? 0) . "\n";
            $md .= "- 应缓存的读查询: " . ($sq['cacheable_count'] ?? 0) . "\n";
            $md .= "- 已缓存: " . ($sq['cached_count'] ?? 0) . "\n\n";
            
            if (isset($sq['recommendations']) && is_array($sq['recommendations'])) {
                $md .= "### 缓存建议\n\n";
                foreach ($sq['recommendations'] as $rec) {
                    $md .= "- **" . ($rec['table'] ?? 'unknown') . "**\n";
                    $md .= "  建议: " . ($rec['recommendation'] ?? '') . "\n";
                    $md .= "  执行时间: " . ($rec['execution_time_ms'] ?? 0) . "ms\n\n";
                }
            }
        }
        
        $md .= "## 6. 优化建议\n\n";
        
        if (isset($risk['recommendations']) && is_array($risk['recommendations'])) {
            foreach ($risk['recommendations'] as $rec) {
                $md .= "### " . ($rec['category'] ?? 'General') . "\n\n";
                $md .= "**优先级**: " . ucfirst($rec['priority'] ?? 'medium') . "\n\n";
                $md .= ($rec['message'] ?? '') . "\n\n";
                $md .= "**建议行动**:\n";
                if (isset($rec['actions']) && is_array($rec['actions'])) {
                    foreach ($rec['actions'] as $action) {
                        $md .= "- " . $action . "\n";
                    }
                }
                $md .= "\n";
            }
        } else {
            $md .= "基于当前分析，建议考虑以下优化策略：\n\n";
            $md .= "1. **命中率优化**: 如果命中率低于80%，考虑延长TTL、增加缓存容量或预热热Key\n";
            $md .= "2. **风险防护**: 根据风险等级实施相应的防护措施（互斥锁、布隆过滤器、TTL抖动）\n";
            $md .= "3. **性能监控**: 持续监控缓存性能指标，建立基线和告警阈值\n";
            $md .= "\n";
        }
        
        $md .= "---\n\n";
        $md .= "*报告由 Cache Analyzer 生成*\n";
        
        return $md;
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
