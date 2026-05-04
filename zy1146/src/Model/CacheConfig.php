<?php

namespace CacheAnalyzer\Model;

use Exception;

class CacheConfig
{
    public const STRATEGY_LRU = 'LRU';
    public const STRATEGY_LFU = 'LFU';
    public const STRATEGY_FIFO = 'FIFO';
    public const STRATEGY_RANDOM = 'RANDOM';
    
    private string $id;
    private string $backend;
    private ?string $name;
    private ?int $maxMemoryMb;
    private ?int $maxConnections;
    private ?string $evictionPolicy;
    private ?bool $persistenceEnabled;
    private ?array $defaultTtl;
    private ?array $keyPrefixes;
    private ?array $opcacheConfig;
    private ?array $redisConfig;
    private ?array $fileConfig;
    private ?array $metadata;
    
    public function __construct(
        string $backend,
        ?string $name = null,
        ?int $maxMemoryMb = null,
        ?int $maxConnections = null,
        ?string $evictionPolicy = null,
        ?bool $persistenceEnabled = null,
        ?array $defaultTtl = null,
        ?array $keyPrefixes = null,
        ?array $opcacheConfig = null,
        ?array $redisConfig = null,
        ?array $fileConfig = null,
        ?array $metadata = null,
        ?string $id = null
    ) {
        $this->id = $id ?? uniqid('config_', true);
        $this->backend = $backend;
        $this->name = $name;
        $this->maxMemoryMb = $maxMemoryMb;
        $this->maxConnections = $maxConnections;
        $this->evictionPolicy = $evictionPolicy;
        $this->persistenceEnabled = $persistenceEnabled;
        $this->defaultTtl = $defaultTtl;
        $this->keyPrefixes = $keyPrefixes;
        $this->opcacheConfig = $opcacheConfig;
        $this->redisConfig = $redisConfig;
        $this->fileConfig = $fileConfig;
        $this->metadata = $metadata;
        
        $this->validate();
    }
    
