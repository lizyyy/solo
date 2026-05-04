<?php

namespace CacheAnalyzer\Tests;

use CacheAnalyzer\Importer\CacheEventsImporter;
use CacheAnalyzer\Model\CacheEvent;
use PHPUnit\Framework\TestCase;

class CacheEventsImporterTest extends TestCase
{
    private CacheEventsImporter $importer;
    
    protected function setUp(): void
    {
        $this->importer = new CacheEventsImporter();
    }
    
    public function testImportValidJsonl(): void
    {
        $content = <<<JSONL
{"id": "evt_001", "key": "test:key:1", "type": "HIT", "backend": "redis", "timestamp": 1735689600.0, "latency_ms": 2.5}
{"id": "evt_002", "key": "test:key:2", "type": "MISS", "backend": "redis", "timestamp": 1735689601.0, "latency_ms": 3.2}
{"id": "evt_003", "key": "test:key:3", "type": "SET", "backend": "redis", "timestamp": 1735689602.0, "ttl": 3600, "size_bytes": 1024}
JSONL;
        
        $events = $this->importer->import($content);
        
        $this->assertCount(3, $events);
        $this->assertEquals('evt_001', $events[0]->getId());
        $this->assertEquals(CacheEvent::TYPE_HIT, $events[0]->getType());
        $this->assertEquals('redis', $events[0]->getBackend());
        $this->assertEquals(2.5, $events[0]->getLatencyMs());
        
        $this->assertEquals(CacheEvent::TYPE_MISS, $events[1]->getType());
        $this->assertEquals(CacheEvent::TYPE_SET, $events[2]->getType());
        $this->assertEquals(3600, $events[2]->getTtl());
        $this->assertEquals(1024, $events[2]->getSizeBytes());
    }
    
    public function testImportWithMissingFields(): void
    {
        $content = <<<JSONL
{"id": "evt_001", "key": "test:key:1", "type": "HIT", "backend": "redis", "timestamp": 1735689600.0}
{"id": "evt_002", "key": "test:key:2", "type": "MISS", "backend": "redis"}
{"id": "evt_003", "key": "test:key:3", "type": "SET", "timestamp": 1735689602.0}
{"id": "evt_004", "type": "HIT", "backend": "redis", "timestamp": 1735689603.0}
{"key": "test:key:5", "type": "MISS", "backend": "redis", "timestamp": 1735689604.0}
JSONL;
        
        $events = $this->importer->import($content);
        
        $this->assertCount(1, $events);
        $this->assertEquals('evt_001', $events[0]->getId());
        
        $errors = $this->importer->getErrors();
        $this->assertCount(4, $errors);
    }
    
    public function testImportWithInvalidJson(): void
    {
        $content = <<<JSONL
{"id": "evt_001", "key": "test:key:1", "type": "HIT", "backend": "redis", "timestamp": 1735689600.0
{"id": "evt_002", "key": "test:key:2", "type": "MISS", "backend": "redis", "timestamp": 1735689601.0}
this is not valid JSON at all
{"id": "evt_003", "key": "test:key:3", "type": "SET", "backend": "redis", "timestamp": 1735689602.0, "ttl": 3600}
JSONL;
        
        $events = $this->importer->import($content);
        
        $this->assertCount(2, $events);
        
        $errors = $this->importer->getErrors();
        $this->assertCount(2, $errors);
    }
    
    public function testImportWithInvalidTtl(): void
    {
        $content = <<<JSONL
{"id": "evt_001", "key": "test:key:1", "type": "SET", "backend": "redis", "timestamp": 1735689600.0, "ttl": -3600}
{"id": "evt_002", "key": "test:key:2", "type": "SET", "backend": "redis", "timestamp": 1735689601.0, "ttl": "invalid_string"}
{"id": "evt_003", "key": "test:key:3", "type": "SET", "backend": "redis", "timestamp": 1735689602.0, "ttl": 3600}
JSONL;
        
        $events = $this->importer->import($content);
        
        $this->assertCount(1, $events);
        $this->assertEquals(3600, $events[0]->getTtl());
        
        $errors = $this->importer->getErrors();
        $this->assertCount(2, $errors);
    }
    
    public function testImportWithDuplicateIds(): void
    {
        $content = <<<JSONL
{"id": "evt_001", "key": "test:key:1", "type": "HIT", "backend": "redis", "timestamp": 1735689600.0}
{"id": "evt_001", "key": "test:key:2", "type": "MISS", "backend": "redis", "timestamp": 1735689601.0}
{"id": "evt_002", "key": "test:key:3", "type": "HIT", "backend": "redis", "timestamp": 1735689602.0}
JSONL;
        
        $events = $this->importer->import($content);
        
        $this->assertCount(2, $events);
        
        $errors = $this->importer->getErrors();
        $this->assertCount(1, $errors);
        $this->assertStringContainsString('duplicate', $errors[0]['message']);
    }
    
    public function testImportWithOutOfOrderTimestamps(): void
    {
        $content = <<<JSONL
{"id": "evt_005", "key": "test:key:5", "type": "HIT", "backend": "redis", "timestamp": 1735689605.0}
{"id": "evt_003", "key": "test:key:3", "type": "MISS", "backend": "redis", "timestamp": 1735689603.0}
{"id": "evt_001", "key": "test:key:1", "type": "HIT", "backend": "redis", "timestamp": 1735689601.0}
{"id": "evt_004", "key": "test:key:4", "type": "SET", "backend": "redis", "timestamp": 1735689604.0}
{"id": "evt_002", "key": "test:key:2", "type": "HIT", "backend": "redis", "timestamp": 1735689602.0}
JSONL;
        
        $events = $this->importer->import($content);
        
        $this->assertCount(5, $events);
        
        $stats = $this->importer->getStatistics();
        $this->assertTrue($stats['timestamps_out_of_order']);
    }
    
    public function testImportWithInvalidEventType(): void
    {
        $content = <<<JSONL
{"id": "evt_001", "key": "test:key:1", "type": "INVALID_TYPE", "backend": "redis", "timestamp": 1735689600.0}
{"id": "evt_002", "key": "test:key:2", "type": "HIT", "backend": "redis", "timestamp": 1735689601.0}
JSONL;
        
        $events = $this->importer->import($content);
        
        $this->assertCount(1, $events);
        $this->assertEquals(CacheEvent::TYPE_HIT, $events[0]->getType());
        
        $errors = $this->importer->getErrors();
        $this->assertCount(1, $errors);
        $this->assertStringContainsString('type', $errors[0]['message']);
    }
    
    public function testEmptyContent(): void
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Empty content');
        
        $this->importer->import('');
    }
    
    public function testWhitespaceOnlyContent(): void
    {
        $this->expectException(\Exception::class);
        
        $this->importer->import("   \n\n   \n");
    }
    
    public function testGetStatistics(): void
    {
        $content = <<<JSONL
{"id": "evt_001", "key": "test:key:1", "type": "HIT", "backend": "redis", "timestamp": 1735689600.0}
{"id": "evt_002", "key": "test:key:2", "type": "MISS", "backend": "redis", "timestamp": 1735689601.0}
{"id": "evt_003", "key": "test:key:3", "type": "SET", "backend": "redis", "timestamp": 1735689602.0, "ttl": 3600}
JSONL;
        
        $this->importer->import($content);
        $stats = $this->importer->getStatistics();
        
        $this->assertEquals(3, $stats['total_lines']);
        $this->assertEquals(3, $stats['valid_events']);
        $this->assertEquals(0, $stats['invalid_events']);
        $this->assertFalse($stats['timestamps_out_of_order']);
    }
}
