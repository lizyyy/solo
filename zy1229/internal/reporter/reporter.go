package reporter

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"text/template"
	"time"

	"go-perf-helper/internal/analyzer"
	"go-perf-helper/internal/storage"
)

// Reporter 报告生成器
type Reporter struct{}

// NewReporter 创建新的报告生成器
func NewReporter() *Reporter {
	return &Reporter{}
}

// ExportFormat 导出格式
type ExportFormat string

const (
	FormatMarkdown ExportFormat = "md"
	FormatJSON     ExportFormat = "json"
)

// ExportOptions 导出选项
type ExportOptions struct {
	Format          ExportFormat
	IncludeDetails  bool
	IncludeCallStack bool
	OutputPath      string
}

// ExportAnalysis 导出分析结果
func (r *Reporter) ExportAnalysis(analysis *analyzer.Analysis, options *ExportOptions) error {
	if options == nil {
		options = &ExportOptions{
			Format:          FormatMarkdown,
			IncludeDetails:  false,
			IncludeCallStack: false,
		}
	}

	switch options.Format {
	case FormatJSON:
		return r.exportJSON(analysis, options)
	case FormatMarkdown:
		fallthrough
	default:
		return r.exportMarkdown(analysis, options)
	}
}

// exportJSON 导出为 JSON 格式
func (r *Reporter) exportJSON(analysis *analyzer.Analysis, options *ExportOptions) error {
	data, err := json.MarshalIndent(analysis, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal analysis: %w", err)
	}

	if options.OutputPath != "" {
		if err := os.WriteFile(options.OutputPath, data, 0644); err != nil {
			return fmt.Errorf("failed to write JSON file: %w", err)
		}
	} else {
		fmt.Println(string(data))
	}

	return nil
}

// exportMarkdown 导出为 Markdown 格式
func (r *Reporter) exportMarkdown(analysis *analyzer.Analysis, options *ExportOptions) error {
	// 生成 Markdown 内容
	content := r.generateMarkdownReport(analysis, options)

	if options.OutputPath != "" {
		if err := os.WriteFile(options.OutputPath, []byte(content), 0644); err != nil {
			return fmt.Errorf("failed to write Markdown file: %w", err)
		}
	} else {
		fmt.Println(content)
	}

	return nil
}

