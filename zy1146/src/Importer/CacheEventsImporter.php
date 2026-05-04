<?php

namespace CacheAnalyzer\Importer;

use CacheAnalyzer\Model\CacheEvent;
use Exception;

class CacheEventsImporter extends AbstractImporter
{
    private ?float $previousTimestamp = null;
    private array $seenKeys = [];
    
    public function import(string $content): array
    {
        $this->clearErrors();
        $this->previousTimestamp = null;
        $this->seenKeys = [];
        
        $events = [];
        $lines = explode("\n", $content);
        
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
                $data = $this->parseJsonLine($line);
                
                $this->validateEventData($data);
                
                $event = CacheEvent::fromArray($data);
                
                $this->checkForDuplicates($event);
                
                $events[] = $event;
                
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
        
        return $events;
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
    
    private function parseJsonLine(string $line): array
    {
        $data = json_decode($line, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception(sprintf(
                'Invalid JSON: %s',
                json_last_error_msg()
            ));
        }
        
        if (!is_array($data)) {
            throw new Exception('JSON must be an object');
        }
        
        return $data;
    }
    
    private function validateEventData(array $data): void
    {
        $this->validateRequiredField($data, 'key', $this->lineNumber);
        $this->validateRequiredField($data, 'type', $this->lineNumber);
        $this->validateRequiredField($data, 'backend', $this->lineNumber);
        $this->validateRequiredField($data, 'timestamp', $this->lineNumber);
        
        $timestamp = $this->parseFloat($data['timestamp']);
        if ($timestamp === null) {
            throw new Exception(sprintf('Invalid timestamp: %s', $data['timestamp']));
        }
        
        $this->validateTimestamp($timestamp, $this->previousTimestamp);
        $this->previousTimestamp = $timestamp;
        
        if (isset($data['ttl'])) {
            $ttl = $this->parseInt($data['ttl']);
            $this->validateTtl($ttl);
        }
    }
    
    private function checkForDuplicates(CacheEvent $event): void
    {
        $key = $event->getKey();
        $type = $event->getType();
        $timestamp = $event->getTimestamp();
        
        $signature = sprintf('%s:%s:%.6f', $key, $type, $timestamp);
        
        if (isset($this->seenKeys[$signature])) {
            throw new Exception(sprintf(
                'Duplicate event detected: key="%s", type="%s", timestamp="%.6f"',
                $key,
                $type,
                $timestamp
            ));
        }
        
        $this->seenKeys[$signature] = true;
    }
    
    public function getStatistics(): array
    {
        return [
            'total_lines' => $this->lineNumber,
            'error_count' => count($this->errors),
            'unique_keys' => count($this->seenKeys),
        ];
    }
}
