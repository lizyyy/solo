<?php

namespace CacheAnalyzer\Storage;

use CacheAnalyzer\Model\CacheEvent;
use CacheAnalyzer\Model\CacheConfig;
use CacheAnalyzer\Model\Route;
use CacheAnalyzer\Model\SlowQuery;
use Exception;
use PDO;
use PDOException;

class Database
{
    private PDO $pdo;
    private string $dbPath;
    
    public function __construct(string $dbPath)
    {
        $this->dbPath = $dbPath;
        $this->initialize();
    }
    
    private function initialize(): void
    {
        $dir = dirname($this->dbPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        
        $this->pdo = new PDO('sqlite:' . $this->dbPath);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        $this->createTables();
    }
    
    private function createTables(): void
    {
        $schema = [
            'CREATE TABLE IF NOT EXISTS cache_events (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                type TEXT NOT NULL,
                backend TEXT NOT NULL,
                timestamp REAL NOT NULL,
                latency_ms REAL,
                ttl INTEGER,
                size_bytes INTEGER,
                route TEXT,
                tags TEXT,
                error TEXT,
                created_at REAL DEFAULT (strftime(\'%s\', \'now\'))
            )',
            
            'CREATE INDEX IF NOT EXISTS idx_cache_events_key ON cache_events(key)',
            'CREATE INDEX IF NOT EXISTS idx_cache_events_backend ON cache_events(backend)',
            'CREATE INDEX IF NOT EXISTS idx_cache_events_route ON cache_events(route)',
            'CREATE INDEX IF NOT EXISTS idx_cache_events_timestamp ON cache_events(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_cache_events_type ON cache_events(type)',
            
            'CREATE TABLE IF NOT EXISTS cache_configs (
                id TEXT PRIMARY KEY,
                backend TEXT NOT NULL,
                name TEXT,
                max_memory_mb INTEGER,
                max_connections INTEGER,
                eviction_policy TEXT,
                persistence_enabled INTEGER,
                default_ttl TEXT,
                key_prefixes TEXT,
                opcache_config TEXT,
                redis_config TEXT,
                file_config TEXT,
                metadata TEXT,
                created_at REAL DEFAULT (strftime(\'%s\', \'now\'))
            )',
            
            'CREATE INDEX IF NOT EXISTS idx_cache_configs_backend ON cache_configs(backend)',
            
            'CREATE TABLE IF NOT EXISTS routes (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                method TEXT NOT NULL,
                name TEXT,
                avg_response_time_ms REAL,
                p95_response_time_ms REAL,
                p99_response_time_ms REAL,
                request_count INTEGER,
                error_count INTEGER,
                cache_hit_rate REAL,
                related_cache_keys TEXT,
                metadata TEXT,
                created_at REAL DEFAULT (strftime(\'%s\', \'now\'))
            )',
            
            'CREATE INDEX IF NOT EXISTS idx_routes_path ON routes(path)',
            'CREATE INDEX IF NOT EXISTS idx_routes_method ON routes(method)',
            
            'CREATE TABLE IF NOT EXISTS slow_queries (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                query_type TEXT NOT NULL,
                execution_time_ms REAL NOT NULL,
                lock_time_ms REAL,
                rows_examined INTEGER,
                rows_sent INTEGER,
                database TEXT,
                table_name TEXT,
                timestamp REAL,
                explain_plan TEXT,
                is_cacheable INTEGER,
                recommendation TEXT,
                metadata TEXT,
                created_at REAL DEFAULT (strftime(\'%s\', \'now\'))
            )',
            
            'CREATE INDEX IF NOT EXISTS idx_slow_queries_execution_time ON slow_queries(execution_time_ms)',
            'CREATE INDEX IF NOT EXISTS idx_slow_queries_query_type ON slow_queries(query_type)',
            'CREATE INDEX IF NOT EXISTS idx_slow_queries_timestamp ON slow_queries(timestamp)',
            
            'CREATE TABLE IF NOT EXISTS analysis_results (
                id TEXT PRIMARY KEY,
                analysis_type TEXT NOT NULL,
                result TEXT NOT NULL,
                options TEXT,
                created_at REAL DEFAULT (strftime(\'%s\', \'now\'))
            )',
            
            'CREATE TABLE IF NOT EXISTS simulation_results (
                id TEXT PRIMARY KEY,
                strategy TEXT NOT NULL,
                parameters TEXT NOT NULL,
                baseline TEXT,
                simulation_result TEXT NOT NULL,
                comparison TEXT,
                created_at REAL DEFAULT (strftime(\'%s\', \'now\'))
            )',
            
            'CREATE TABLE IF NOT EXISTS import_metadata (
                id TEXT PRIMARY KEY,
                import_type TEXT NOT NULL,
                filename TEXT,
                record_count INTEGER,
                error_count INTEGER DEFAULT 0,
                errors TEXT,
                created_at REAL DEFAULT (strftime(\'%s\', \'now\'))
            )',
        ];
        
        foreach ($schema as $sql) {
            $this->pdo->exec($sql);
        }
    }
    
    public function getPdo(): PDO
    {
        return $this->pdo;
    }
    
    public function beginTransaction(): bool
    {
        return $this->pdo->beginTransaction();
    }
    
    public function commit(): bool
    {
        return $this->pdo->commit();
    }
    
    public function rollBack(): bool
    {
        return $this->pdo->rollBack();
    }
    
    public function insertCacheEvent(CacheEvent $event): void
    {
        $sql = 'INSERT INTO cache_events (
            id, key, type, backend, timestamp, latency_ms, ttl, size_bytes, route, tags, error
        ) VALUES (
            :id, :key, :type, :backend, :timestamp, :latency_ms, :ttl, :size_bytes, :route, :tags, :error
        )';
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'id' => $event->getId(),
            'key' => $event->getKey(),
            'type' => $event->getType(),
            'backend' => $event->getBackend(),
            'timestamp' => $event->getTimestamp(),
            'latency_ms' => $event->getLatencyMs(),
            'ttl' => $event->getTtl(),
            'size_bytes' => $event->getSizeBytes(),
            'route' => $event->getRoute(),
            'tags' => $event->getTags() !== null ? json_encode($event->getTags()) : null,
            'error' => $event->getError(),
        ]);
    }
    
    public function insertCacheEvents(array $events): void
    {
        $this->beginTransaction();
        try {
            foreach ($events as $event) {
                if ($event instanceof CacheEvent) {
                    $this->insertCacheEvent($event);
                }
            }
            $this->commit();
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }
    
    public function getCacheEvents(array $filters = [], ?int $limit = null, ?int $offset = null): array
    {
        $where = [];
        $params = [];
        
        if (isset($filters['backend'])) {
            $where[] = 'backend = :backend';
            $params['backend'] = $filters['backend'];
        }
        
        if (isset($filters['route'])) {
            $where[] = 'route = :route';
            $params['route'] = $filters['route'];
        }
        
        if (isset($filters['type'])) {
            $where[] = 'type = :type';
            $params['type'] = $filters['type'];
        }
        
        if (isset($filters['key'])) {
            $where[] = 'key LIKE :key';
            $params['key'] = '%' . $filters['key'] . '%';
        }
        
        if (isset($filters['start_time'])) {
            $where[] = 'timestamp >= :start_time';
            $params['start_time'] = $filters['start_time'];
        }
        
        if (isset($filters['end_time'])) {
            $where[] = 'timestamp <= :end_time';
            $params['end_time'] = $filters['end_time'];
        }
        
        $sql = 'SELECT * FROM cache_events';
        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY timestamp ASC';
        
        if ($limit !== null) {
            $sql .= ' LIMIT ' . (int) $limit;
            if ($offset !== null) {
                $sql .= ' OFFSET ' . (int) $offset;
            }
        }
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        
        $rows = $stmt->fetchAll();
        $events = [];
        
        foreach ($rows as $row) {
            $events[] = CacheEvent::fromArray([
                'id' => $row['id'],
                'key' => $row['key'],
                'type' => $row['type'],
                'backend' => $row['backend'],
                'timestamp' => $row['timestamp'],
                'latency_ms' => $row['latency_ms'],
                'ttl' => $row['ttl'],
                'size_bytes' => $row['size_bytes'],
                'route' => $row['route'],
                'tags' => $row['tags'] !== null ? json_decode($row['tags'], true) : null,
                'error' => $row['error'],
            ]);
        }
        
        return $events;
    }
    
    public function getCacheEventCount(array $filters = []): int
    {
        $where = [];
        $params = [];
        
        if (isset($filters['backend'])) {
            $where[] = 'backend = :backend';
            $params['backend'] = $filters['backend'];
        }
        
        if (isset($filters['route'])) {
            $where[] = 'route = :route';
            $params['route'] = $filters['route'];
        }
        
        if (isset($filters['type'])) {
            $where[] = 'type = :type';
            $params['type'] = $filters['type'];
        }
        
        $sql = 'SELECT COUNT(*) as count FROM cache_events';
        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        
        return (int) ($row['count'] ?? 0);
    }
    
    public function clearCacheEvents(): void
    {
        $this->pdo->exec('DELETE FROM cache_events');
    }
    
    public function insertCacheConfig(CacheConfig $config): void
    {
        $sql = 'INSERT INTO cache_configs (
            id, backend, name, max_memory_mb, max_connections, eviction_policy,
            persistence_enabled, default_ttl, key_prefixes, opcache_config,
            redis_config, file_config, metadata
        ) VALUES (
            :id, :backend, :name, :max_memory_mb, :max_connections, :eviction_policy,
            :persistence_enabled, :default_ttl, :key_prefixes, :opcache_config,
            :redis_config, :file_config, :metadata
        )';
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'id' => $config->getId(),
            'backend' => $config->getBackend(),
            'name' => $config->getName(),
            'max_memory_mb' => $config->getMaxMemoryMb(),
            'max_connections' => $config->getMaxConnections(),
            'eviction_policy' => $config->getEvictionPolicy(),
            'persistence_enabled' => $config->isPersistenceEnabled(),
            'default_ttl' => $config->getDefaultTtl() !== null ? json_encode($config->getDefaultTtl()) : null,
            'key_prefixes' => $config->getKeyPrefixes() !== null ? json_encode($config->getKeyPrefixes()) : null,
            'opcache_config' => $config->getOpcacheConfig() !== null ? json_encode($config->getOpcacheConfig()) : null,
            'redis_config' => $config->getRedisConfig() !== null ? json_encode($config->getRedisConfig()) : null,
            'file_config' => $config->getFileConfig() !== null ? json_encode($config->getFileConfig()) : null,
            'metadata' => $config->getMetadata() !== null ? json_encode($config->getMetadata()) : null,
        ]);
    }
    
    public function getCacheConfigs(): array
    {
        $stmt = $this->pdo->query('SELECT * FROM cache_configs ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();
        $configs = [];
        
        foreach ($rows as $row) {
            $configs[] = CacheConfig::fromArray([
                'id' => $row['id'],
                'backend' => $row['backend'],
                'name' => $row['name'],
                'max_memory_mb' => $row['max_memory_mb'],
                'max_connections' => $row['max_connections'],
                'eviction_policy' => $row['eviction_policy'],
                'persistence_enabled' => $row['persistence_enabled'],
                'default_ttl' => $row['default_ttl'] !== null ? json_decode($row['default_ttl'], true) : null,
                'key_prefixes' => $row['key_prefixes'] !== null ? json_decode($row['key_prefixes'], true) : null,
                'opcache_config' => $row['opcache_config'] !== null ? json_decode($row['opcache_config'], true) : null,
                'redis_config' => $row['redis_config'] !== null ? json_decode($row['redis_config'], true) : null,
                'file_config' => $row['file_config'] !== null ? json_decode($row['file_config'], true) : null,
                'metadata' => $row['metadata'] !== null ? json_decode($row['metadata'], true) : null,
            ]);
        }
        
        return $configs;
    }
    
    public function insertRoute(Route $route): void
    {
        $sql = 'INSERT INTO routes (
            id, path, method, name, avg_response_time_ms, p95_response_time_ms,
            p99_response_time_ms, request_count, error_count, cache_hit_rate,
            related_cache_keys, metadata
        ) VALUES (
            :id, :path, :method, :name, :avg_response_time_ms, :p95_response_time_ms,
            :p99_response_time_ms, :request_count, :error_count, :cache_hit_rate,
            :related_cache_keys, :metadata
        )';
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'id' => $route->getId(),
            'path' => $route->getPath(),
            'method' => $route->getMethod(),
            'name' => $route->getName(),
            'avg_response_time_ms' => $route->getAvgResponseTimeMs(),
            'p95_response_time_ms' => $route->getP95ResponseTimeMs(),
            'p99_response_time_ms' => $route->getP99ResponseTimeMs(),
            'request_count' => $route->getRequestCount(),
            'error_count' => $route->getErrorCount(),
            'cache_hit_rate' => $route->getCacheHitRate(),
            'related_cache_keys' => $route->getRelatedCacheKeys() !== null ? json_encode($route->getRelatedCacheKeys()) : null,
            'metadata' => $route->getMetadata() !== null ? json_encode($route->getMetadata()) : null,
        ]);
    }
    
    public function insertRoutes(array $routes): void
    {
        $this->beginTransaction();
        try {
            foreach ($routes as $route) {
                if ($route instanceof Route) {
                    $this->insertRoute($route);
                }
            }
            $this->commit();
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }
    
    public function getRoutes(): array
    {
        $stmt = $this->pdo->query('SELECT * FROM routes ORDER BY request_count DESC');
        $rows = $stmt->fetchAll();
        $routes = [];
        
        foreach ($rows as $row) {
            $routes[] = Route::fromArray([
                'id' => $row['id'],
                'path' => $row['path'],
                'method' => $row['method'],
                'name' => $row['name'],
                'avg_response_time_ms' => $row['avg_response_time_ms'],
                'p95_response_time_ms' => $row['p95_response_time_ms'],
                'p99_response_time_ms' => $row['p99_response_time_ms'],
                'request_count' => $row['request_count'],
                'error_count' => $row['error_count'],
                'cache_hit_rate' => $row['cache_hit_rate'],
                'related_cache_keys' => $row['related_cache_keys'] !== null ? json_decode($row['related_cache_keys'], true) : null,
                'metadata' => $row['metadata'] !== null ? json_decode($row['metadata'], true) : null,
            ]);
        }
        
        return $routes;
    }
    
    public function insertSlowQuery(SlowQuery $query): void
    {
        $sql = 'INSERT INTO slow_queries (
            id, query, query_type, execution_time_ms, lock_time_ms, rows_examined,
            rows_sent, database, table_name, timestamp, explain_plan, is_cacheable,
            recommendation, metadata
        ) VALUES (
            :id, :query, :query_type, :execution_time_ms, :lock_time_ms, :rows_examined,
            :rows_sent, :database, :table_name, :timestamp, :explain_plan, :is_cacheable,
            :recommendation, :metadata
        )';
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'id' => $query->getId(),
            'query' => $query->getQuery(),
            'query_type' => $query->getQueryType(),
            'execution_time_ms' => $query->getExecutionTimeMs(),
            'lock_time_ms' => $query->getLockTimeMs(),
            'rows_examined' => $query->getRowsExamined(),
            'rows_sent' => $query->getRowsSent(),
            'database' => $query->getDatabase(),
            'table_name' => $query->getTable(),
            'timestamp' => $query->getTimestamp(),
            'explain_plan' => $query->getExplainPlan() !== null ? json_encode($query->getExplainPlan()) : null,
            'is_cacheable' => $query->isCacheable(),
            'recommendation' => $query->getRecommendation(),
            'metadata' => $query->getMetadata() !== null ? json_encode($query->getMetadata()) : null,
        ]);
    }
    
    public function insertSlowQueries(array $queries): void
    {
        $this->beginTransaction();
        try {
            foreach ($queries as $query) {
                if ($query instanceof SlowQuery) {
                    $this->insertSlowQuery($query);
                }
            }
            $this->commit();
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }
    
    public function getSlowQueries(array $filters = [], ?int $limit = null): array
    {
        $where = [];
        $params = [];
        
        if (isset($filters['min_execution_time_ms'])) {
            $where[] = 'execution_time_ms >= :min_time';
            $params['min_time'] = $filters['min_execution_time_ms'];
        }
        
        if (isset($filters['is_read'])) {
            if ($filters['is_read']) {
                $where[] = "query_type IN ('SELECT', 'JOIN', 'SUBQUERY')";
            } else {
                $where[] = "query_type IN ('INSERT', 'UPDATE', 'DELETE')";
            }
        }
        
        $sql = 'SELECT * FROM slow_queries';
        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY execution_time_ms DESC';
        
        if ($limit !== null) {
            $sql .= ' LIMIT ' . (int) $limit;
        }
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        
        $rows = $stmt->fetchAll();
        $queries = [];
        
        foreach ($rows as $row) {
            $queries[] = SlowQuery::fromArray([
                'id' => $row['id'],
                'query' => $row['query'],
                'query_type' => $row['query_type'],
                'execution_time_ms' => $row['execution_time_ms'],
                'lock_time_ms' => $row['lock_time_ms'],
                'rows_examined' => $row['rows_examined'],
                'rows_sent' => $row['rows_sent'],
                'database' => $row['database'],
                'table' => $row['table_name'],
                'timestamp' => $row['timestamp'],
                'explain_plan' => $row['explain_plan'] !== null ? json_decode($row['explain_plan'], true) : null,
                'is_cacheable' => $row['is_cacheable'],
                'recommendation' => $row['recommendation'],
                'metadata' => $row['metadata'] !== null ? json_decode($row['metadata'], true) : null,
            ]);
        }
        
        return $queries;
    }
    
    public function saveAnalysisResult(string $analysisType, array $result, array $options = []): void
    {
        $sql = 'INSERT INTO analysis_results (id, analysis_type, result, options) VALUES (:id, :analysis_type, :result, :options)';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'id' => uniqid('analysis_', true),
            'analysis_type' => $analysisType,
            'result' => json_encode($result),
            'options' => json_encode($options),
        ]);
    }
    
    public function getLatestAnalysisResult(string $analysisType): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM analysis_results WHERE analysis_type = :type ORDER BY created_at DESC LIMIT 1'
        );
        $stmt->execute(['type' => $analysisType]);
        $row = $stmt->fetch();
        
        if (!$row) {
            return null;
        }
        
        return [
            'id' => $row['id'],
            'analysis_type' => $row['analysis_type'],
            'result' => json_decode($row['result'], true),
            'options' => $row['options'] !== null ? json_decode($row['options'], true) : null,
            'created_at' => $row['created_at'],
        ];
    }
    
    public function saveSimulationResult(string $strategy, array $parameters, array $simulationResult, ?array $baseline = null, ?array $comparison = null): void
    {
        $sql = 'INSERT INTO simulation_results (
            id, strategy, parameters, baseline, simulation_result, comparison
        ) VALUES (
            :id, :strategy, :parameters, :baseline, :simulation_result, :comparison
        )';
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'id' => uniqid('sim_', true),
            'strategy' => $strategy,
            'parameters' => json_encode($parameters),
            'baseline' => $baseline !== null ? json_encode($baseline) : null,
            'simulation_result' => json_encode($simulationResult),
            'comparison' => $comparison !== null ? json_encode($comparison) : null,
        ]);
    }
    
    public function logImport(string $importType, ?string $filename, int $recordCount, int $errorCount = 0, array $errors = []): void
    {
        $sql = 'INSERT INTO import_metadata (id, import_type, filename, record_count, error_count, errors) VALUES (:id, :import_type, :filename, :record_count, :error_count, :errors)';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'id' => uniqid('import_', true),
            'import_type' => $importType,
            'filename' => $filename,
            'record_count' => $recordCount,
            'error_count' => $errorCount,
            'errors' => !empty($errors) ? json_encode($errors) : null,
        ]);
    }
    
    public function clearAllData(): void
    {
        $this->pdo->exec('DELETE FROM cache_events');
        $this->pdo->exec('DELETE FROM cache_configs');
        $this->pdo->exec('DELETE FROM routes');
        $this->pdo->exec('DELETE FROM slow_queries');
        $this->pdo->exec('DELETE FROM analysis_results');
        $this->pdo->exec('DELETE FROM simulation_results');
    }
    
    public function getStats(): array
    {
        $stats = [];
        
        $tables = ['cache_events', 'cache_configs', 'routes', 'slow_queries', 'analysis_results', 'simulation_results'];
        
        foreach ($tables as $table) {
            $stmt = $this->pdo->query("SELECT COUNT(*) as count FROM $table");
            $row = $stmt->fetch();
            $stats[$table] = (int) ($row['count'] ?? 0);
        }
        
        return $stats;
    }
}
