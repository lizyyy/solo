<?php

namespace CacheAnalyzer\Model;

use Exception;

class SlowQuery
{
    public const TYPE_SELECT = 'SELECT';
    public const TYPE_INSERT = 'INSERT';
    public const TYPE_UPDATE = 'UPDATE';
    public const TYPE_DELETE = 'DELETE';
    public const TYPE_JOIN = 'JOIN';
    public const TYPE_SUBQUERY = 'SUBQUERY';
    
    private string $id;
    private string $query;
    private string $queryType;
    private float $executionTimeMs;
    private ?float $lockTimeMs;
    private ?int $rowsExamined;
    private ?int $rowsSent;
    private ?string $database;
    private ?string $table;
    private ?float $timestamp;
    private ?array $explainPlan;
    private ?bool $isCacheable;
    private ?string $recommendation;
    private ?array $metadata;
    
    public function __construct(
        string $query,
        string $queryType,
        float $executionTimeMs,
        ?float $lockTimeMs = null,
        ?int $rowsExamined = null,
        ?int $rowsSent = null,
        ?string $database = null,
        ?string $table = null,
        ?float $timestamp = null,
        ?array $explainPlan = null,
        ?bool $isCacheable = null,
        ?string $recommendation = null,
        ?array $metadata = null,
        ?string $id = null
    ) {
        $this->id = $id ?? uniqid('query_', true);
        $this->query = $query;
        $this->queryType = strtoupper($queryType);
        $this->executionTimeMs = $executionTimeMs;
        $this->lockTimeMs = $lockTimeMs;
        $this->rowsExamined = $rowsExamined;
        $this->rowsSent = $rowsSent;
        $this->database = $database;
        $this->table = $table;
        $this->timestamp = $timestamp;
        $this->explainPlan = $explainPlan;
        $this->isCacheable = $isCacheable;
        $this->recommendation = $recommendation;
        $this->metadata = $metadata;
        
        $this->validate();
    }
    
