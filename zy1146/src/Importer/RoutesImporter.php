<?php

namespace CacheAnalyzer\Importer;

use CacheAnalyzer\Model\Route;
use Exception;

class RoutesImporter extends AbstractImporter
{
    private const REQUIRED_COLUMNS = ['path', 'method'];
    
    private array $columnMapping = [
        'path' => 'path',
        'route' => 'path',
        'url' => 'path',
        'uri' => 'path',
        'method' => 'method',
        'http_method' => 'method',
        'name' => 'name',
        'route_name' => 'name',
        'avg_response_time_ms' => 'avg_response_time_ms',
        'avg_response_time' => 'avg_response_time_ms',
        'avg_ms' => 'avg_response_time_ms',
        'p95_response_time_ms' => 'p95_response_time_ms',
        'p95_ms' => 'p95_response_time_ms',
        'p99_response_time_ms' => 'p99_response_time_ms',
        'p99_ms' => 'p99_response_time_ms',
        'request_count' => 'request_count',
        'requests' => 'request_count',
        'count' => 'request_count',
        'error_count' => 'error_count',
        'errors' => 'error_count',
        'cache_hit_rate' => 'cache_hit_rate',
        'hit_rate' => 'cache_hit_rate',
    ];
    
    public function import(string $content): array
    {
        $this->clearErrors();
        
        $routes = [];
        $lines = explode("\n", $content);
        
        if (empty($lines)) {
            throw new Exception('Empty CSV content');
        }
        
        $headers = $this->parseCsvLine(array_shift($lines));
        
        if (empty($headers)) {
            throw new Exception('CSV must have a header row');
        }
        
        $normalizedHeaders = $this->normalizeHeaders($headers);
        
        $this->validateHeaders($normalizedHeaders);
        
        foreach ($lines as $this->lineNumber => $line) {
            $this->lineNumber++;
            
            $line = trim($line);
            
            if (empty($line)) {
                continue;
            }
            
            if (strpos($line, '#') === 0 || strpos($line, '//') === 0) {
                continue;
            }
            
            try {
                $values = $this->parseCsvLine($line);
                
                if (count($values) !== count($headers)) {
                    throw new Exception(sprintf(
                        'Column count mismatch: expected %d, got %d',
                        count($headers),
                        count($values)
                    ));
                }
                
                $data = array_combine($normalizedHeaders, $values);
                
                $route = $this->createRouteFromData($data);
                
                $routes[] = $route;
                
            } catch (Exception $e) {
                $this->addError($e->getMessage(), $this->lineNumber);
            }
        }
        
        if (!empty($this->errors)) {
            throw new Exception(sprintf(
                'Import completed with %d errors. First error: %s',
                count($this->errors),
                $this->errors[0]['message']
            ));
        }
        
        return $routes;
    }
    
    public function validate(string $content): bool
    {
        try {
            $this->import($content);
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
    
    private function parseCsvLine(string $line): array
    {
        $result = [];
        $temp = str_getcsv($line);
        
        foreach ($temp as $value) {
            $result[] = trim($value);
        }
        
        return $result;
    }
    
    private function normalizeHeaders(array $headers): array
    {
        $normalized = [];
        
        foreach ($headers as $header) {
            $lower = strtolower(trim($header));
            
            if (isset($this->columnMapping[$lower])) {
                $normalized[] = $this->columnMapping[$lower];
            } else {
                $normalized[] = $lower;
            }
        }
        
        return $normalized;
    }
    
    private function validateHeaders(array $headers): void
    {
        $missing = [];
        
        foreach (self::REQUIRED_COLUMNS as $required) {
            if (!in_array($required, $headers, true)) {
                $missing[] = $required;
            }
        }
        
        if (!empty($missing)) {
            throw new Exception(sprintf(
                'Missing required columns: %s',
                implode(', ', $missing)
            ));
        }
    }
    
    private function createRouteFromData(array $data): Route
    {
        $normalizedData = [];
        
        $normalizedData['path'] = $data['path'] ?? '';
        $normalizedData['method'] = $data['method'] ?? Route::METHOD_GET;
        $normalizedData['name'] = $data['name'] ?? null;
        
        $normalizedData['avg_response_time_ms'] = $this->parseFloat($data['avg_response_time_ms'] ?? null);
        $normalizedData['p95_response_time_ms'] = $this->parseFloat($data['p95_response_time_ms'] ?? null);
        $normalizedData['p99_response_time_ms'] = $this->parseFloat($data['p99_response_time_ms'] ?? null);
        
        $normalizedData['request_count'] = $this->parseInt($data['request_count'] ?? null);
        $normalizedData['error_count'] = $this->parseInt($data['error_count'] ?? null);
        
        $normalizedData['cache_hit_rate'] = $this->parseFloat($data['cache_hit_rate'] ?? null);
        
        if (isset($data['related_cache_keys']) && !empty($data['related_cache_keys'])) {
            $normalizedData['related_cache_keys'] = array_map('trim', explode(',', $data['related_cache_keys']));
        }
        
        return Route::fromArray($normalizedData);
    }
}