// generateMarkdownReport 生成 Markdown 报告内容
func (r *Reporter) generateMarkdownReport(analysis *analyzer.Analysis, options *ExportOptions) string {
	var sb strings.Builder

	// 标题
	sb.WriteString(fmt.Sprintf("# 性能分析报告 - %s\n\n", analysis.Name))
	sb.WriteString(fmt.Sprintf("**分析时间**: %s\n\n", analysis.CreatedAt.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("**分析 ID**: %s\n\n", analysis.ID))

	// 摘要
	sb.WriteString("## 分析摘要\n\n")
	sb.WriteString(r.generateSummarySection(analysis))

	// 瓶颈分析
	if len(analysis.Bottlenecks) > 0 {
		sb.WriteString("\n## 性能瓶颈分析\n\n")
		
		// 按类型分组
		typeGrouped := make(map[analyzer.BottleneckType][]analyzer.Bottleneck)
		for _, b := range analysis.Bottlenecks {
			typeGrouped[b.Type] = append(typeGrouped[b.Type], b)
		}

		// 按类型排序显示
		types := []analyzer.BottleneckType{
			analyzer.BottleneckTypeCPU,
			analyzer.BottleneckTypeMemory,
			analyzer.BottleneckTypeBlocking,
			analyzer.BottleneckTypeMutex,
			analyzer.BottleneckTypeGoroutine,
		}

		for _, bType := range types {
			if bottlenecks, ok := typeGrouped[bType]; ok && len(bottlenecks) > 0 {
				sb.WriteString(fmt.Sprintf("### %s 瓶颈\n\n", r.getBottleneckTypeName(bType)))
				
				for i, b := range bottlenecks {
					sb.WriteString(fmt.Sprintf("#### %d. %s\n\n", i+1, b.Description))
					sb.WriteString(fmt.Sprintf("- **严重程度**: %.1f/10\n", b.Severity))
					sb.WriteString(fmt.Sprintf("- **证据**: %s\n", b.Evidence))
					sb.WriteString(fmt.Sprintf("- **建议**: %s\n\n", b.Recommendation))

					if options.IncludeCallStack && len(b.CallStack.Frames) > 0 {
						sb.WriteString("**调用栈**:\n\n")
						sb.WriteString("```\n")
						for _, frame := range b.CallStack.Frames {
							if frame.File != "" {
								sb.WriteString(fmt.Sprintf("%s (%s:%d)\n", frame.Function, frame.File, frame.Line))
							} else {
								sb.WriteString(fmt.Sprintf("%s\n", frame.Function))
							}
						}
						sb.WriteString("```\n\n")
					}
				}
			}
		}
	}

	// 优化建议
	if len(analysis.Recommendations) > 0 {
		sb.WriteString("\n## 优化建议\n\n")
		
		for i, rec := range analysis.Recommendations {
			sb.WriteString(fmt.Sprintf("### %d. %s\n\n", i+1, rec.Title))
			sb.WriteString(fmt.Sprintf("- **优先级**: %d\n", rec.Priority))
			sb.WriteString(fmt.Sprintf("- **描述**: %s\n", rec.Description))
			sb.WriteString(fmt.Sprintf("- **证据**: %s\n\n", rec.Evidence))
		}
	}

	// 详细数据
	if options.IncludeDetails {
		sb.WriteString("\n## 详细数据\n\n")
		
		// CPU 剖析数据
		if len(analysis.CPUProfile) > 0 {
			sb.WriteString("### CPU 剖析数据\n\n")
			sb.WriteString(r.generateCPUProfileTable(analysis.CPUProfile))
		}

		// 堆内存剖析数据
		if len(analysis.HeapProfile) > 0 {
			sb.WriteString("\n### 堆内存剖析数据\n\n")
			sb.WriteString(r.generateHeapProfileTable(analysis.HeapProfile))
		}

		// 阻塞剖析数据
		if len(analysis.BlockProfile) > 0 {
			sb.WriteString("\n### 阻塞剖析数据\n\n")
			sb.WriteString(r.generateBlockProfileTable(analysis.BlockProfile))
		}

		// 锁竞争剖析数据
		if len(analysis.MutexProfile) > 0 {
			sb.WriteString("\n### 锁竞争剖析数据\n\n")
			sb.WriteString(r.generateMutexProfileTable(analysis.MutexProfile))
		}
	}

	return sb.String()
}

// generateSummarySection 生成摘要部分
func (r *Reporter) generateSummarySection(analysis *analyzer.Analysis) string {
	var sb strings.Builder

	// 统计数据
	sb.WriteString("| 指标 | 值 |\n")
	sb.WriteString("|------|-----|\n")
	sb.WriteString(fmt.Sprintf("| CPU 样本总数 | %d |\n", analysis.Summary.TotalCPUSamples))
	sb.WriteString(fmt.Sprintf("| 堆内存已分配 | %s |\n", storage.FormatBytes(analysis.Summary.TotalHeapAlloc)))
	sb.WriteString(fmt.Sprintf("| 堆内存正在使用 | %s |\n", storage.FormatBytes(analysis.Summary.TotalHeapInUse)))
	sb.WriteString(fmt.Sprintf("| 阻塞次数 | %d |\n", analysis.Summary.TotalBlockCount))
	sb.WriteString(fmt.Sprintf("| 锁竞争次数 | %d |\n", analysis.Summary.TotalMutexCount))
	sb.WriteString(fmt.Sprintf("| 发现瓶颈数 | %d |\n", len(analysis.Bottlenecks)))
	sb.WriteString(fmt.Sprintf("| 优化建议数 | %d |\n\n", len(analysis.Recommendations)))

	// 主要瓶颈
	if len(analysis.Summary.TopCPUBottlenecks) > 0 {
		sb.WriteString("#### 主要 CPU 瓶颈\n\n")
		for i, b := range analysis.Summary.TopCPUBottlenecks {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, b))
		}
		sb.WriteString("\n")
	}

	if len(analysis.Summary.TopMemoryBottlenecks) > 0 {
		sb.WriteString("#### 主要内存瓶颈\n\n")
		for i, b := range analysis.Summary.TopMemoryBottlenecks {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, b))
		}
		sb.WriteString("\n")
	}

	if len(analysis.Summary.TopLockingBottlenecks) > 0 {
		sb.WriteString("#### 主要锁竞争瓶颈\n\n")
		for i, b := range analysis.Summary.TopLockingBottlenecks {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, b))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// generateCPUProfileTable 生成 CPU 剖析表格