    public static function fromArray(array $data): self
    {
        return new self(
            $data['query'] ?? '',
            $data['query_type'] ?? $data['queryType'] ?? self::TYPE_SELECT,
            $data['execution_time_ms'] ?? $data['executionTimeMs'] ?? 0,
            $data['lock_time_ms'] ?? $data['lockTimeMs'] ?? null,
            $data['rows_examined'] ?? $data['rowsExamined'] ?? null,
            $data['rows_sent'] ?? $data['rowsSent'] ?? null,
            $data['database'] ?? null,
            $data['table'] ?? null,
            $data['timestamp'] ?? null,
            $data['explain_plan'] ?? $data['explainPlan'] ?? null,
            $data['is_cacheable'] ?? $data['isCacheable'] ?? null,
            $data['recommendation'] ?? null,
            $data['metadata'] ?? null,
            $data['id'] ?? null
        );
    }
    
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'query' => $this->query,
            'query_type' => $this->queryType,
            'execution_time_ms' => $this->executionTimeMs,
            'lock_time_ms' => $this->lockTimeMs,
            'rows_examined' => $this->rowsExamined,
            'rows_sent' => $this->rowsSent,
            'database' => $this->database,
            'table' => $this->table,
            'timestamp' => $this->timestamp,
            'explain_plan' => $this->explainPlan,
            'is_cacheable' => $this->isCacheable,
            'recommendation' => $this->recommendation,
            'metadata' => $this->metadata,
        ];
    }
    
    private function validate(): void
    {
        $errors = [];
        
        if (empty($this->query)) {
            $errors[] = 'SQL query is required';
        }
        
        $validTypes = [
            self::TYPE_SELECT,
            self::TYPE_INSERT,
            self::TYPE_UPDATE,
            self::TYPE_DELETE,
            self::TYPE_JOIN,
            self::TYPE_SUBQUERY,
        ];
        
        if (!in_array($this->queryType, $validTypes, true)) {
            $errors[] = sprintf('Invalid query type: %s. Must be one of: %s', $this->queryType, implode(', ', $validTypes));
        }
        
        if ($this->executionTimeMs < 0) {
            $errors[] = 'Execution time cannot be negative';
        }
        
        if ($this->lockTimeMs !== null && $this->lockTimeMs < 0) {
            $errors[] = 'Lock time cannot be negative';
        }
        
        if ($this->rowsExamined !== null && $this->rowsExamined < 0) {
            $errors[] = 'Rows examined cannot be negative';
        }
        
        if ($this->rowsSent !== null && $this->rowsSent < 0) {
            $errors[] = 'Rows sent cannot be negative';
        }
        
        if (!empty($errors)) {
            throw new Exception(implode('; ', $errors));
        }
    }
    
    public function getId(): string
    {
        return $this->id;
    }
    
    public function getQuery(): string
    {
        return $this->query;
    }
    
    public function getQueryType(): string
    {
        return $this->queryType;
    }
    
    public function getExecutionTimeMs(): float
    {
        return $this->executionTimeMs;
    }
    
    public function getLockTimeMs(): ?float
    {
        return $this->lockTimeMs;
    }
    
    public function getRowsExamined(): ?int
    {
        return $this->rowsExamined;
    }
    
    public function getRowsSent(): ?int
    {
        return $this->rowsSent;
    }
    
    public function getDatabase(): ?string
    {
        return $this->database;
    }
    
    public function getTable(): ?string
    {
        return $this->table;
    }
    
    public function getTimestamp(): ?float
    {
        return $this->timestamp;
    }
    
    public function getExplainPlan(): ?array
    {
        return $this->explainPlan;
    }
    
    public function isCacheable(): ?bool
    {
        return $this->isCacheable;
    }
    
    public function getRecommendation(): ?string
    {
        return $this->recommendation;
    }
    
    public function getMetadata(): ?array
    {
        return $this->metadata;
    }
    
    public function isReadQuery(): bool
    {
        return in_array($this->queryType, [self::TYPE_SELECT, self::TYPE_JOIN, self::TYPE_SUBQUERY], true);
    }
    
    public function isWriteQuery(): bool
    {
        return in_array($this->queryType, [self::TYPE_INSERT, self::TYPE_UPDATE, self::TYPE_DELETE], true);
    }
    
    public function getEfficiencyRatio(): ?float
    {
        if ($this->rowsExamined === null || $this->rowsExamined === 0) {
            return null;
        }
        
        if ($this->rowsSent === null) {
            return null;
        }
        
        return $this->rowsSent / $this->rowsExamined;
    }
    
    public function shouldCache(float $timeThresholdMs = 100): bool
    {
        if ($this->isCacheable === true) {
            return true;
        }
        
        if ($this->isCacheable === false) {
            return false;
        }
        
        if (!$this->isReadQuery()) {
            return false;
        }
        
        if ($this->executionTimeMs < $timeThresholdMs) {
            return false;
        }
        
        return true;
    }
    
    public function generateCacheKey(): string
    {
        $normalizedQuery = trim(preg_replace('/\s+/', ' ', $this->query));
        $hash = md5($normalizedQuery);
        
        $parts = ['sql'];
        
        if ($this->database) {
            $parts[] = $this->database;
        }
        
        if ($this->table) {
            $parts[] = $this->table;
        }
        
        $parts[] = $hash;
        
        return implode(':', $parts);
    }
    
    public function getOptimizationSuggestions(): array
    {
        $suggestions = [];
        
        if ($this->isReadQuery()) {
            $efficiency = $this->getEfficiencyRatio();
            
            if ($efficiency !== null && $efficiency < 0.1) {
                $suggestions[] = [
                    'type' => 'index',
                    'severity' => 'high',
                    'message' => sprintf('Low query efficiency: %.2f%%', $efficiency * 100),
                    'recommendation' => 'Consider adding appropriate indexes to reduce rows examined'
                ];
            }
            
            if ($this->executionTimeMs > 500) {
                $suggestions[] = [
                    'type' => 'caching',
                    'severity' => 'high',
                    'message' => sprintf('Slow query: %.2f ms', $this->executionTimeMs),
                    'recommendation' => 'Consider caching this query result with appropriate TTL'
                ];
            }
            
            if (stripos($this->query, 'SELECT *') !== false) {
                $suggestions[] = [
                    'type' => 'optimization',
                    'severity' => 'low',
                    'message' => 'Using SELECT *',
                    'recommendation' => 'Consider explicitly listing only needed columns'
                ];
            }
        }
        
        if ($this->isWriteQuery()) {
            if ($this->executionTimeMs > 1000) {
                $suggestions[] = [
                    'type' => 'write_performance',
                    'severity' => 'medium',
                    'message' => sprintf('Slow write query: %.2f ms', $this->executionTimeMs),
                    'recommendation' => 'Consider batch operations or optimizing write patterns'
                ];
            }
        }
        
        return $suggestions;
    }
}
