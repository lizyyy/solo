<?php

namespace CacheAnalyzer\Importer;

use Exception;

abstract class AbstractImporter implements ImporterInterface
{
    protected array $errors = [];
    protected int $lineNumber = 0;
    
    public function getErrors(): array
    {
        return $this->errors;
    }
    
    public function clearErrors(): void
    {
        $this->errors = [];
        $this->lineNumber = 0;
    }
    
    public function importFromFile(string $filePath): array
    {
        if (!file_exists($filePath)) {
            throw new Exception(sprintf('File not found: %s', $filePath));
        }
        
        if (!is_readable($filePath)) {
            throw new Exception(sprintf('File not readable: %s', $filePath));
        }
        
        $content = file_get_contents($filePath);
        
        if ($content === false) {
            throw new Exception(sprintf('Failed to read file: %s', $filePath));
        }
        
        return $this->import($content);
    }
    
    protected function addError(string $message, ?int $lineNumber = null): void
    {
        $this->errors[] = [
            'line_number' => $lineNumber ?? $this->lineNumber,
            'message' => $message,
        ];
    }
    
    protected function validateTimestamp(float $timestamp, ?float $previousTimestamp = null): void
    {
        if ($timestamp <= 0) {
            throw new Exception(sprintf('Invalid timestamp: %f. Must be a positive number.', $timestamp));
        }
        
        if ($previousTimestamp !== null && $timestamp < $previousTimestamp) {
            throw new Exception(sprintf(
                'Timestamp out of order: current %f is earlier than previous %f. Logs must be in chronological order.',
                $timestamp,
                $previousTimestamp
            ));
        }
    }
    
    protected function validateTtl(?int $ttl): void
    {
        if ($ttl !== null && $ttl < 0) {
            throw new Exception(sprintf('Invalid TTL: %d. Cannot be negative.', $ttl));
        }
    }
    
    protected function validateRequiredField(array $data, string $fieldName, ?int $lineNumber = null): void
    {
        if (!isset($data[$fieldName]) || $data[$fieldName] === '' || $data[$fieldName] === null) {
            $lineInfo = $lineNumber !== null ? sprintf(' at line %d', $lineNumber) : '';
            throw new Exception(sprintf('Missing required field: %s%s', $fieldName, $lineInfo));
        }
    }
    
    protected function parseBoolean(mixed $value): ?bool
    {
        if (is_bool($value)) {
            return $value;
        }
        
        if (is_string($value)) {
            $lower = strtolower(trim($value));
            if ($lower === 'true' || $lower === '1' || $lower === 'yes' || $lower === 'on') {
                return true;
            }
            if ($lower === 'false' || $lower === '0' || $lower === 'no' || $lower === 'off') {
                return false;
            }
        }
        
        if (is_int($value)) {
            return $value !== 0;
        }
        
        return null;
    }
    
    protected function parseFloat(mixed $value): ?float
    {
        if (is_float($value)) {
            return $value;
        }
        
        if (is_int($value)) {
            return (float) $value;
        }
        
        if (is_string($value)) {
            $trimmed = trim($value);
            if (is_numeric($trimmed)) {
                return (float) $trimmed;
            }
        }
        
        return null;
    }
    
    protected function parseInt(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }
        
        if (is_float($value) && (string) (int) $value === (string) $value) {
            return (int) $value;
        }
        
        if (is_string($value)) {
            $trimmed = trim($value);
            if (is_numeric($trimmed) && (string) (int) $trimmed === $trimmed) {
                return (int) $trimmed;
            }
        }
        
        return null;
    }
}