func (r *Reporter) generateCPUProfileTable(samples []analyzer.CPUProfileSample) string {
	var sb strings.Builder

	// 按值排序
	sorted := make([]analyzer.CPUProfileSample, len(samples))
	copy(sorted, samples)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Value > sorted[j].Value
	})

	// 计算总数
	total := int64(0)
	for _, s := range samples {
		total += s.Value
	}

	sb.WriteString("| 排名 | 函数 | CPU 样本 | 占比 |\n")
	sb.WriteString("|------|------|----------|------|\n")

	for i, s := range sorted {
		if i >= 10 { // 只显示前 10 个
			break
		}
		percentage := 0.0
		if total > 0 {
			percentage = float64(s.Value) / float64(total) * 100
		}
		funcName := "unknown"
		if len(s.CallStack.Frames) > 0 {
			funcName = s.CallStack.Frames[0].Function
			// 缩短函数名
			if len(funcName) > 50 {
				funcName = funcName[:50] + "..."
			}
		}
		sb.WriteString(fmt.Sprintf("| %d | %s | %d | %.1f%% |\n", i+1, funcName, s.Value, percentage))
	}

	return sb.String()
}

// generateHeapProfileTable 生成堆内存剖析表格
func (r *Reporter) generateHeapProfileTable(samples []analyzer.HeapProfileSample) string {
	var sb strings.Builder

	// 按正在使用的字节数排序
	sorted := make([]analyzer.HeapProfileSample, len(samples))
	copy(sorted, samples)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].InUseBytes > sorted[j].InUseBytes
	})

	sb.WriteString("| 排名 | 函数 | 正在使用 | 已分配 | 对象数 |\n")
	sb.WriteString("|------|------|----------|--------|--------|\n")

	for i, s := range sorted {
		if i >= 10 { // 只显示前 10 个
			break
		}
		funcName := "unknown"
		if len(s.CallStack.Frames) > 0 {
			funcName = s.CallStack.Frames[0].Function
			if len(funcName) > 40 {
				funcName = funcName[:40] + "..."
			}
		}
		sb.WriteString(fmt.Sprintf("| %d | %s | %s | %s | %d |\n", 
			i+1, funcName, 
			storage.FormatBytes(s.InUseBytes), 
			storage.FormatBytes(s.AllocBytes),
			s.InUseObjects))
	}

	return sb.String()
}

// generateBlockProfileTable 生成阻塞剖析表格
func (r *Reporter) generateBlockProfileTable(samples []analyzer.BlockProfileSample) string {
	var sb strings.Builder

	// 按阻塞时间排序
	sorted := make([]analyzer.BlockProfileSample, len(samples))
	copy(sorted, samples)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Nanoseconds > sorted[j].Nanoseconds
	})

	sb.WriteString("| 排名 | 函数 | 阻塞时间 | 阻塞次数 |\n")
	sb.WriteString("|------|------|----------|----------|\n")

	for i, s := range sorted {
		if i >= 10 { // 只显示前 10 个
			break
		}
		funcName := "unknown"
		if len(s.CallStack.Frames) > 0 {
			funcName = s.CallStack.Frames[0].Function
			if len(funcName) > 40 {
				funcName = funcName[:40] + "..."
			}
		}
		sb.WriteString(fmt.Sprintf("| %d | %s | %s | %d |\n", 
			i+1, funcName, 
			storage.FormatDuration(time.Duration(s.Nanoseconds)), 
			s.Count))
	}

	return sb.String()
}

// generateMutexProfileTable 生成锁竞争剖析表格
func (r *Reporter) generateMutexProfileTable(samples []analyzer.MutexProfileSample) string {
	var sb strings.Builder

	// 按等待时间排序
	sorted := make([]analyzer.MutexProfileSample, len(samples))
	copy(sorted, samples)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Nanoseconds > sorted[j].Nanoseconds
	})

	sb.WriteString("| 排名 | 函数 | 等待时间 | 竞争次数 |\n")
	sb.WriteString("|------|------|----------|----------|\n")

	for i, s := range sorted {
		if i >= 10 { // 只显示前 10 个
			break
		}
		funcName := "unknown"
		if len(s.CallStack.Frames) > 0 {
			funcName = s.CallStack.Frames[0].Function
			if len(funcName) > 40 {
				funcName = funcName[:40] + "..."
			}
		}
		sb.WriteString(fmt.Sprintf("| %d | %s | %s | %d |\n", 
			i+1, funcName, 
			storage.FormatDuration(time.Duration(s.Nanoseconds)), 
			s.Count))
	}

	return sb.String()
}

