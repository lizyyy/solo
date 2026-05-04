<?php

namespace CacheAnalyzer\Importer;

use CacheAnalyzer\Model\CacheConfig;
use CacheAnalyzer\Model\CacheEvent;
use Exception;
use Symfony\Component\Yaml\Yaml;
use Symfony\Component\Yaml\Exception\ParseException;

class CacheConfigImporter extends AbstractImporter
{
    public function import(string $content): array
    {
        $this->clearErrors();
        
        $configs = [];
        
        try {
            $data = $this->parseYaml($content);
            
            if (!is_array($data)) {
                throw new Exception('YAML content must be an array');
            }
            
            if (isset($data['backend']) || isset($data['backends'])) {
                $configs = $this->parseConfigStructure($data);
            } else {
                foreach ($data as $key => $item) {
                    if (is_array($item)) {
                        $configs[] = $this->createConfigFromData($item);
                    }
                }
            }
            
        } catch (Exception $e) {
            $this->addError($e->getMessage());
        }
        
        if (!empty($this->errors)) {
            throw new Exception(sprintf(
                'Import completed with %d errors. First error: %s',
                count($this->errors),
                $this->errors[0]['message']
            ));
        }
        
        return $configs;
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
    
    private function parseYaml(string $content): mixed
    {
        try {
            return Yaml::parse($content);
        } catch (ParseException $e) {
            throw new Exception(sprintf('YAML parse error: %s', $e->getMessage()));
        }
    }
    
    private function parseConfigStructure(array $data): array
    {
        $configs = [];
        
        if (isset($data['backend'])) {
            $configs[] = $this->createConfigFromData($data);
        }
        
        if (isset($data['backends']) && is_array($data['backends'])) {
            foreach ($data['backends'] as $backendConfig) {
                if (is_array($backendConfig)) {
                    $configs[] = $this->createConfigFromData($backendConfig);
                }
            }
        }
        
        return $configs;
    }
    
    private function createConfigFromData(array $data): CacheConfig
    {
        $normalizedData = [];
        
        $this->validateRequiredField($data, 'backend');
        $normalizedData['backend'] = $data['backend'];
        
        $normalizedData['name'] = $data['name'] ?? $data['backend'];
        
        $normalizedData['max_memory_mb'] = $this->parseInt($data['max_memory_mb'] ?? $data['maxMemoryMb'] ?? null);
        $normalizedData['max_connections'] = $this->parseInt($data['max_connections'] ?? $data['maxConnections'] ?? null);
        $normalizedData['eviction_policy'] = $data['eviction_policy'] ?? $data['evictionPolicy'] ?? null;
        $normalizedData['persistence_enabled'] = $this->parseBoolean($data['persistence_enabled'] ?? $data['persistenceEnabled'] ?? null);
        
        if (isset($data['default_ttl']) || isset($data['defaultTtl'])) {
            $normalizedData['default_ttl'] = $data['default_ttl'] ?? $data['defaultTtl'];
        }
        
        if (isset($data['key_prefixes']) || isset($data['keyPrefixes'])) {
            $normalizedData['key_prefixes'] = $data['key_prefixes'] ?? $data['keyPrefixes'];
        }
        
        $backend = $normalizedData['backend'];
        
        if ($backend === CacheEvent::BACKEND_OPCACHE) {
            $normalizedData['opcache_config'] = $this->parseOpcacheConfig($data);
        } elseif ($backend === CacheEvent::BACKEND_REDIS) {
            $normalizedData['redis_config'] = $this->parseRedisConfig($data);
        } elseif ($backend === CacheEvent::BACKEND_FILE) {
            $normalizedData['file_config'] = $this->parseFileConfig($data);
        }
        
        return CacheConfig::fromArray($normalizedData);
    }
    
    private function parseOpcacheConfig(array $data): array
    {
        $config = [];
        
        $mapping = [
            'opcache_enabled' => 'opcache_enable',
            'opcache_enable_cli' => 'opcache_enable_cli',
            'opcache_memory_consumption' => 'opcache_memory_consumption',
            'opcache_max_accelerated_files' => 'opcache_max_accelerated_files',
            'opcache_max_wasted_percentage' => 'opcache_max_wasted_percentage',
            'opcache_revalidate_freq' => 'opcache_revalidate_freq',
            'opcache_revalidate_path' => 'opcache_revalidate_path',
            'opcache_validate_timestamps' => 'opcache_validate_timestamps',
            'opcache_inherited_hack' => 'opcache_inherited_hack',
            'opcache_dups_fix' => 'opcache_dups_fix',
            'opcache_log_file_size' => 'opcache_log_file_size',
            'opcache_log_verbosity_level' => 'opcache_log_verbosity_level',
            'opcache_prefer_large_scripts' => 'opcache_prefer_large_scripts',
            'opcache_fast_shutdown' => 'opcache_fast_shutdown',
            'opcache_enable_file_override' => 'opcache_enable_file_override',
            'opcache_optimization_level' => 'opcache_optimization_level',
            'opcache_optimization_debug_level' => 'opcache_optimization_debug_level',
            'opcache_dup_class' => 'opcache_dup_class',
        ];
        
        foreach ($mapping as $target => $source) {
            if (isset($data[$source])) {
                if (in_array($source, ['opcache_enable', 'opcache_enable_cli', 'opcache_validate_timestamps'], true)) {
                    $config[$target] = $this->parseBoolean($data[$source]);
                } elseif (in_array($source, ['opcache_memory_consumption', 'opcache_max_accelerated_files', 'opcache_revalidate_freq'], true)) {
                    $config[$target] = $this->parseInt($data[$source]);
                } else {
                    $config[$target] = $data[$source];
                }
            }
        }
        
        if (isset($data['opcache']) && is_array($data['opcache'])) {
            return array_merge($config, $this->parseOpcacheConfig($data['opcache']));
        }
        
        return $config;
    }
    
    private function parseRedisConfig(array $data): array
    {
        $config = [];
        
        $fields = [
            'host', 'port', 'password', 'database', 'timeout',
            'persistent', 'prefix', 'serializer', 'compression',
            'cluster', 'sentinel', 'read_timeout', 'connect_timeout',
        ];
        
        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $config[$field] = $data[$field];
            }
        }
        
        if (isset($data['redis']) && is_array($data['redis'])) {
            return array_merge($config, $this->parseRedisConfig($data['redis']));
        }
        
        return $config;
    }
    
    private function parseFileConfig(array $data): array
    {
        $config = [];
        
        $fields = [
            'cache_dir', 'file_locking', 'directory_level',
            'file_name_prefix', 'umask', 'gc_probability',
            'gc_divisor', 'gc_maxlifetime',
        ];
        
        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $config[$field] = $data[$field];
            }
        }
        
        if (isset($data['file']) && is_array($data['file'])) {
            return array_merge($config, $this->parseFileConfig($data['file']));
        }
        
        return $config;
    }
}
