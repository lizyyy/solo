package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"go-perf-helper/internal/analyzer"
	"go-perf-helper/internal/parser"
	"go-perf-helper/internal/reporter"
	"go-perf-helper/internal/storage"

	"github.com/spf13/cobra"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "分析性能剖析数据",
	Long:  `分析 CPU、内存、阻塞、锁竞争等性能剖析数据，识别瓶颈并生成优化建议。`,
	Run:   runAnalyze,
}

func init() {
	rootCmd.AddCommand(analyzeCmd)

	// 定义分析选项
	analyzeCmd.Flags().StringP("name", "n", "", "分析名称")
	analyzeCmd.Flags().StringP("cpu", "c", "", "CPU 剖析文件路径")
	analyzeCmd.Flags().StringP("heap", "m", "", "堆内存剖析文件路径")
	analyzeCmd.Flags().StringP("block", "b", "", "阻塞剖析文件路径")
	analyzeCmd.Flags().StringP("mutex", "x", "", "锁竞争剖析文件路径")
	analyzeCmd.Flags().StringP("trace", "t", "", "runtime/trace 文件路径")
	analyzeCmd.Flags().StringP("benchstat", "s", "", "benchstat 对比文件路径")
	analyzeCmd.Flags().Float64("cpu-threshold", 0.10, "CPU 瓶颈识别阈值（0.0-1.0）")
	analyzeCmd.Flags().Float64("memory-threshold", 0.20, "内存瓶颈识别阈值（0.0-1.0）")
	analyzeCmd.Flags().Float64("blocking-threshold", 0.10, "阻塞瓶颈识别阈值（0.0-1.0）")
	analyzeCmd.Flags().Float64("mutex-threshold", 0.10, "锁竞争瓶颈识别阈值（0.0-1.0）")
	analyzeCmd.Flags().BoolP("save", "S", false, "保存分析结果")
	analyzeCmd.Flags().StringP("output", "o", "", "输出文件路径（支持 .json 和 .md）")
}

