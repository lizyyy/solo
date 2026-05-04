<?php

namespace CacheAnalyzer\Importer;

use CacheAnalyzer\Model\SlowQuery;
use Exception;

class SlowQueriesImporter extends AbstractImporter
{
    private const REQUIRED_COLUMNS = ['query', 'query_type', 'execution_time_ms'];
    
    private array $columnMapping = [
        'query' => 'query',
        'sql' => 'query',
        'statement' => 'query',
        'query_type' => 'query_type',
        'type' => 'query_type',
        'operation' => 'query_type',
        'execution_time_ms' => 'execution_time_ms',
        'execution_time' => 'execution_time_ms',
        'time_ms' => 'execution_time_ms',
        'duration_ms' => 'execution_time_ms',
        'lock_time_ms' => 'lock_time_ms',
        'lock_time' => 'lock_time_ms',
        'rows_examined' => 'rows_examined',
        'examined' => 'rows_examined',
        'rows_sent' => 'rows_sent',
        'sent' => 'rows_sent',
        'database' => 'database',
        'db' => 'database',
        'schema' => 'database',
        'table' => 'table',
        'tables' => 'table',
        'timestamp' => 'timestamp',
        'time' => 'timestamp',
        'is_cacheable' => 'is_cacheable',
        'cacheable' => 'is_cacheable',
        'recommendation' => 'recommendation',
        'suggestion' => 'recommendation',
    ];
    
    public function import(string $content): array
    {
        $this->clearErrors();
        
        $queries = [];
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
                
                $query = $this->createSlowQueryFromData($data);
                
                $queries[] = $query;
                
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
        
        return $queries;
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
    
    private function createSlowQueryFromData(array $data): SlowQuery
    {
        $normalizedData = [];
        
        $normalizedData['query'] = $data['query'] ?? '';
        $normalizedData['query_type'] = $this->detectQueryType($data);
        
        $normalizedData['execution_time_ms'] = $this->parseFloat($data['execution_time_ms'] ?? null);
        $normalizedData['lock_time_ms'] = $this->parseFloat($data['lock_time_ms'] ?? null);
        
        $normalizedData['rows_examined'] = $this->parseInt($data['rows_examined'] ?? null);
        $normalizedData['rows_sent'] = $this->parseInt($data['rows_sent'] ?? null);
        
        $normalizedData['database'] = $data['database'] ?? null;
        $normalizedData['table'] = $data['table'] ?? null;
        
        $normalizedData['timestamp'] = $this->parseFloat($data['timestamp'] ?? null);
        
        $normalizedData['is_cacheable'] = $this->parseBoolean($data['is_cacheable'] ?? null);
        $normalizedData['recommendation'] = $data['recommendation'] ?? null;
        
        if (isset($data['explain_plan']) && !empty($data['explain_plan'])) {
            $explainData = json_decode($data['explain_plan'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $normalizedData['explain_plan'] = $explainData;
            }
        }
        
        return SlowQuery::fromArray($normalizedData);
    }
    
    private function detectQueryType(array $data): string
    {
        if (isset($data['query_type']) && !empty($data['query_type'])) {
            $type = strtoupper(trim($data['query_type']));
            $validTypes = [
                SlowQuery::TYPE_SELECT,
                SlowQuery::TYPE_INSERT,
                SlowQuery::TYPE_UPDATE,
                SlowQuery::TYPE_DELETE,
                SlowQuery::TYPE_JOIN,
                SlowQuery::TYPE_SUBQUERY,
            ];
            
            if (in_array($type, $validTypes, true)) {
                return $type;
            }
        }
        
        if (isset($data['query'])) {
            $query = trim($data['query']);
            $upper = strtoupper($query);
            
            if (strpos($upper, 'SELECT') === 0) {
                if (strpos($upper, 'JOIN') !== false) {
                    return SlowQuery::TYPE_JOIN;
                }
                if (preg_match('/\(\s*SELECT/i', $query)) {
                    return SlowQuery::TYPE_SUBQUERY;
                }
                return SlowQuery::TYPE_SELECT;
            }
            
            if (strpos($upper, 'INSERT') === 0) {
                return SlowQuery::TYPE_INSERT;
            }
            
            if (strpos($upper, 'UPDATE') === 0) {
                return SlowQuery::TYPE_UPDATE;
            }
            
            if (strpos($upper, 'DELETE') === 0) {
                return SlowQuery::TYPE_DELETE;
            }
        }
        
        return SlowQuery::TYPE_SELECT;
    }
}
