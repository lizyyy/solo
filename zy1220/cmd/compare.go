package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"escape-analyzer/internal/analyzer"
	"escape-analyzer/internal/reporter"
	"escape-analyzer/internal/storage"
	"escape-analyzer/pkg/types"
)

var (
	compareOutput string
	compareFormat string
)

var compareCmd = &cobra.Command{
	Use:   "compare [before-id] [after-id]",
	Short: "对比两次分析结果",
	Long: `对比优化前后的两次分析结果，查看逃逸变化。

示例：
  escape-analyzer compare <before-id> <after-id>
  escape-analyzer compare <before-id> <after-id> -o report.md -f markdown`,
	Args: cobra.ExactArgs(2),
	RunE: runCompare,
}

func init() {
	compareCmd.Flags().StringVarP(&compareOutput, "output", "o", "", "输出文件路径")
	compareCmd.Flags().StringVarP(&compareFormat, "format", "f", "console", "输出格式: console, json, markdown")

	rootCmd.AddCommand(compareCmd)
}

func runCompare(cmd *cobra.Command, args []string) error {
	beforeID := args[0]
	afterID := args[1]

	store, err := storage.NewStore()
	if err != nil {
		return fmt.Errorf("无法初始化存储: %w", err)
	}

	before, err := store.Load(beforeID)
	if err != nil {
		return fmt.Errorf("加载优化前分析结果失败: %w", err)
	}

	after, err := store.Load(afterID)
	if err != nil {
		return fmt.Errorf("加载优化后分析结果失败: %w", err)
	}

	a := analyzer.NewEscapeAnalyzer()
	comparison := a.Compare(before, after)

	return outputComparison(comparison, compareOutput, compareFormat)
}

func outputComparison(comparison *types.ComparisonResult, outputPath string, format string) error {
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
		if err := r.ExportComparisonJSON(comparison, output); err != nil {
			return fmt.Errorf("导出 JSON 失败: %w", err)
		}

	case "markdown":
		if err := r.ExportComparisonMarkdown(comparison, output); err != nil {
			return fmt.Errorf("导出 Markdown 失败: %w", err)
		}

	case "console":
		fallthrough
	default:
		printConsoleComparison(comparison)
	}

	return nil
}

func printConsoleComparison(comparison *types.ComparisonResult) {
	fmt.Println("=")
	fmt.Println("           内存逃逸对比分析结果")
	fmt.Println("=")
	fmt.Println()

	fmt.Println("【对比概览】")
	fmt.Printf("  优化前逃逸次数: %d\n", comparison.Before.Stats.TotalEscapes)
	fmt.Printf("  优化后逃逸次数: %d\n", comparison.After.Stats.TotalEscapes)

	change := comparison.After.Stats.TotalEscapes - comparison.Before.Stats.TotalEscapes
	if change < 0 {
		fmt.Printf("  变化: %d (减少 %d 次逃逸) \n", change, -change)
	} else if change > 0 {
		fmt.Printf("  变化: +%d (增加 %d 次逃逸) \n", change, change)
	} else {
		fmt.Println("  变化: 0 (无变化)")
	}

	if comparison.Improved {
		fmt.Println("\n  ✅ 性能有所提升！")
	} else {
		fmt.Println("\n  ⚠️  性能未提升")
	}

	fmt.Println()

	if len(comparison.Diff.FixedEscapes) > 0 {
		fmt.Printf("【已修复的逃逸】(%d 处)\n", len(comparison.Diff.FixedEscapes))
		for i, entry := range comparison.Diff.FixedEscapes {
			fmt.Printf("  [%d] %s\n", i+1, entry.Variable)
			fmt.Printf("      文件: %s:%d\n", entry.SourceFile, entry.LineNumber)
			fmt.Printf("      原因: %s\n", reasonName(entry.Reason))
		}
		fmt.Println()
	}

	if len(comparison.Diff.NewEscapes) > 0 {
		fmt.Printf("【新增的逃逸】(%d 处)\n", len(comparison.Diff.NewEscapes))
		for i, entry := range comparison.Diff.NewEscapes {
			fmt.Printf("  [%d] %s\n", i+1, entry.Variable)
			fmt.Printf("      文件: %s:%d\n", entry.SourceFile, entry.LineNumber)
			fmt.Printf("      原因: %s\n", reasonName(entry.Reason))
		}
		fmt.Println()
	}

	if len(comparison.Suggested) > 0 {
		fmt.Println("【重构建议】")
		for i, suggestion := range comparison.Suggested {
			fmt.Printf("\n  [%d] %s (%s)\n", i+1, suggestion.Title, suggestion.Severity)
			fmt.Printf("      位置: %s\n", suggestion.Location)
			fmt.Printf("      描述: %s\n", suggestion.Description)
			if suggestion.Example != "" {
				fmt.Printf("      示例:\n%s\n", indentExample(suggestion.Example, "        "))
			}
		}
	}

	fmt.Println()
	fmt.Println("=")
}

func indentExample(example, indent string) string {
	lines := ""
	for i, line := range splitLines(example) {
		if i > 0 {
			lines += indent
		}
		lines += line + "\n"
	}
	return lines
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}
