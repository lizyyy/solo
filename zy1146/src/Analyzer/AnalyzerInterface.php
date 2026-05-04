<?php

namespace CacheAnalyzer\Analyzer;

interface AnalyzerInterface
{
    /**
     * 执行分析
     * 
     * @param array $data 要分析的数据数组
     * @param array $options 分析选项
     * @return array 分析结果
     */
    public function analyze(array $data, array $options = []): array;
    
    /**
     * 获取分析器名称
     * 
     * @return string
     */
    public function getName(): string;
    
    /**
     * 获取分析器描述
     * 
     * @return string
     */
    public function getDescription(): string;
}
