<?php

namespace CacheAnalyzer\Model;

use Exception;

class Route
{
    public const METHOD_GET = 'GET';
    public const METHOD_POST = 'POST';
    public const METHOD_PUT = 'PUT';
    public const METHOD_DELETE = 'DELETE';
    public const METHOD_PATCH = 'PATCH';
    
    private string $id;
    private string $path;
    private string $method;
    private ?string $name;
    private ?float $avgResponseTimeMs;
    private ?float $p95ResponseTimeMs;
    private ?float $p99ResponseTimeMs;
    private ?int $requestCount;
    private ?int $errorCount;
    private ?float $cacheHitRate;
    private ?array $relatedCacheKeys;
    private ?array $metadata;
    
    public function __construct(
        string $path,
        string $method = self::METHOD_GET,
        ?string $name = null,
        ?float $avgResponseTimeMs = null,
        ?float $p95ResponseTimeMs = null,
        ?float $p99ResponseTimeMs = null,
        ?int $requestCount = null,
        ?int $errorCount = null,
        ?float $cacheHitRate = null,
        ?array $relatedCacheKeys = null,
        ?array $metadata = null,
        ?string $id = null
    ) {
        $this->id = $id ?? uniqid('route_', true);
        $this->path = $path;
        $this->method = strtoupper($method);
        $this->name = $name;
        $this->avgResponseTimeMs = $avgResponseTimeMs;
        $this->p95ResponseTimeMs = $p95ResponseTimeMs;
        $this->p99ResponseTimeMs = $p99ResponseTimeMs;
        $this->requestCount = $requestCount;
        $this->errorCount = $errorCount;
        $this->cacheHitRate = $cacheHitRate;
        $this->relatedCacheKeys = $relatedCacheKeys;
        $this->metadata = $metadata;
        
        $this->validate();
    }
    
    public static function fromArray(array $data): self
    {
        return new self(
            $data['path'] ?? '',
            $data['method'] ?? self::METHOD_GET,
            $data['name'] ?? $data['route_name'] ?? null,
            $data['avg_response_time_ms'] ?? $data['avgResponseTimeMs'] ?? null,
            $data['p95_response_time_ms'] ?? $data['p95ResponseTimeMs'] ?? null,
            $data['p99_response_time_ms'] ?? $data['p99ResponseTimeMs'] ?? null,
            $data['request_count'] ?? $data['requestCount'] ?? null,
            $data['error_count'] ?? $data['errorCount'] ?? null,
            $data['cache_hit_rate'] ?? $data['cacheHitRate'] ?? null,
            $data['related_cache_keys'] ?? $data['relatedCacheKeys'] ?? null,
            $data['metadata'] ?? null,
            $data['id'] ?? null
        );
    }
    
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'path' => $this->path,
            'method' => $this->method,
            'name' => $this->name,
            'avg_response_time_ms' => $this->avgResponseTimeMs,
            'p95_response_time_ms' => $this->p95ResponseTimeMs,
            'p99_response_time_ms' => $this->p99ResponseTimeMs,
            'request_count' => $this->requestCount,
            'error_count' => $this->errorCount,
            'cache_hit_rate' => $this->cacheHitRate,
            'related_cache_keys' => $this->relatedCacheKeys,
            'metadata' => $this->metadata,
        ];
    }
    
    private function validate(): void
    {
        $errors = [];
        
        if (empty($this->path)) {
            $errors[] = 'Route path is required';
        }
        
        $validMethods = [
            self::METHOD_GET,
            self::METHOD_POST,
            self::METHOD_PUT,
            self::METHOD_DELETE,
            self::METHOD_PATCH,
        ];
        
        if (!in_array($this->method, $validMethods, true)) {
            $errors[] = sprintf('Invalid HTTP method: %s. Must be one of: %s', $this->method, implode(', ', $validMethods));
        }
        
        if ($this->avgResponseTimeMs !== null && $this->avgResponseTimeMs < 0) {
            $errors[] = 'Average response time cannot be negative';
        }
        
        if ($this->p95ResponseTimeMs !== null && $this->p95ResponseTimeMs < 0) {
            $errors[] = 'P95 response time cannot be negative';
        }
        
        if ($this->p99ResponseTimeMs !== null && $this->p99ResponseTimeMs < 0) {
            $errors[] = 'P99 response time cannot be negative';
        }
        
        if ($this->requestCount !== null && $this->requestCount < 0) {
            $errors[] = 'Request count cannot be negative';
        }
        
        if ($this->errorCount !== null && $this->errorCount < 0) {
            $errors[] = 'Error count cannot be negative';
        }
        
        if ($this->cacheHitRate !== null) {
            if ($this->cacheHitRate < 0 || $this->cacheHitRate > 1) {
                $errors[] = 'Cache hit rate must be between 0 and 1';
            }
        }
        
        if (!empty($errors)) {
            throw new Exception(implode('; ', $errors));
        }
    }
    
    public function getId(): string
    {
        return $this->id;
    }
    
    public function getPath(): string
    {
        return $this->path;
    }
    
    public function getMethod(): string
    {
        return $this->method;
    }
    
    public function getName(): ?string
    {
        return $this->name;
    }
    
    public function getAvgResponseTimeMs(): ?float
    {
        return $this->avgResponseTimeMs;
    }
    
    public function getP95ResponseTimeMs(): ?float
    {
        return $this->p95ResponseTimeMs;
    }
    
    public function getP99ResponseTimeMs(): ?float
    {
        return $this->p99ResponseTimeMs;
    }
    
    public function getRequestCount(): ?int
    {
        return $this->requestCount;
    }
    
    public function getErrorCount(): ?int
    {
        return $this->errorCount;
    }
    
    public function getCacheHitRate(): ?float
    {
        return $this->cacheHitRate;
    }
    
    public function getRelatedCacheKeys(): ?array
    {
        return $this->relatedCacheKeys;
    }
    
    public function getMetadata(): ?array
    {
        return $this->metadata;
    }
    
    public function getErrorRate(): ?float
    {
        if ($this->requestCount === null || $this->requestCount === 0) {
            return null;
        }
        
        return ($this->errorCount ?? 0) / $this->requestCount;
    }
    
    public function isSlowRoute(float $thresholdMs = 1000): bool
    {
        return ($this->p95ResponseTimeMs ?? 0) > $thresholdMs || 
               ($this->avgResponseTimeMs ?? 0) > $thresholdMs;
    }
    
    public function matchesPath(string $requestPath): bool
    {
        $pattern = preg_replace('#\{[^}]+\}#', '[^/]+', $this->path);
        $pattern = '#^' . $pattern . '$#';
        
        return (bool) preg_match($pattern, $requestPath);
    }
}
