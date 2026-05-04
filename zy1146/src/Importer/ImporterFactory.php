<?php

namespace CacheAnalyzer\Importer;

use Exception;

class ImporterFactory
{
    public const TYPE_CACHE_EVENTS = 'cache_events';
    public const TYPE_ROUTES = 'routes';
    public const TYPE_CACHE_CONFIG = 'cache_config';
    public const TYPE_SLOW_QUERIES = 'slow_queries';
    
    private static array $importers = [];
    
    /**
     * 根据类型获取导入器实例
     * 
     * @param string $type 数据类型
     * @return ImporterInterface
     * @throws Exception 当类型不支持时抛出异常
     */
    public static function create(string $type): ImporterInterface
    {
        if (isset(self::$importers[$type])) {
            return self::$importers[$type];
        }
        
        $importer = match ($type) {
            self::TYPE_CACHE_EVENTS => new CacheEventsImporter(),
            self::TYPE_ROUTES => new RoutesImporter(),
            self::TYPE_CACHE_CONFIG => new CacheConfigImporter(),
            self::TYPE_SLOW_QUERIES => new SlowQueriesImporter(),
            default => throw new Exception(sprintf('Unknown importer type: %s', $type)),
        };
        
        self::$importers[$type] = $importer;
        
        return $importer;
    }
    
    /**
     * 根据文件扩展名自动检测并创建导入器
     * 
     * @param string $filePath 文件路径
     * @param string|null $hint 类型提示
     * @return ImporterInterface
     * @throws Exception 当无法确定类型时抛出异常
     */
    public static function createFromFile(string $filePath, ?string $hint = null): ImporterInterface
    {
        if ($hint !== null) {
            return self::create($hint);
        }
        
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $filename = basename($filePath);
        
        $lowerFilename = strtolower($filename);
        
        if (strpos($lowerFilename, 'cache-event') !== false || 
            strpos($lowerFilename, 'cache_events') !== false) {
            return self::create(self::TYPE_CACHE_EVENTS);
        }
        
        if (strpos($lowerFilename, 'route') !== false) {
            return self::create(self::TYPE_ROUTES);
        }
        
        if (strpos($lowerFilename, 'cache-config') !== false || 
            strpos($lowerFilename, 'cache_config') !== false ||
            strpos($lowerFilename, 'config') !== false) {
            return self::create(self::TYPE_CACHE_CONFIG);
        }
        
        if (strpos($lowerFilename, 'slow-query') !== false || 
            strpos($lowerFilename, 'slow_queries') !== false ||
            strpos($lowerFilename, 'slowquery') !== false) {
            return self::create(self::TYPE_SLOW_QUERIES);
        }
        
        if ($extension === 'jsonl') {
            return self::create(self::TYPE_CACHE_EVENTS);
        }
        
        if ($extension === 'yaml' || $extension === 'yml') {
            return self::create(self::TYPE_CACHE_CONFIG);
        }
        
        if ($extension === 'csv') {
            if (strpos($lowerFilename, 'route') !== false) {
                return self::create(self::TYPE_ROUTES);
            }
            if (strpos($lowerFilename, 'slow') !== false || strpos($lowerFilename, 'query') !== false) {
                return self::create(self::TYPE_SLOW_QUERIES);
            }
        }
        
        throw new Exception(sprintf(
            'Cannot determine importer type for file: %s. Please specify the type explicitly.',
            $filename
        ));
    }
    
    /**
     * 获取支持的导入器类型列表
     * 
     * @return array
     */
    public static function getSupportedTypes(): array
    {
        return [
            self::TYPE_CACHE_EVENTS => [
                'name' => 'Cache Events',
                'description' => 'Import cache events from JSONL format',
                'extensions' => ['jsonl'],
            ],
            self::TYPE_ROUTES => [
                'name' => 'Routes',
                'description' => 'Import route information from CSV format',
                'extensions' => ['csv'],
            ],
            self::TYPE_CACHE_CONFIG => [
                'name' => 'Cache Configuration',
                'description' => 'Import cache configuration from YAML format',
                'extensions' => ['yaml', 'yml'],
            ],
            self::TYPE_SLOW_QUERIES => [
                'name' => 'Slow Queries',
                'description' => 'Import slow query logs from CSV format',
                'extensions' => ['csv'],
            ],
        ];
    }
    
    /**
     * 清除缓存的导入器实例
     */
    public static function clearCache(): void
    {
        self::$importers = [];
    }
}
