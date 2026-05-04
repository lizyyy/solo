<?php

namespace CacheAnalyzer\Controller;

use CacheAnalyzer\Simulation\SimulationEngine;
use CacheAnalyzer\Storage\Database;
use Exception;

class SimulationController
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
    
    public function simulateOptimization(): void
    {
        try {
            $data = $this->getJsonInput();
            
            $strategy = $data['strategy'] ?? null;
            $parameters = $data['parameters'] ?? [];
            
            if (!$strategy) {
                $this->errorResponse('Missing required parameter: strategy');
                return;
            }
            
            $validStrategies = [
                SimulationEngine::STRATEGY_TTL_ADJUSTMENT,
                SimulationEngine::STRATEGY_PREWARMING,
                SimulationEngine::STRATEGY_MUTEX_LOCK,
                SimulationEngine::STRATEGY_BLOOM_FILTER,
                SimulationEngine::STRATEGY_STALE_WHILE_REVALIDATE,
                SimulationEngine::STRATEGY_KEY_TIERING,
                SimulationEngine::STRATEGY_TAG_INVALIDATION,
                SimulationEngine::STRATEGY_TTL_JITTER,
                SimulationEngine::STRATEGY_NEGATIVE_CACHING,
            ];
            
            if (!in_array($strategy, $validStrategies, true)) {
                $this->errorResponse(sprintf(
                    'Invalid strategy: %s. Must be one of: %s',
                    $strategy,
                    implode(', ', $validStrategies)
                ));
                return;
            }
            
            $events = $this->database->getCacheEvents();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for simulation. Import data first.', 404);
                return;
            }
            
            $engine = new SimulationEngine();
            $engine->setBaseline($events);
            
            $baselineMetrics = $engine->getBaselineMetrics();
            $simulatedMetrics = $engine->simulateStrategy($strategy, $parameters);
            
            $this->database->saveSimulationResult(
                $strategy,
                $parameters,
                $simulatedMetrics,
                $baselineMetrics
            );
            
            $this->jsonResponse([
                'success' => true,
                'strategy' => $strategy,
                'parameters' => $parameters,
                'baseline' => $baselineMetrics,
                'simulation' => $simulatedMetrics,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function compareStrategies(): void
    {
        try {
            $data = $this->getJsonInput();
            
            $strategies = $data['strategies'] ?? [];
            
            if (empty($strategies)) {
                $this->errorResponse('Missing required parameter: strategies');
                return;
            }
            
            $events = $this->database->getCacheEvents();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for simulation. Import data first.', 404);
                return;
            }
            
            $engine = new SimulationEngine();
            $engine->setBaseline($events);
            
            $result = $engine->compareStrategies($strategies);
            
            $this->jsonResponse([
                'success' => true,
                'baseline' => $result['baseline'],
                'comparisons' => $result['comparisons'],
                'recommendations' => $result['recommendations'],
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function getAvailableStrategies(): void
    {
        $strategies = [
            [
                'strategy' => SimulationEngine::STRATEGY_TTL_ADJUSTMENT,
                'name' => 'TTL Adjustment',
                'description' => 'Adjust TTL values to increase or decrease cache duration',
                'parameters' => [
                    'ttl_multiplier' => ['type' => 'float', 'default' => 2.0, 'description' => 'Multiplier for TTL values'],
                    'max_ttl' => ['type' => 'integer', 'default' => 86400, 'description' => 'Maximum TTL in seconds'],
                ],
                'use_cases' => ['Increase cache hit rate', 'Reduce cache churn'],
            ],
            [
                'strategy' => SimulationEngine::STRATEGY_PREWARMING,
                'name' => 'Cache Prewarming',
                'description' => 'Simulate pre-warming cache with hot keys',
                'parameters' => [
                    'prewarm_keys' => ['type' => 'array', 'default' => [], 'description' => 'Specific keys to prewarm'],
                    'prewarm_ratio' => ['type' => 'float', 'default' => 0.8, 'description' => 'Ratio of top hot keys to prewarm (0.0-1.0)'],
                ],
                'use_cases' => ['Cold start mitigation', 'Peak traffic preparation'],
            ],
            [
                'strategy' => SimulationEngine::STRATEGY_MUTEX_LOCK,
                'name' => 'Mutex Lock',
                'description' => 'Simulate using mutex locks to prevent cache breakdown',
                'parameters' => [
                    'lock_timeout_ms' => ['type' => 'integer', 'default' => 1000, 'description' => 'Lock timeout in milliseconds'],
                    'concurrent_window_seconds' => ['type' => 'float', 'default' => 1.0, 'description' => 'Window to detect concurrent misses'],
                ],
                'use_cases' => ['Prevent cache breakdown', 'Reduce concurrent database queries'],
            ],
            [
                'strategy' => SimulationEngine::STRATEGY_BLOOM_FILTER,
                'name' => 'Bloom Filter',
                'description' => 'Simulate using bloom filters to prevent cache penetration',
                'parameters' => [
                    'false_positive_rate' => ['type' => 'float', 'default' => 0.01, 'description' => 'False positive rate (0.0-1.0)'],
                ],
                'use_cases' => ['Prevent cache penetration', 'Filter non-existent keys'],
            ],
            [
                'strategy' => SimulationEngine::STRATEGY_STALE_WHILE_REVALIDATE,
                'name' => 'Stale-While-Revalidate',
                'description' => 'Serve stale data while refreshing in background',
                'parameters' => [
                    'stale_window_seconds' => ['type' => 'integer', 'default' => 30, 'description' => 'Window to serve stale data'],
                    'revalidate_in_background' => ['type' => 'boolean', 'default' => true, 'description' => 'Whether to revalidate in background'],
                ],
                'use_cases' => ['Improve perceived performance', 'Reduce cache miss latency'],
            ],
            [
                'strategy' => SimulationEngine::STRATEGY_KEY_TIERING,
                'name' => 'Key Tiering',
                'description' => 'Categorize keys by access frequency and apply tiered strategies',
                'parameters' => [
                    'hot_key_threshold' => ['type' => 'float', 'default' => 0.01, 'description' => 'Threshold for hot key classification'],
                    'tier_count' => ['type' => 'integer', 'default' => 3, 'description' => 'Number of tiers'],
                ],
                'use_cases' => ['Resource optimization', 'Different strategies for different key types'],
            ],
            [
                'strategy' => SimulationEngine::STRATEGY_TAG_INVALIDATION,
                'name' => 'Tag-Based Invalidation',
                'description' => 'Simulate tag-based cache invalidation patterns',
                'parameters' => [
                    'tag_group_size' => ['type' => 'integer', 'default' => 100, 'description' => 'Keys per tag group'],
                    'invalidation_pattern' => ['type' => 'string', 'default' => 'per_key', 'description' => 'Invalidation pattern: per_key or tag_based'],
                ],
                'use_cases' => ['Batch invalidation', 'Related data grouping'],
            ],
            [
                'strategy' => SimulationEngine::STRATEGY_TTL_JITTER,
                'name' => 'TTL Jitter',
                'description' => 'Add random jitter to TTL values to prevent avalanche',
                'parameters' => [
                    'jitter_percent' => ['type' => 'integer', 'default' => 10, 'description' => 'Jitter percentage (5-50)'],
                    'jitter_type' => ['type' => 'string', 'default' => 'additive', 'description' => 'Jitter type: additive or multiplicative'],
                ],
                'use_cases' => ['Prevent cache avalanche', 'Distribute expiration times'],
            ],
            [
                'strategy' => SimulationEngine::STRATEGY_NEGATIVE_CACHING,
                'name' => 'Negative Caching',
                'description' => 'Cache negative results (non-existent keys) to prevent penetration',
                'parameters' => [
                    'negative_ttl_seconds' => ['type' => 'integer', 'default' => 60, 'description' => 'TTL for negative cache entries'],
                    'penetration_threshold_ms' => ['type' => 'integer', 'default' => 1000, 'description' => 'Latency threshold for penetration detection'],
                ],
                'use_cases' => ['Prevent cache penetration', 'Reduce database load from non-existent keys'],
            ],
        ];
        
        $this->jsonResponse([
            'success' => true,
            'strategies' => $strategies,
        ]);
    }
    
    public function runRecommendedSimulation(): void
    {
        try {
            $events = $this->database->getCacheEvents();
            
            if (empty($events)) {
                $this->errorResponse('No cache events available for simulation. Import data first.', 404);
                return;
            }
            
            $engine = new SimulationEngine();
            $engine->setBaseline($events);
            
            $strategies = [
                [
                    'strategy' => SimulationEngine::STRATEGY_TTL_ADJUSTMENT,
                    'parameters' => ['ttl_multiplier' => 2.0, 'max_ttl' => 86400],
                ],
                [
                    'strategy' => SimulationEngine::STRATEGY_TTL_JITTER,
                    'parameters' => ['jitter_percent' => 15, 'jitter_type' => 'additive'],
                ],
                [
                    'strategy' => SimulationEngine::STRATEGY_PREWARMING,
                    'parameters' => ['prewarm_ratio' => 0.2],
                ],
                [
                    'strategy' => SimulationEngine::STRATEGY_MUTEX_LOCK,
                    'parameters' => ['lock_timeout_ms' => 1000, 'concurrent_window_seconds' => 1.0],
                ],
                [
                    'strategy' => SimulationEngine::STRATEGY_STALE_WHILE_REVALIDATE,
                    'parameters' => ['stale_window_seconds' => 30],
                ],
            ];
            
            $result = $engine->compareStrategies($strategies);
            
            $this->jsonResponse([
                'success' => true,
                'message' => 'Recommended optimizations simulated',
                'baseline' => $result['baseline'],
                'comparisons' => $result['comparisons'],
                'recommendations' => $result['recommendations'],
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
}
