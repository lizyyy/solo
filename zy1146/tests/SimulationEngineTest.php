<?php

namespace CacheAnalyzer\Tests;

use CacheAnalyzer\Simulation\SimulationEngine;
use CacheAnalyzer\Model\CacheEvent;
use PHPUnit\Framework\TestCase;

class SimulationEngineTest extends TestCase
{
    private SimulationEngine $engine;
    
    protected function setUp(): void
    {
        $this->engine = new SimulationEngine();
    }
    
    private function createTestEvents(): array
    {
        $events = [];
        
        for ($i = 0; $i < 8; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_hot_{$i}",
                'key' => 'hot:key:1',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => (float) $i,
                'latency_ms' => 2.0,
            ]);
        }
        
        for ($i = 8; $i < 12; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_cold_{$i}",
                'key' => 'cold:key:1',
                'type' => CacheEvent::TYPE_MISS,
                'backend' => 'redis',
                'timestamp' => (float) $i,
                'latency_ms' => 5.0,
            ]);
        }
        
        $events[] = CacheEvent::fromArray([
            'id' => 'evt_set_1',
            'key' => 'ttl:key:1',
            'type' => CacheEvent::TYPE_SET,
            'backend' => 'redis',
            'timestamp' => 12.0,
            'ttl' => 3600,
            'latency_ms' => 10.0,
        ]);
        
        return $events;
    }
    
    public function testSetBaselineCalculatesMetrics(): void
    {
        $events = $this->createTestEvents();
        $this->engine->setBaseline($events);
        
        $metrics = $this->engine->getBaselineMetrics();
        
        $this->assertArrayHasKey('summary', $metrics);
        $this->assertArrayHasKey('latency', $metrics);
        $this->assertArrayHasKey('risks', $metrics);
        
        $this->assertEquals(8, $metrics['summary']['hits']);
        $this->assertEquals(4, $metrics['summary']['misses']);
        $this->assertEquals(12, $metrics['summary']['total_requests']);
        $this->assertEqualsWithDelta(66.67, $metrics['summary']['hit_rate_percent'], 0.01);
    }
    
    public function testSimulateTtlAdjustment(): void
    {
        $events = [
            CacheEvent::fromArray(['id' => '1', 'key' => 'k1', 'type' => CacheEvent::TYPE_SET, 'backend' => 'redis', 'timestamp' => 1.0, 'ttl' => 3600]),
            CacheEvent::fromArray(['id' => '2', 'key' => 'k2', 'type' => CacheEvent::TYPE_SET, 'backend' => 'redis', 'timestamp' => 2.0, 'ttl' => 1800]),
        ];
        
        $this->engine->setBaseline($events);
        
        $result = $this->engine->simulateStrategy(
            SimulationEngine::STRATEGY_TTL_ADJUSTMENT,
            ['ttl_multiplier' => 2.0, 'max_ttl' => 86400]
        );
        
        $this->assertArrayHasKey('simulation_info', $result);
        $this->assertEquals(2, $result['simulation_info']['events_modified']);
        $this->assertEquals(100, $result['simulation_info']['avg_ttl_increase_percent']);
    }
    
    public function testSimulatePrewarming(): void
    {
        $events = [];
        for ($i = 0; $i < 10; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_miss_{$i}",
                'key' => 'hot:key',
                'type' => CacheEvent::TYPE_MISS,
                'backend' => 'redis',
                'timestamp' => (float) $i,
                'latency_ms' => 5.0,
            ]);
        }
        
        $this->engine->setBaseline($events);
        $baseline = $this->engine->getBaselineMetrics();
        
        $this->assertEquals(0, $baseline['summary']['hits']);
        $this->assertEquals(10, $baseline['summary']['misses']);
        
        $result = $this->engine->simulateStrategy(
            SimulationEngine::STRATEGY_PREWARMING,
            ['prewarm_ratio' => 1.0]
        );
        
        $this->assertEquals(10, $result['simulation_info']['misses_converted_to_hits']);
        $this->assertEquals(1, $result['simulation_info']['keys_prewarmed']);
    }
    
    public function testSimulateTtlJitter(): void
    {
        $events = [];
        for ($i = 0; $i < 10; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_set_{$i}",
                'key' => "k{$i}",
                'type' => CacheEvent::TYPE_SET,
                'backend' => 'redis',
                'timestamp' => 1.0,
                'ttl' => 3600,
            ]);
        }
        
        $this->engine->setBaseline($events);
        
        $result = $this->engine->simulateStrategy(
            SimulationEngine::STRATEGY_TTL_JITTER,
            ['jitter_percent' => 15, 'jitter_type' => 'additive']
        );
        
        $this->assertEquals(10, $result['simulation_info']['events_modified']);
        $this->assertArrayHasKey('clustering_reduction_percent', $result['simulation_info']);
    }
    
    public function testCompareStrategies(): void
    {
        $events = $this->createTestEvents();
        $this->engine->setBaseline($events);
        
        $strategies = [
            [
                'strategy' => SimulationEngine::STRATEGY_TTL_ADJUSTMENT,
                'parameters' => ['ttl_multiplier' => 2.0],
            ],
            [
                'strategy' => SimulationEngine::STRATEGY_PREWARMING,
                'parameters' => ['prewarm_ratio' => 0.5],
            ],
        ];
        
        $result = $this->engine->compareStrategies($strategies);
        
        $this->assertArrayHasKey('baseline', $result);
        $this->assertArrayHasKey('comparisons', $result);
        $this->assertArrayHasKey('recommendations', $result);
        $this->assertCount(2, $result['comparisons']);
    }
    
    public function testGetAvailableStrategies(): void
    {
        $reflection = new \ReflectionClass(SimulationEngine::class);
        $constants = $reflection->getConstants();
        
        $strategyConstants = array_filter($constants, function ($name) {
            return str_starts_with($name, 'STRATEGY_');
        }, ARRAY_FILTER_USE_KEY);
        
        $this->assertCount(9, $strategyConstants);
        
        $expectedStrategies = [
            'STRATEGY_TTL_ADJUSTMENT' => 'ttl_adjustment',
            'STRATEGY_PREWARMING' => 'prewarming',
            'STRATEGY_MUTEX_LOCK' => 'mutex_lock',
            'STRATEGY_BLOOM_FILTER' => 'bloom_filter',
            'STRATEGY_STALE_WHILE_REVALIDATE' => 'stale_while_revalidate',
            'STRATEGY_KEY_TIERING' => 'key_tiering',
            'STRATEGY_TAG_INVALIDATION' => 'tag_invalidation',
            'STRATEGY_TTL_JITTER' => 'ttl_jitter',
            'STRATEGY_NEGATIVE_CACHING' => 'negative_caching',
        ];
        
        foreach ($expectedStrategies as $constant => $value) {
            $this->assertEquals($value, $constants[$constant]);
        }
    }
    
    public function testSimulateUnknownStrategyThrowsException(): void
    {
        $events = $this->createTestEvents();
        $this->engine->setBaseline($events);
        
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Unknown strategy');
        
        $this->engine->simulateStrategy('unknown_strategy', []);
    }
    
    public function testConcurrentMissClusteringDetection(): void
    {
        $events = [];
        for ($i = 0; $i < 10; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_{$i}",
                'key' => 'hot:miss:key',
                'type' => CacheEvent::TYPE_MISS,
                'backend' => 'redis',
                'timestamp' => 1.0 + ($i * 0.05),
                'latency_ms' => 5.0,
            ]);
        }
        
        $this->engine->setBaseline($events);
        $baseline = $this->engine->getBaselineMetrics();
        
        $this->assertTrue($baseline['risks']['concurrent_miss_clusters']['has_clusters']);
        $this->assertGreaterThan(0, $baseline['risks']['concurrent_miss_clusters']['cluster_count']);
    }
}