    public static function fromArray(array $data): self
    {
        return new self(
            $data['backend'] ?? '',
            $data['name'] ?? null,
            $data['max_memory_mb'] ?? $data['maxMemoryMb'] ?? null,
            $data['max_connections'] ?? $data['maxConnections'] ?? null,
            $data['eviction_policy'] ?? $data['evictionPolicy'] ?? null,
            $data['persistence_enabled'] ?? $data['persistenceEnabled'] ?? null,
            $data['default_ttl'] ?? $data['defaultTtl'] ?? null,
            $data['key_prefixes'] ?? $data['keyPrefixes'] ?? null,
            $data['opcache_config'] ?? $data['opcacheConfig'] ?? null,
            $data['redis_config'] ?? $data['redisConfig'] ?? null,
            $data['file_config'] ?? $data['fileConfig'] ?? null,
            $data['metadata'] ?? null,
            $data['id'] ?? null
        );
    }
    
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'backend' => $this->backend,
            'name' => $this->name,
            'max_memory_mb' => $this->maxMemoryMb,
            'max_connections' => $this->maxConnections,
            'eviction_policy' => $this->evictionPolicy,
            'persistence_enabled' => $this->persistenceEnabled,
            'default_ttl' => $this->defaultTtl,
            'key_prefixes' => $this->keyPrefixes,
            'opcache_config' => $this->opcacheConfig,
            'redis_config' => $this->redisConfig,
            'file_config' => $this->fileConfig,
            'metadata' => $this->metadata,
        ];
    }
    
    private function validate(): void
    {
        $errors = [];
        
        $validBackends = [
            CacheEvent::BACKEND_REDIS,
            CacheEvent::BACKEND_FILE,
            CacheEvent::BACKEND_OPCACHE,
            CacheEvent::BACKEND_MEMCACHED,
            CacheEvent::BACKEND_APC,
        ];
        
        if (!in_array($this->backend, $validBackends, true)) {
            $errors[] = sprintf('Invalid backend: %s. Must be one of: %s', $this->backend, implode(', ', $validBackends));
        }
        
        if ($this->maxMemoryMb !== null && $this->maxMemoryMb < 0) {
            $errors[] = 'Max memory cannot be negative';
        }
        
        if ($this->maxConnections !== null && $this->maxConnections < 0) {
            $errors[] = 'Max connections cannot be negative';
        }
        
        $validPolicies = [
            self::STRATEGY_LRU,
            self::STRATEGY_LFU,
            self::STRATEGY_FIFO,
            self::STRATEGY_RANDOM,
        ];
        
        if ($this->evictionPolicy !== null && !in_array($this->evictionPolicy, $validPolicies, true)) {
            $errors[] = sprintf('Invalid eviction policy: %s. Must be one of: %s', $this->evictionPolicy, implode(', ', $validPolicies));
        }
        
        if (!empty($errors)) {
            throw new Exception(implode('; ', $errors));
        }
    }
    
    public function getId(): string
    {
        return $this->id;
    }
    
    public function getBackend(): string
    {
        return $this->backend;
    }
    
    public function getName(): ?string
    {
        return $this->name;
    }
    
    public function getMaxMemoryMb(): ?int
    {
        return $this->maxMemoryMb;
    }
    
    public function getMaxConnections(): ?int
    {
        return $this->maxConnections;
    }
    
    public function getEvictionPolicy(): ?string
    {
        return $this->evictionPolicy;
    }
    
    public function isPersistenceEnabled(): ?bool
    {
        return $this->persistenceEnabled;
    }
    
    public function getDefaultTtl(): ?array
    {
        return $this->defaultTtl;
    }
    
    public function getDefaultTtlForType(string $type): ?int
    {
        if ($this->defaultTtl === null) {
            return null;
        }
        
        return $this->defaultTtl[$type] ?? $this->defaultTtl['default'] ?? null;
    }
    
    public function getKeyPrefixes(): ?array
    {
        return $this->keyPrefixes;
    }
    
    public function getOpcacheConfig(): ?array
    {
        return $this->opcacheConfig;
    }
    
    public function getRedisConfig(): ?array
    {
        return $this->redisConfig;
    }
    
    public function getFileConfig(): ?array
    {
        return $this->fileConfig;
    }
    
    public function getMetadata(): ?array
    {
        return $this->metadata;
    }
    
    public function hasOpcacheIssues(): array
    {
        $issues = [];
        
        if ($this->backend !== CacheEvent::BACKEND_OPCACHE) {
            return $issues;
        }
        
        $config = $this->opcacheConfig ?? [];
        
        if (isset($config['opcache_enabled']) && $config['opcache_enabled'] === false) {
            $issues[] = [
                'type' => 'disabled',
                'severity' => 'high',
                'message' => 'OPcache is disabled',
                'recommendation' => 'Enable OPcache in php.ini with opcache.enable=1'
            ];
        }
        
        if (isset($config['opcache_enable_cli']) && $config['opcache_enable_cli'] === false) {
            $issues[] = [
                'type' => 'cli_disabled',
                'severity' => 'medium',
                'message' => 'OPcache is disabled for CLI',
                'recommendation' => 'Consider enabling opcache.enable_cli=1 for CLI scripts if needed'
            ];
        }
        
        if (isset($config['opcache_memory_consumption']) && $config['opcache_memory_consumption'] < 64) {
            $issues[] = [
                'type' => 'low_memory',
                'severity' => 'medium',
                'message' => sprintf('OPcache memory is low: %d MB', $config['opcache_memory_consumption']),
                'recommendation' => 'Consider increasing opcache.memory_consumption to at least 128 MB'
            ];
        }
        
        if (isset($config['opcache_max_accelerated_files']) && $config['opcache_max_accelerated_files'] < 10000) {
            $issues[] = [
                'type' => 'low_max_files',
                'severity' => 'medium',
                'message' => sprintf('Max accelerated files is low: %d', $config['opcache_max_accelerated_files']),
                'recommendation' => 'Consider increasing opcache.max_accelerated_files to at least 20000'
            ];
        }
        
        if (isset($config['opcache_revalidate_freq']) && $config['opcache_revalidate_freq'] < 60) {
            $issues[] = [
                'type' => 'frequent_revalidation',
                'severity' => 'low',
                'message' => sprintf('Revalidation frequency is high: %d seconds', $config['opcache_revalidate_freq']),
                'recommendation' => 'In production, set opcache.revalidate_freq to 60 or higher, or set opcache.validate_timestamps=0'
            ];
        }
        
        if (isset($config['opcache_validate_timestamps']) && $config['opcache_validate_timestamps'] === true) {
            $issues[] = [
                'type' => 'timestamp_validation',
                'severity' => 'low',
                'message' => 'Timestamp validation is enabled',
                'recommendation' => 'In production, consider setting opcache.validate_timestamps=0 for better performance'
            ];
        }
        
        return $issues;
    }
}