func runAnalyze(cmd *cobra.Command, args []string) {
	// 获取命令行参数
	name, _ := cmd.Flags().GetString("name")
	cpuPath, _ := cmd.Flags().GetString("cpu")
	heapPath, _ := cmd.Flags().GetString("heap")
	blockPath, _ := cmd.Flags().GetString("block")
	mutexPath, _ := cmd.Flags().GetString("mutex")
	tracePath, _ := cmd.Flags().GetString("trace")
	benchstatPath, _ := cmd.Flags().GetString("benchstat")
	cpuThreshold, _ := cmd.Flags().GetFloat64("cpu-threshold")
	memoryThreshold, _ := cmd.Flags().GetFloat64("memory-threshold")
	blockingThreshold, _ := cmd.Flags().GetFloat64("blocking-threshold")
	mutexThreshold, _ := cmd.Flags().GetFloat64("mutex-threshold")
	save, _ := cmd.Flags().GetBool("save")
	outputPath, _ := cmd.Flags().GetString("output")

	// 检查是否提供了至少一个剖析文件
	if cpuPath == "" && heapPath == "" && blockPath == "" && 
	   mutexPath == "" && tracePath == "" && benchstatPath == "" {
		errorf("错误：必须提供至少一个剖析文件路径")
		errorf("使用 --help 查看帮助信息")
		os.Exit(1)
	}

	// 创建解析器
	pprofParser := &parser.PprofParser{}
	traceParser := &parser.TraceParser{}

	// 准备分析选项
	options := &analyzer.AnalysisOptions{
		Name: name,
	}

	// 解析 CPU 剖析
	if cpuPath != "" {
		cpuSamples, err := pprofParser.ParseCPUProfile(cpuPath)
		if err != nil {
			errorf("错误：无法解析 CPU 剖析文件: %v", err)
			os.Exit(1)
		}
		options.CPUProfile = cpuSamples
		fmt.Printf("已加载 CPU 剖析文件: %s (%d 个样本)\n", cpuPath, len(cpuSamples))
	}

	// 解析堆内存剖析
	if heapPath != "" {
		heapSamples, err := pprofParser.ParseHeapProfile(heapPath)
		if err != nil {
			errorf("错误：无法解析堆内存剖析文件: %v", err)
			os.Exit(1)
		}
		options.HeapProfile = heapSamples
		fmt.Printf("已加载堆内存剖析文件: %s (%d 个样本)\n", heapPath, len(heapSamples))
	}

	// 解析阻塞剖析
	if blockPath != "" {
		blockSamples, err := pprofParser.ParseBlockProfile(blockPath)
		if err != nil {
			errorf("错误：无法解析阻塞剖析文件: %v", err)
			os.Exit(1)
		}
		options.BlockProfile = blockSamples
		fmt.Printf("已加载阻塞剖析文件: %s (%d 个样本)\n", blockPath, len(blockSamples))
	}

	// 解析锁竞争剖析
	if mutexPath != "" {
		mutexSamples, err := pprofParser.ParseMutexProfile(mutexPath)
		if err != nil {
			errorf("错误：无法解析锁竞争剖析文件: %v", err)
			os.Exit(1)
		}
		options.MutexProfile = mutexSamples
		fmt.Printf("已加载锁竞争剖析文件: %s (%d 个样本)\n", mutexPath, len(mutexSamples))
	}

	// 解析 trace 文件
	if tracePath != "" {
		traceEvents, err := traceParser.ParseTraceFile(tracePath)
		if err != nil {
			errorf("错误：无法解析 trace 文件: %v", err)
			os.Exit(1)
		}
		options.TraceEvents = traceEvents
		fmt.Printf("已加载 trace 文件: %s (%d 个事件)\n", tracePath, len(traceEvents))
	}

	// 准备分析引擎配置
	config := &analyzer.AnalyzerConfig{
		CPUThreshold:      cpuThreshold,
		MemoryThreshold:   memoryThreshold,
		BlockingThreshold: blockingThreshold,
		MutexThreshold:    mutexThreshold,
	}

	// 创建分析引擎并执行分析
	eng := analyzer.NewAnalyzer(config)
	analysis, err := eng.Analyze(options)
	if err != nil {
		errorf("错误：分析失败: %v", err)
		os.Exit(1)
	}

	// 显示分析结果
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("分析结果")
	fmt.Println(strings.Repeat("=", 60))

	if len(analysis.Bottlenecks) > 0 {
		fmt.Printf("\n发现 %d 个性能瓶颈：\n", len(analysis.Bottlenecks))
		for i, b := range analysis.Bottlenecks {
			fmt.Printf("\n[%d] 类型: %s, 严重程度: %.1f/10\n", i+1, b.Type, b.Severity)
			fmt.Printf("    描述: %s\n", b.Description)
			fmt.Printf("    证据: %s\n", b.Evidence)
			fmt.Printf("    建议: %s\n", b.Recommendation)
		}
	} else {
		fmt.Println("\n未发现明显的性能瓶颈。")
	}

	if len(analysis.Recommendations) > 0 {
		fmt.Printf("\n\n优化建议 (%d 项)：\n", len(analysis.Recommendations))
		for i, r := range analysis.Recommendations {
			fmt.Printf("\n[%d] %s (优先级: %d)\n", i+1, r.Title, r.Priority)
			fmt.Printf("    描述: %s\n", r.Description)
			fmt.Printf("    证据: %s\n", r.Evidence)
		}
	}

	// 显示摘要
	fmt.Println("\n" + strings.Repeat("-", 60))
	fmt.Println("分析摘要")
	fmt.Println(strings.Repeat("-", 60))
	fmt.Printf("CPU 样本总数: %d\n", analysis.Summary.TotalCPUSamples)
	fmt.Printf("堆内存已分配: %d bytes\n", analysis.Summary.TotalHeapAlloc)
	fmt.Printf("堆内存正在使用: %d bytes\n", analysis.Summary.TotalHeapInUse)
	fmt.Printf("阻塞次数: %d\n", analysis.Summary.TotalBlockCount)
	fmt.Printf("锁竞争次数: %d\n", analysis.Summary.TotalMutexCount)

	// 保存分析结果
	if save {
		store, err := storage.DefaultStorage()
		if err != nil {
			errorf("警告：无法创建存储: %v", err)
		} else {
			if err := store.Save(analysis); err != nil {
				errorf("警告：无法保存分析结果: %v", err)
			} else {
				fmt.Printf("\n分析结果已保存，ID: %s\n", analysis.ID)
			}
		}
	}

	// 导出报告
	if outputPath != "" {
		// 确定输出格式
		var format reporter.ExportFormat
		ext := strings.ToLower(filepath.Ext(outputPath))
		switch ext {
		case ".json":
			format = reporter.FormatJSON
		case ".md", ".markdown":
			format = reporter.FormatMarkdown
		default:
			// 默认使用 Markdown 格式
			format = reporter.FormatMarkdown
			outputPath = outputPath + ".md"
		}

		rep := reporter.NewReporter()
		exportOptions := &reporter.ExportOptions{
			Format:          format,
			IncludeDetails:  true,
			IncludeCallStack: true,
			OutputPath:      outputPath,
		}

		if err := rep.ExportAnalysis(analysis, exportOptions); err != nil {
			errorf("错误：无法导出报告: %v", err)
			os.Exit(1)
		}
		fmt.Printf("报告已导出到: %s\n", outputPath)
	}

	fmt.Println("\n分析完成！")
}