// getBottleneckTypeName 获取瓶颈类型名称
func (r *Reporter) getBottleneckTypeName(bType analyzer.BottleneckType) string {
	switch bType {
	case analyzer.BottleneckTypeCPU:
		return "CPU"
	case analyzer.BottleneckTypeMemory:
		return "内存"
	case analyzer.BottleneckTypeBlocking:
		return "阻塞"
	case analyzer.BottleneckTypeMutex:
		return "锁竞争"
	case analyzer.BottleneckTypeGoroutine:
		return "Goroutine"
	default:
		return "未知"
	}
}

// ExportComparison 导出对比报告
func (r *Reporter) ExportComparison(comparison *analyzer.Comparison, options *ExportOptions) error {
	// 生成对比报告
	if options.Format == FormatJSON {
		data, err := json.MarshalIndent(comparison, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal comparison: %w", err)
		}
		if options.OutputPath != "" {
			return os.WriteFile(options.OutputPath, data, 0644)
		}
		fmt.Println(string(data))
		return nil
	}

	// Markdown 格式
	content := r.generateComparisonMarkdown(comparison, options)
	if options.OutputPath != "" {
		return os.WriteFile(options.OutputPath, []byte(content), 0644)
	}
	fmt.Println(content)
	return nil
}

// generateComparisonMarkdown 生成对比报告 Markdown
func (r *Reporter) generateComparisonMarkdown(comparison *analyzer.Comparison, options *ExportOptions) string {
	var sb strings.Builder

	sb.WriteString("# 性能对比分析报告\n\n")
	sb.WriteString(fmt.Sprintf("**对比时间**: %s\n\n", comparison.CreatedAt.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("**旧分析 ID**: %s\n", comparison.OldAnalysis.ID))
	sb.WriteString(fmt.Sprintf("**新分析 ID**: %s\n\n", comparison.NewAnalysis.ID))

	// 对比摘要
	sb.WriteString("## 对比摘要\n\n")
	sb.WriteString(fmt.Sprintf("| 指标 | 旧版本 | 新版本 | 变化 |\n"))
	sb.WriteString(fmt.Sprintf("|------|--------|--------|------|\n"))
	sb.WriteString(fmt.Sprintf("| 改进项数 | - | - | %d |\n", comparison.Summary.TotalImprovements))
	sb.WriteString(fmt.Sprintf("| 回归项数 | - | - | %d |\n", comparison.Summary.TotalRegressions))
	sb.WriteString(fmt.Sprintf("| 总体评分 | - | - | %.2f |\n\n", comparison.Summary.OverallScore))

	// 改进项
	if len(comparison.Improvements) > 0 {
		sb.WriteString("## 改进项\n\n")
		for i, imp := range comparison.Improvements {
			sb.WriteString(fmt.Sprintf("### %d. %s\n\n", i+1, imp.Description))
			sb.WriteString(fmt.Sprintf("- **旧值**: %.2f\n", imp.OldValue))
			sb.WriteString(fmt.Sprintf("- **新值**: %.2f\n", imp.NewValue))
			sb.WriteString(fmt.Sprintf("- **改进**: %.2f%%\n\n", imp.Improvement*100))
		}
	}

	// 回归项
	if len(comparison.Regressions) > 0 {
		sb.WriteString("## 回归项\n\n")
		for i, reg := range comparison.Regressions {
			sb.WriteString(fmt.Sprintf("### %d. %s\n\n", i+1, reg.Description))
			sb.WriteString(fmt.Sprintf("- **旧值**: %.2f\n", reg.OldValue))
			sb.WriteString(fmt.Sprintf("- **新值**: %.2f\n", reg.NewValue))
			sb.WriteString(fmt.Sprintf("- **回归**: %.2f%%\n\n", reg.Regression*100))
		}
	}

	return sb.String()
}

// GetOutputPath 获取输出路径
func GetOutputPath(analysis *analyzer.Analysis, format ExportFormat) string {
	// 生成默认文件名
	timestamp := analysis.CreatedAt.Format("20060102-150405")
	name := "analysis"
	if analysis.Name != "" {
		name = storage.SanitizeFilename(analysis.Name)
	}
	return fmt.Sprintf("%s_%s.%s", name, timestamp, format)
}
