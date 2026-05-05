package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"go-iface-analyzer/internal/analyzer"
	"go-iface-analyzer/internal/config"
	"go-iface-analyzer/internal/database"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "分析 interface 案例，生成分析报告",
	Long: `读取 interface-cases.yaml、calls.jsonl 和 snippets/*.go，
分析 eface/iface、itab、动态类型和值、值/指针接收者方法集、
类型断言、type switch、typed nil 和接口装箱带来的分配风险。
分析结果会保存到 SQLite 数据库中。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runAnalyze()
	},
}

func init() {
	rootCmd.AddCommand(analyzeCmd)
}

func runAnalyze() error {
	if !checkRequiredFiles() {
		return fmt.Errorf("必要文件不存在，请先运行 'go-iface-analyzer init' 初始化工作目录")
	}

	fmt.Println("开始分析 interface 案例...")

	interfaceCases, err := config.LoadInterfaceCases(interfaceCasesFile)
	if err != nil {
		return fmt.Errorf("加载 interface-cases.yaml 失败: %w", err)
	}
	fmt.Printf("  加载了 %d 个分析案例\n", len(interfaceCases.Cases))

	callRecords, err := config.LoadCallRecords(callsFile)
	if err != nil {
		return fmt.Errorf("加载 calls.jsonl 失败: %w", err)
	}
	fmt.Printf("  加载了 %d 条调用记录\n", len(callRecords))

	snippets, err := config.LoadSnippets(snippetsDir)
	if err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("加载 snippets 失败: %w", err)
		}
		fmt.Println("  警告: snippets 目录不存在或为空")
	}
	fmt.Printf("  加载了 %d 个代码片段\n", len(snippets))

	db, err := database.New()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer db.Close()

	a := analyzer.New(db)
	result, err := a.Analyze(interfaceCases, callRecords, snippets)
	if err != nil {
		return fmt.Errorf("分析失败: %w", err)
	}

	fmt.Println("\n分析完成！")
	fmt.Println("====================")
	fmt.Printf("会话 ID: %d\n", result.SessionID)
	fmt.Printf("总案例数: %d\n", result.TotalCases)
	fmt.Printf("发现问题数: %d\n", result.IssuesFound)

	fmt.Println("\n按分类统计:")
	for cat, count := range result.Categories {
		fmt.Printf("  - %s: %d 个\n", cat, count)
	}

	if len(result.Severity) > 0 {
		fmt.Println("\n按严重程度统计:")
		for sev, count := range result.Severity {
			fmt.Printf("  - %s: %d 个\n", sev, count)
		}
	}

	fmt.Println("\n提示:")
	fmt.Printf("  使用 'go-iface-analyzer replay %d' 查看详细分析结果\n", result.SessionID)
	fmt.Printf("  使用 'go-iface-analyzer export --session %d -o report.md' 导出 Markdown 报告\n", result.SessionID)
	fmt.Printf("  使用 'go-iface-analyzer export --session %d -o report.json --format json' 导出 JSON 报告\n", result.SessionID)

	return nil
}

func checkRequiredFiles() bool {
	required := []string{interfaceCasesFile}
	for _, f := range required {
		if _, err := os.Stat(f); os.IsNotExist(err) {
			return false
		}
	}
	return true
}

func getDefaultConfigPath(filename string) string {
	return filepath.Join(defaultConfigDir, filename)
}
