package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"escape-analyzer/internal/analyzer"
	"escape-analyzer/internal/reporter"
	"escape-analyzer/internal/storage"
	"escape-analyzer/pkg/types"
)

var (
	analyzeDesc      string
	analyzeSource    string
	analyzeBenchmark string
	analyzeOutput    string
	analyzeFormat    string
	analyzeSave      bool
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze [escape-log-file]",
	Short: "分析逃逸日志",
	Long: `分析 go build -gcflags=-m 生成的逃逸日志，识别内存逃逸原因。

逃逸日志生成方式：
  go build -gcflags=-m ./... 2>&1 > escape.log

示例：
  escape-analyzer analyze escape.log
  escape-analyzer analyze escape.log --benchmark bench.log
  escape-analyzer analyze escape.log -o report.md -f markdown`,
	Args: cobra.ExactArgs(1),
	RunE: runAnalyze,
}

func init() {
	analyzeCmd.Flags().StringVarP(&analyzeDesc, "desc", "d", "", "分析描述")
	analyzeCmd.Flags().StringVarP(&analyzeSource, "source", "s", "", "源文件或目录")
	analyzeCmd.Flags().StringVarP(&analyzeBenchmark, "benchmark", "b", "", "benchmark 结果文件")
	analyzeCmd.Flags().StringVarP(&analyzeOutput, "output", "o", "", "输出文件路径")
	analyzeCmd.Flags().StringVarP(&analyzeFormat, "format", "f", "console", "输出格式: console, json, markdown")
	analyzeCmd.Flags().BoolVarP(&analyzeSave, "save", "", true, "保存分析结果到历史记录")

	rootCmd.AddCommand(analyzeCmd)
}

func runAnalyze(cmd *cobra.Command, args []string) error {
	escapeLogPath := args[0]

	escapeLogFile, err := os.Open(escapeLogPath)
	if err != nil {
		return fmt.Errorf("无法打开逃逸日志文件: %w", err)
	}
	defer escapeLogFile.Close()

	var benchmarkFile *os.File
	if analyzeBenchmark != "" {
		benchmarkFile, err = os.Open(analyzeBenchmark)
		if err != nil {
			return fmt.Errorf("无法打开 benchmark 文件: %w", err)
		}
		defer benchmarkFile.Close()
	}

	sourceFiles := make(map[string]string)
	if analyzeSource != "" {
		if err := loadSourceFiles(analyzeSource, sourceFiles); err != nil {
			fmt.Fprintf(os.Stderr, "警告: 加载源文件失败: %v\n", err)
		}
	}

	a := analyzer.NewEscapeAnalyzer()

	var result *types.AnalysisResult
	if benchmarkFile != nil {
		result, err = a.AnalyzeWithBenchmark(escapeLogFile, benchmarkFile, analyzeDesc, sourceFiles)
	} else {
		result, err = a.Analyze(escapeLogFile, analyzeDesc, sourceFiles)
	}

	if err != nil {
		return fmt.Errorf("分析失败: %w", err)
	}

	if analyzeSave {
		store, err := storage.NewStore()
		if err != nil {
			fmt.Fprintf(os.Stderr, "警告: 无法初始化存储: %v\n", err)
		} else {
			if err := store.Save(result); err != nil {
				fmt.Fprintf(os.Stderr, "警告: 保存分析结果失败: %v\n", err)
			} else {
				fmt.Fprintf(os.Stderr, "分析结果已保存，ID: %s\n", result.ID)
			}
		}
	}

	if err := outputResult(result, analyzeOutput, analyzeFormat); err != nil {
		return err
	}

	return nil
}

func loadSourceFiles(sourcePath string, sourceFiles map[string]string) error {
	info, err := os.Stat(sourcePath)
	if err != nil {
		return err
	}

	if info.IsDir() {
		return filepath.Walk(sourcePath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() && strings.HasSuffix(info.Name(), ".go") {
				content, err := os.ReadFile(path)
				if err != nil {
					return err
				}
				sourceFiles[path] = string(content)
			}
			return nil
		})
	}

	if strings.HasSuffix(info.Name(), ".go") {
		content, err := os.ReadFile(sourcePath)
		if err != nil {
			return err
		}
		sourceFiles[sourcePath] = string(content)
	}

	return nil
}

func outputResult(result *types.AnalysisResult, outputPath string, format string) error {
	r := reporter.NewReporter()

	var output *os.File
	if outputPath != "" {
		var err error
		output, err = os.Create(outputPath)
		if err != nil {
			return fmt.Errorf("无法创建输出文件: %w", err)
		}
		defer output.Close()
	} else {
		output = os.Stdout
	}

	switch format {
	case "json":
		if err := r.ExportJSON(result, output); err != nil {
			return fmt.Errorf("导出 JSON 失败: %w", err)
		}

	case "markdown":
		if err := r.ExportMarkdown(result, output); err != nil {
			return fmt.Errorf("导出 Markdown 失败: %w", err)
		}

	case "console":
		fallthrough
	default:
		printConsoleResult(result)
	}

	return nil
}

func printConsoleResult(result *types.AnalysisResult) {
	fmt.Println("=")
	fmt.Println("           内存逃逸分析结果")
	fmt.Println("=")
	fmt.Printf("分析ID: %s\n", result.ID)
	fmt.Printf("分析时间: %s\n", result.Timestamp.Format("2006-01-02 15:04:05"))
	if result.Description != "" {
		fmt.Printf("描述: %s\n", result.Description)
	}
	fmt.Println()

	fmt.Println("【统计概览】")
	fmt.Printf("  总逃逸次数: %d\n", result.Stats.TotalEscapes)
	fmt.Println("  按原因分类:")
	for reason, count := range result.Stats.ByReason {
		fmt.Printf("    - %s: %d\n", reasonName(reason), count)
	}
	fmt.Println()

	if len(result.Entries) > 0 {
		fmt.Println("【详细逃逸分析】")
		for i, entry := range result.Entries {
			fmt.Printf("\n  [%d] %s\n", i+1, entry.Variable)
			fmt.Printf("      文件: %s:%d\n", entry.SourceFile, entry.LineNumber)
			fmt.Printf("      原因: %s\n", reasonName(entry.Reason))
			fmt.Printf("      日志: %s\n", entry.Message)
		}
	} else {
		fmt.Println("【详细逃逸分析】无逃逸记录")
	}

	if result.Benchmark != nil {
		fmt.Println()
		fmt.Println("【Benchmark 数据】")
		fmt.Printf("  名称: %s\n", result.Benchmark.Name)
		fmt.Printf("  迭代次数: %d\n", result.Benchmark.Iterations)
		fmt.Printf("  每次耗时: %d ns/op\n", result.Benchmark.NsPerOp)
		fmt.Printf("  每次分配: %d B/op\n", result.Benchmark.BytesPerOp)
		fmt.Printf("  每次分配次数: %d allocs/op\n", result.Benchmark.AllocsPerOp)
	}

	fmt.Println()
	fmt.Println("=")
}

func reasonName(reason types.EscapeReason) string {
	names := map[types.EscapeReason]string{
		types.EscapeReasonInterfaceBox:   "接口装箱",
		types.EscapeReasonClosureCapture: "闭包捕获",
		types.EscapeReasonPointerReturn:  "指针返回",
		types.EscapeReasonSliceGrow:      "Slice 扩容",
		types.EscapeReasonMapGrow:        "Map 扩容",
		types.EscapeReasonGoroutine:      "Goroutine 边界",
		types.EscapeReasonUnknown:        "未知原因",
	}
	if name, ok := names[reason]; ok {
		return name
	}
	return string(reason)
}
