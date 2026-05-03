# 示例STL文件目录

本目录用于演示STL文件导入功能。

## 文件名格式

STL文件名应遵循以下格式：
```
{模型编号}_{上下颌}.stl
```

例如：
- `MDL001_upper.stl` (上颌)
- `MDL001_lower.stl` (下颌)

## 上下颌识别

系统会根据文件名中的关键词自动识别上下颌：

### 上颌关键词
- upper, maxilla, maxillary, 上, 上颌, U, Max, UPPER

### 下颌关键词
- lower, mandible, mandibular, 下, 下颌, L, Man, LOWER

## 示例数据说明

本目录中的STL文件是简化的ASCII格式示例，用于演示系统功能。

**实际使用时**：
1. 请将真实的STL扫描文件放入此目录
2. 确保文件名包含模型编号
3. 系统会自动解析STL文件的三角形数量等信息

## 测试场景

- `MDL002` 缺少 `lower` (下颌) STL文件，用于测试缺失检查功能
