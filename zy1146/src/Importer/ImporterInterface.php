<?php

namespace CacheAnalyzer\Importer;

use Exception;

interface ImporterInterface
{
    /**
     * 从字符串内容导入数据
     * 
     * @param string $content 要导入的内容
     * @return array 导入的数据对象数组
     * @throws Exception 当导入失败时抛出异常
     */
    public function import(string $content): array;
    
    /**
     * 从文件路径导入数据
     * 
     * @param string $filePath 文件路径
     * @return array 导入的数据对象数组
     * @throws Exception 当文件不存在或导入失败时抛出异常
     */
    public function importFromFile(string $filePath): array;
    
    /**
     * 验证数据格式
     * 
     * @param string $content 要验证的内容
     * @return bool 格式是否有效
     */
    public function validate(string $content): bool;
    
    /**
     * 获取导入错误
     * 
     * @return array 错误数组，每个错误包含 line_number 和 message
     */
    public function getErrors(): array;
    
    /**
     * 清除错误记录
     */
    public function clearErrors(): void;
}
