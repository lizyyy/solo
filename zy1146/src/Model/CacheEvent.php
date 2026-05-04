<?php

namespace CacheAnalyzer\Model;

use DateTime;
use Exception;

class CacheEvent
{
    public const TYPE_HIT = 'hit';
    public const TYPE_MISS = 'miss';
    public const TYPE_SET = 'set';
    public const TYPE_DELETE = 'delete';
    public const TYPE_EXPIRE = 'expire';
    
    public const BACKEND_REDIS = 'redis';
    public const BACKEND_FILE = 'file';
    public const BACKEND_OPCACHE = 'opcache';
    public const BACKEND_MEMCACHED = 'memcached';
    public const BACKEND_APC = 'apc';
    
    private string $id;
    private string $key;
    private string $type;
    private string $backend;
    private float $timestamp;
    private ?float $latencyMs;
    private ?int $ttl;
    private ?int $sizeBytes;
    private ?string $route;
    private ?array $tags;
    private ?string $error;
    
    public function __construct(
        string $key,
        string $type,
        string $backend,
        float $timestamp,
        ?float $latencyMs = null,
        ?int $ttl = null,
        ?int $sizeBytes = null,
        ?string $route = null,
        ?array $tags = null,
        ?string $error = null,
        ?string $id = null
    ) {
        $this->id = $id ?? uniqid('event_', true);
        $this->key = $key;
        $this->type = $type;
        $this->backend = $backend;
        $this->timestamp = $timestamp;
        $this->latencyMs = $latencyMs;
        $this->ttl = $ttl;
        $this->sizeBytes = $sizeBytes;
        $this->route = $route;
        $this->tags = $tags;
        $this->error = $error;
        
        $this->validate();
    }
    
    public static function fromArray(array $data): self
    {
        return new self(
            $data['key'] ?? '',
            $data['type'] ?? '',
            $data['backend'] ?? '',
            $data['timestamp'] ?? microtime(true),
            $data['latency_ms'] ?? $data['latencyMs'] ?? null,
            $data['ttl'] ?? null,
            $data['size_bytes'] ?? $data['sizeBytes'] ?? null,
            $data['route'] ?? null,
            $data['tags'] ?? null,
            $data['error'] ?? null,
            $data['id'] ?? null
        );
    }
    
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'type' => $this->type,
            'backend' => $this->backend,
            'timestamp' => $this->timestamp,
            'latency_ms' => $this->latencyMs,
            'ttl' => $this->ttl,
            'size_bytes' => $this->sizeBytes,
            'route' => $this->route,
            'tags' => $this->tags,
            'error' => $this->error,
        ];
    }
    
    private function validate(): void
    {
        $errors = [];
        
        if (empty($this->key)) {
            $errors[] = 'Cache key is required';
        }
        
        $validTypes = [self::TYPE_HIT, self::TYPE_MISS, self::TYPE_SET, self::TYPE_DELETE, self::TYPE_EXPIRE];
        if (!in_array($this->type, $validTypes, true)) {
            $errors[] = sprintf('Invalid event type: %s. Must be one of: %s', $this->type, implode(', ', $validTypes));
        }
        
        $validBackends = [self::BACKEND_REDIS, self::BACKEND_FILE, self::BACKEND_OPCACHE, self::BACKEND_MEMCACHED, self::BACKEND_APC];
        if (!in_array($this->backend, $validBackends, true)) {
            $errors[] = sprintf('Invalid backend: %s. Must be one of: %s', $this->backend, implode(', ', $validBackends));
        }
        
        if ($this->timestamp <= 0) {
            $errors[] = 'Invalid timestamp: must be a positive number';
        }
        
        if ($this->ttl !== null && $this->ttl < 0) {
            $errors[] = 'TTL cannot be negative';
        }
        
        if ($this->latencyMs !== null && $this->latencyMs < 0) {
            $errors[] = 'Latency cannot be negative';
        }
        
        if ($this->sizeBytes !== null && $this->sizeBytes < 0) {
            $errors[] = 'Size cannot be negative';
        }
        
        if (!empty($errors)) {
            throw new Exception(implode('; ', $errors));
        }
    }
    
    public function getId(): string
    {
        return $this->id;
    }
    
    public function getKey(): string
    {
        return $this->key;
    }
    
    public function getType(): string
    {
        return $this->type;
    }
    
    public function getBackend(): string
    {
        return $this->backend;
    }
    
    public function getTimestamp(): float
    {
        return $this->timestamp;
    }
    
    public function getLatencyMs(): ?float
    {
        return $this->latencyMs;
    }
    
    public function getTtl(): ?int
    {
        return $this->ttl;
    }
    
    public function getSizeBytes(): ?int
    {
        return $this->sizeBytes;
    }
    
    public function getRoute(): ?string
    {
        return $this->route;
    }
    
    public function getTags(): ?array
    {
        return $this->tags;
    }
    
    public function getError(): ?string
    {
        return $this->error;
    }
    
    public function isHit(): bool
    {
        return $this->type === self::TYPE_HIT;
    }
    
    public function isMiss(): bool
    {
        return $this->type === self::TYPE_MISS;
    }
    
    public function isSet(): bool
    {
        return $this->type === self::TYPE_SET;
    }
    
    public function getDateTime(): DateTime
    {
        return DateTime::createFromFormat('U.u', sprintf('%.6f', $this->timestamp));
    }
}
