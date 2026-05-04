<?php

namespace CacheAnalyzer\Controller;

use CacheAnalyzer\Importer\CacheEventsImporter;
use CacheAnalyzer\Importer\CacheConfigImporter;
use CacheAnalyzer\Importer\RoutesImporter;
use CacheAnalyzer\Importer\SlowQueriesImporter;
use CacheAnalyzer\Storage\Database;
use Exception;

class ImportController
{
    private Database $database;
    
    public function __construct(Database $database)
    {
        $this->database = $database;
    }
    
    private function getInputContent(): string
    {
        $content = file_get_contents('php://input');
        if ($content === false) {
            throw new Exception('Failed to read request body');
        }
        return $content;
    }
    
    private function getJsonInput(): array
    {
        $content = $this->getInputContent();
        if (empty($content)) {
            return [];
        }
        
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON: ' . json_last_error_msg());
        }
        
        return $data ?? [];
    }
    
    private function jsonResponse(array $data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    private function errorResponse(string $message, int $statusCode = 400, ?array $details = null): void
    {
        $response = [
            'error' => $message,
            'success' => false,
        ];
        
        if ($details !== null) {
            $response['details'] = $details;
        }
        
        $this->jsonResponse($response, $statusCode);
    }
    
    public function importCacheEvents(): void
    {
        try {
            $data = $this->getJsonInput();
            
            $content = $data['content'] ?? $data['raw'] ?? null;
            if ($content === null) {
                $this->errorResponse('Missing required field: content or raw');
                return;
            }
            
            $importer = new CacheEventsImporter();
            
            try {
                $events = $importer->import($content);
            } catch (Exception $e) {
                $this->database->logImport(
                    'cache_events',
                    $data['filename'] ?? null,
                    0,
                    count($importer->getErrors()),
                    $importer->getErrors()
                );
                
                $this->errorResponse($e->getMessage(), 400, [
                    'errors' => $importer->getErrors(),
                    'stats' => $importer->getStatistics(),
                ]);
                return;
            }
            
            $count = count($events);
            
            if ($count > 0) {
                $this->database->insertCacheEvents($events);
            }
            
            $this->database->logImport(
                'cache_events',
                $data['filename'] ?? null,
                $count,
                0,
                $importer->getErrors()
            );
            
            $this->jsonResponse([
                'success' => true,
                'message' => sprintf('Successfully imported %d cache events', $count),
                'imported_count' => $count,
                'stats' => $importer->getStatistics(),
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function importRoutes(): void
    {
        try {
            $data = $this->getJsonInput();
            
            $content = $data['content'] ?? $data['raw'] ?? null;
            if ($content === null) {
                $this->errorResponse('Missing required field: content or raw');
                return;
            }
            
            $importer = new RoutesImporter();
            
            try {
                $routes = $importer->import($content);
            } catch (Exception $e) {
                $this->database->logImport(
                    'routes',
                    $data['filename'] ?? null,
                    0,
                    count($importer->getErrors()),
                    $importer->getErrors()
                );
                
                $this->errorResponse($e->getMessage(), 400, [
                    'errors' => $importer->getErrors(),
                ]);
                return;
            }
            
            $count = count($routes);
            
            if ($count > 0) {
                $this->database->insertRoutes($routes);
            }
            
            $this->database->logImport(
                'routes',
                $data['filename'] ?? null,
                $count,
                0,
                $importer->getErrors()
            );
            
            $this->jsonResponse([
                'success' => true,
                'message' => sprintf('Successfully imported %d routes', $count),
                'imported_count' => $count,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function importCacheConfig(): void
    {
        try {
            $data = $this->getJsonInput();
            
            $content = $data['content'] ?? $data['raw'] ?? null;
            if ($content === null) {
                $this->errorResponse('Missing required field: content or raw');
                return;
            }
            
            $importer = new CacheConfigImporter();
            
            try {
                $configs = $importer->import($content);
            } catch (Exception $e) {
                $this->database->logImport(
                    'cache_config',
                    $data['filename'] ?? null,
                    0,
                    count($importer->getErrors()),
                    $importer->getErrors()
                );
                
                $this->errorResponse($e->getMessage(), 400, [
                    'errors' => $importer->getErrors(),
                ]);
                return;
            }
            
            $count = count($configs);
            
            foreach ($configs as $config) {
                $this->database->insertCacheConfig($config);
            }
            
            $this->database->logImport(
                'cache_config',
                $data['filename'] ?? null,
                $count,
                0,
                $importer->getErrors()
            );
            
            $this->jsonResponse([
                'success' => true,
                'message' => sprintf('Successfully imported %d cache configurations', $count),
                'imported_count' => $count,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function importSlowQueries(): void
    {
        try {
            $data = $this->getJsonInput();
            
            $content = $data['content'] ?? $data['raw'] ?? null;
            if ($content === null) {
                $this->errorResponse('Missing required field: content or raw');
                return;
            }
            
            $importer = new SlowQueriesImporter();
            
            try {
                $queries = $importer->import($content);
            } catch (Exception $e) {
                $this->database->logImport(
                    'slow_queries',
                    $data['filename'] ?? null,
                    0,
                    count($importer->getErrors()),
                    $importer->getErrors()
                );
                
                $this->errorResponse($e->getMessage(), 400, [
                    'errors' => $importer->getErrors(),
                ]);
                return;
            }
            
            $count = count($queries);
            
            if ($count > 0) {
                $this->database->insertSlowQueries($queries);
            }
            
            $this->database->logImport(
                'slow_queries',
                $data['filename'] ?? null,
                $count,
                0,
                $importer->getErrors()
            );
            
            $this->jsonResponse([
                'success' => true,
                'message' => sprintf('Successfully imported %d slow queries', $count),
                'imported_count' => $count,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function importAllFromFiles(): void
    {
        try {
            $data = $this->getJsonInput();
            
            $baseDir = $data['base_dir'] ?? __DIR__ . '/../../../data';
            $results = [];
            $errors = [];
            
            $files = [
                'cache_events' => $baseDir . '/cache-events.jsonl',
                'routes' => $baseDir . '/routes.csv',
                'cache_config' => $baseDir . '/cache-config.yaml',
                'slow_queries' => $baseDir . '/slow-queries.csv',
            ];
            
            foreach ($files as $type => $filePath) {
                if (!file_exists($filePath)) {
                    $results[$type] = [
                        'success' => false,
                        'error' => 'File not found: ' . $filePath,
                    ];
                    continue;
                }
                
                $content = file_get_contents($filePath);
                if ($content === false) {
                    $results[$type] = [
                        'success' => false,
                        'error' => 'Failed to read file: ' . $filePath,
                    ];
                    continue;
                }
                
                try {
                    switch ($type) {
                        case 'cache_events':
                            $importer = new CacheEventsImporter();
                            $items = $importer->import($content);
                            $count = count($items);
                            if ($count > 0) {
                                $this->database->insertCacheEvents($items);
                            }
                            break;
                            
                        case 'routes':
                            $importer = new RoutesImporter();
                            $items = $importer->import($content);
                            $count = count($items);
                            if ($count > 0) {
                                $this->database->insertRoutes($items);
                            }
                            break;
                            
                        case 'cache_config':
                            $importer = new CacheConfigImporter();
                            $items = $importer->import($content);
                            $count = count($items);
                            foreach ($items as $item) {
                                $this->database->insertCacheConfig($item);
                            }
                            break;
                            
                        case 'slow_queries':
                            $importer = new SlowQueriesImporter();
                            $items = $importer->import($content);
                            $count = count($items);
                            if ($count > 0) {
                                $this->database->insertSlowQueries($items);
                            }
                            break;
                        
                        default:
                            $count = 0;
                    }
                    
                    $results[$type] = [
                        'success' => true,
                        'imported_count' => $count,
                        'file' => $filePath,
                    ];
                    
                } catch (Exception $e) {
                    $results[$type] = [
                        'success' => false,
                        'error' => $e->getMessage(),
                        'file' => $filePath,
                    ];
                    $errors[] = $type . ': ' . $e->getMessage();
                }
            }
            
            $hasErrors = count(array_filter($results, fn($r) => !$r['success'])) > 0;
            
            $this->jsonResponse([
                'success' => !$hasErrors,
                'message' => $hasErrors ? 'Import completed with errors' : 'All data imported successfully',
                'results' => $results,
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function clearAllData(): void
    {
        try {
            $this->database->clearAllData();
            
            $this->jsonResponse([
                'success' => true,
                'message' => 'All data cleared successfully',
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
    
    public function getImportStatus(): void
    {
        try {
            $stats = $this->database->getStats();
            
            $this->jsonResponse([
                'success' => true,
                'stats' => [
                    'cache_events' => $stats['cache_events'] ?? 0,
                    'routes' => $stats['routes'] ?? 0,
                    'cache_configs' => $stats['cache_configs'] ?? 0,
                    'slow_queries' => $stats['slow_queries'] ?? 0,
                    'analysis_results' => $stats['analysis_results'] ?? 0,
                    'simulation_results' => $stats['simulation_results'] ?? 0,
                ],
            ]);
            
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
}
