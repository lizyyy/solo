<?php

namespace CacheAnalyzer\Tests;

use CacheAnalyzer\Analyzer\HotKeyAnalyzer;
use CacheAnalyzer\Model\CacheEvent;
use PHPUnit\Framework\TestCase;

class HotKeyAnalyzerTest extends TestCase
{
    private HotKeyAnalyzer $analyzer;
    
    protected function setUp(): void
    {
        $this->analyzer = new HotKeyAnalyzer();
    }
    
    public function testAnalyzeReturnsCorrectStructure(): void
    {
        $events = [
            CacheEvent::fromArray(['id' => '1', 'key' => 'hot:1', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 1.0]),
        ];
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertArrayHasKey('summary', $result);
        $this->assertArrayHasKey('top_keys', $result);
        $this->assertArrayHasKey('concentration', $result);
        $this->assertArrayHasKey('by_backend', $result);
    }
    
    public function testGiniCoefficientCalculation(): void
    {
        $events = [];
        for ($i = 0; $i < 100; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_{$i}",
                'key' => 'hot:key',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => (float) $i,
            ]);
        }
        for ($i = 100; $i < 102; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_{$i}",
                'key' => 'cold:key:' . ($i - 100),
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => (float) $i,
            ]);
        }
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertArrayHasKey('gini_coefficient', $result['concentration']);
        $gini = $result['concentration']['gini_coefficient'];
        $this->assertGreaterThan(0.8, $gini);
    }
    
    public function testTopKeysIdentification(): void
    {
        $events = [];
        for ($i = 0; $i < 50; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_a_{$i}",
                'key' => 'top:key:1',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => (float) $i,
            ]);
        }
        for ($i = 50; $i < 80; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_b_{$i}",
                'key' => 'top:key:2',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => (float) $i,
            ]);
        }
        for ($i = 80; $i < 90; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_c_{$i}",
                'key' => 'top:key:3',
                'type' => CacheEvent::TYPE_MISS,
                'backend' => 'redis',
                'timestamp' => (float) $i,
            ]);
        }
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertCount(3, $result['top_keys']);
        $this->assertEquals('top:key:1', $result['top_keys'][0]['key']);
        $this->assertEquals(50, $result['top_keys'][0]['access_count']);
        $this->assertEquals('top:key:2', $result['top_keys'][1]['key']);
        $this->assertEquals(30, $result['top_keys'][1]['access_count']);
    }
    
    public function testEmptyEventsReturnsEmptyResult(): void
    {
        $result = $this->analyzer->analyze([]);
        
        $this->assertEquals(0, $result['summary']['hot_key_count']);
        $this->assertEquals(0, $result['summary']['total_access_count']);
        $this->assertEmpty($result['top_keys']);
        $this->assertEquals(0.0, $result['concentration']['gini_coefficient']);
    }
    
    public function testByBackendAnalysis(): void
    {
        $events = [
            CacheEvent::fromArray(['id' => '1', 'key' => 'k1', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 1.0]),
            CacheEvent::fromArray(['id' => '2', 'key' => 'k1', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 2.0]),
            CacheEvent::fromArray(['id' => '3', 'key' => 'k2', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'redis', 'timestamp' => 3.0]),
            CacheEvent::fromArray(['id' => '4', 'key' => 'k3', 'type' => CacheEvent::TYPE_HIT, 'backend' => 'file', 'timestamp' => 4.0]),
            CacheEvent::fromArray(['id' => '5', 'key' => 'k3', 'type' => CacheEvent::TYPE_MISS, 'backend' => 'file', 'timestamp' => 5.0]),
        ];
        
        $result = $this->analyzer->analyze($events);
        
        $this->assertArrayHasKey('redis', $result['by_backend']);
        $this->assertArrayHasKey('file', $result['by_backend']);
        $this->assertEquals(3, $result['by_backend']['redis']['total_access_count']);
        $this->assertEquals(2, $result['by_backend']['file']['total_access_count']);
    }
    
    public function testThresholdParameter(): void
    {
        $events = [];
        for ($i = 0; $i < 100; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_{$i}",
                'key' => 'very:hot',
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => (float) $i,
            ]);
        }
        for ($i = 100; $i < 110; $i++) {
            $events[] = CacheEvent::fromArray([
                'id' => "evt_cold_{$i}",
                'key' => 'cold:' . ($i - 100),
                'type' => CacheEvent::TYPE_HIT,
                'backend' => 'redis',
                'timestamp' => (float) $i,
            ]);
        }
        
        $result = $this->analyzer->analyze($events, ['threshold' => 0.5]);
        
        $this->assertEquals(1, $result['summary']['hot_key_count']);
        $this->assertGreaterThan(0.9, $result['summary']['hot_key_access_ratio']);
    }
}
