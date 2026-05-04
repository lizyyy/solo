<?php

namespace CacheAnalyzer\Tests;

use CacheAnalyzer\Analyzer\PerformanceAnalyzer;
use CacheAnalyzer\Model\CacheEvent;
use PHPUnit\Framework\TestCase;

class PerformanceAnalyzerTest extends TestCase
{
    private PerformanceAnalyzer $analyzer;
    
    protected function setUp(): void
    {
        $this->analyzer = new PerformanceAnalyzer();
    }
    
    public function testAnalyzeReturnsCorrectStructure(): void
    {
        $events = [
            CacheEvent::fromArray([
                'id' => '1',
                'key' => 'k1',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => 1.0,
                'latency_ms' => 2.5,
            ]),
        ];
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertArrayHasKey('latency', $result);
        $this->assertArrayHasKey('source_fetch', $result);
        $this->assertArrayHasKey('percentiles', $result);
    }
    
    public function testPercentileCalculation(): void
    {
        $events = [];
        $latencies = range(1, 100);
        foreach ($latencies as $i => $latency) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_{$i}",
                'key' => "k{$i}",
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => (float) $i,
                'latency_ms' => $latency,
            ]);
        }
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertEquals(50, $result['latency']['hit_latency']['p50_ms']);
        $this->assertEquals(95, $result['latency']['hit_latency']['p95_ms']);
        $this->assertEquals(99, $result['latency']['hit_latency']['p99_ms']);
    }
    
    public function testSourceFetchTimeEstimation(): void
    {
        $events = [];
        for ($i = 0; $i < 5; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_miss_{$i}",
                'key' => "miss:{$i}",
                'type' => CacheEvent::TYPE_MISS,
                'backend' => 'redis',
                'timestamp' => (float) $i,
                'latency_ms' => 5.0,
            ]);
        }
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertEquals(5, $result['source_fetch']['miss_count']);
        $this->assertEquals(250, $result['source_fetch']['estimated_total_ms']);
    }
    
    public function testEmptyEventsReturnsEmptyResult(): void
    {
        $result = $this->analyzer->analyze([]);
        
        $this->assertEmpty($result['latency']['hit_latency']);
        $this->assertEquals(0, $result['source_fetch']['miss_count']);
    }
    
    public function testEventsWithoutLatencyAreIgnored(): void
    {
        $events = [
            CacheEvent::fromArray([
                'id' => '1',
                'key' => 'k1',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => 1.0,
                'latency_ms' => null,
            ]),
            CacheEvent::fromArray([
                'id' => '2',
                'key' => 'k2',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => 2.0,
                'latency_ms' => 5.0,
            ]),
        ];
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertEquals(1, $result['latency']['hit_latency']['count']);
        $this->assertEquals(5.0, $result['latency']['hit_latency']['avg_ms']);
    }
    
    public function testHitVsMissLatencyComparison(): void
    {
        $events = [
            CacheEvent::fromArray(['id' => 'h1', 'key' => 'kh1', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 1.0, 'latency_ms' => 2.0]),
            CacheEvent::fromArray(['id' => 'h2', 'key' => 'kh2', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 2.0, 'latency_ms' => 3.0]),
            CacheEvent::fromArray(['id' => 'h3', 'key' => 'kh3', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 3.0, 'latency_ms' => 4.0]),
            CacheEvent::fromArray(['id' => 'm1', 'key' => 'km1', 'type' => CacheEvent::TYPE_MISS, 'backend' => 'redis', 'timestamp' => 4.0, 'latency_ms' => 50.0]),
            CacheEvent::fromArray(['id' => 'm2', 'key' => 'km2', 'type' => CacheEvent::TYPE_MISS, 'backend' => 'redis', 'timestamp' => 5.0, 'latency_ms' => 60.0]),
        ];
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertEquals(3, $result['latency']['hit_latency']['count']);
        $this->assertEquals(2, $result['latency']['miss_latency']['count']);
        $this->assertEquals(3.0, $result['latency']['hit_latency']['avg_ms']);
        $this->assertEquals(55.0, $result['latency']['miss_latency']['avg_ms']);
    }
}
