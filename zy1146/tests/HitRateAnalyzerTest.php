<?php

namespace CacheAnalyzer\Tests;

use CacheAnalyzer\Analyzer\HitRateAnalyzer;
use CacheAnalyzer\Model\CacheEvent;
use PHPUnit\Framework\TestCase;

class HitRateAnalyzerTest extends TestCase
{
    private HitRateAnalyzer $analyzer;
    
    protected function setUp(): void
    {
        $this->analyzer = new HitRateAnalyzer();
    }
    
    public function testAnalyzeReturnsCorrectStructure(): void
    {
        $events = [
            CacheEvent::fromArray([
                'id' => 'evt_1',
                'key' => 'test:key:1',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => 1735689600.0,
            ]),
            CacheEvent::fromArray([
                'id' => 'evt_2',
                'key' => 'test:key:1',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => 1735689601.0,
            ]),
            CacheEvent::fromArray([
                'id' => 'evt_3',
                'key' => 'test:key:2',
                'type' => CacheEvent::TYPE_MISS,
                'backend' => 'redis',
                'timestamp' => 1735689602.0,
            ]),
        ];
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('overall', $result);
        $this->assertArrayHasKey('by_backend', $result);
        $this->assertArrayHasKey('by_key', $result);
    }
    
    public function testHitRateCalculation(): void
    {
        $events = [
            CacheEvent::fromArray(['id' => '1', 'key' => 'k1', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 1.0]),
            CacheEvent::fromArray(['id' => '2', 'key' => 'k2', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 2.0]),
            CacheEvent::fromArray(['id' => '3', 'key' => 'k3', 'type' => CacheEvent::TYPE_MISS, 'backend' => 'redis', 'timestamp' => 3.0]),
            CacheEvent::fromArray(['id' => '4', 'key' => 'k4', 'type' => CacheEvent::TYPE_MISS, 'backend' => 'redis', 'timestamp' => 4.0]),
            CacheEvent::fromArray(['id' => '5', 'key' => 'k5', 'type' => CacheEvent::TYPE_SET, 'backend' => 'redis', 'timestamp' => 5.0]),
        ];
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertEquals(2, $result['overall']['hits']);
        $this->assertEquals(2, $result['overall']['misses']);
        $this->assertEquals(4, $result['overall']['total_requests']);
        $this->assertEquals(50.0, $result['overall']['hit_rate_percent']);
        $this->assertEquals(0.5, $result['overall']['hit_rate']);
    }
    
    public function testEmptyEventsReturnsZeroValues(): void
    {
        $result = $this->analyzer->analyze([]);
        
        $this->assertEquals(0, $result['overall']['hits']);
        $this->assertEquals(0, $result['overall']['misses']);
        $this->assertEquals(0, $result['overall']['total_requests']);
        $this->assertEquals(0.0, $result['overall']['hit_rate_percent']);
        $this->assertEquals(0.0, $result['overall']['hit_rate']);
    }
    
    public function testByBackendAnalysis(): void
    {
        $events = [
            CacheEvent::fromArray(['id' => '1', 'key' => 'k1', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 1.0]),
            CacheEvent::fromArray(['id' => '2', 'key' => 'k2', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 2.0]),
            CacheEvent::fromArray(['id' => '3', 'key' => 'k3', 'type' => CacheEvent::TYPE_MISS, 'backend' => 'redis', 'timestamp' => 3.0]),
            CacheEvent::fromArray(['id' => '4', 'key' => 'k4', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'file', 'timestamp' => 4.0]),
            CacheEvent::fromArray(['id' => '5', 'key' => 'k5', 'type' => CacheEvent::TYPE_MISS, 'backend' => 'file', 'timestamp' => 5.0]),
            CacheEvent::fromArray(['id' => '6', 'key' => 'k6', 'type' => CacheEvent::TYPE_MISS, 'backend' => 'file', 'timestamp' => 6.0]),
        ];
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertArrayHasKey('redis', $result['by_backend']);
        $this->assertArrayHasKey('file', $result['by_backend']);
        
        $redis = $result['by_backend']['redis'];
        $this->assertEquals(2, $redis['hits']);
        $this->assertEquals(1, $redis['misses']);
        $this->assertEqualsWithDelta(66.67, $redis['hit_rate_percent'], 0.01);
        
        $file = $result['by_backend']['file'];
        $this->assertEquals(1, $file['hits']);
        $this->assertEquals(2, $file['misses']);
        $this->assertEqualsWithDelta(33.33, $file['hit_rate_percent'], 0.01);
    }
    
    public function testOnlySetEventsDoesNotAffectHitRate(): void
    {
        $events = [
            CacheEvent::fromArray(['id' => '1', 'key' => 'k1', 'type' => CacheEvent::TYPE_SET, 'backend' => 'redis', 'timestamp' => 1.0, 'ttl' => 3600]),
            CacheEvent::fromArray(['id' => '2', 'key' => 'k2', 'type' => CacheEvent::TYPE_SET, 'backend' => 'redis', 'timestamp' => 2.0, 'ttl' => 3600]),
        ];
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertEquals(0, $result['overall']['hits']);
        $this->assertEquals(0, $result['overall']['misses']);
        $this->assertEquals(0, $result['overall']['total_requests']);
    }
    
    public function testAllHitsGives100Percent(): void
    {
        $events = [];
        for ($i = 0; $i < 10; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_{$i}",
                'key' => "k{$i}",
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => (float) $i,
            ]);
        }
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertEquals(10, $result['overall']['hits']);
        $this->assertEquals(0, $result['overall']['misses']);
        $this->assertEquals(100.0, $result['overall']['hit_rate_percent']);
    }
    
    public function testAllMissesGives0Percent(): void
    {
        $events = [];
        for ($i = 0; $i < 5; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_{$i}",
                'key' => "k{$i}",
                'type' => CacheEvent::TYPE_MISS,
                'backend' => 'redis',
                'timestamp' => (float) $i,
            ]);
        }
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertEquals(0, $result['overall']['hits']);
        $this->assertEquals(5, $result['overall']['misses']);
        $this->assertEquals(0.0, $result['overall']['hit_rate_percent']);
    }
}
