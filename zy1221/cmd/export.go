package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/zy1221/slice-teacher/internal/engine"
	"github.com/zy1221/slice-teacher/internal/model"
	"github.com/zy1221/slice-teacher/internal/parser"
	"github.com/zy1221/slice-teacher/internal/report"
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出分析报告",
	Long: `导出 slice 操作的分析报告，支持 Markdown 和 JSON 格式。
可以导出单个 case 或所有 case 的报告。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return exportReport()
	},
}

var (
	exportCaseFile   string
	exportOpsFile    string
	exportSnippetsDir string
	exportCaseID     string
	exportOutputDir  string
	exportFormat     string
	exportPretty     bool
)

func init() {
	rootCmd.AddCommand(exportCmd)

	exportCmd.Flags().StringVarP(&exportCaseFile, "cases", "c", "slice-cases.yaml", "YAML 配置文件路径")
	exportCmd.Flags().StringVarP(&exportOpsFile, "ops", "o", "", "JSONL 操作文件路径")
	exportCmd.Flags().StringVarP(&exportSnippetsDir, "snippets", "s", "", "Go 代码片段目录")
	exportCmd.Flags().StringVarP(&exportCaseID, "case-id", "i", "", "要导出的 case ID（可选）")
	exportCmd.Flags().StringVarP(&exportOutputDir, "output", "O", "reports", "输出目录")
	exportCmd.Flags().StringVarP(&exportFormat, "format", "f", "all", "导出格式: md, json, all")
	exportCmd.Flags().BoolVar(&exportPretty, "pretty", true, "JSON 格式化输出")
}

func exportReport() error {
	var allCases []*model.Case
	var opsFromFile []*model.Operation
	var opsFromSnippets []*model.Operation

	if exportCaseFile != "" {
		if _, err := os.Stat(exportCaseFile); err == nil {
			caseFileData, err := parser.ParseSliceCases(exportCaseFile)
			if err != nil {
				return err
			}
			allCases = caseFileData.Cases
		}
	}

	if exportOpsFile != "" {
		if _, err := os.Stat(exportOpsFile); err == nil {
			opsFromFile, err = parser.ParseOpsJSONL(exportOpsFile)
			if err != nil {
				return err
			}
		}
	}

	if exportSnippetsDir != "" {
		if _, err := os.Stat(exportSnippetsDir); err == nil {
			_, opsFromSnippets, err = parser.ParseGoSnippets(exportSnippetsDir)
			if err != nil {
				return err
			}
		}
	}

	if len(allCases) == 0 && (len(opsFromFile) > 0 || len(opsFromSnippets) > 0) {
		var allOps []*model.Operation
		allOps = append(allOps, opsFromFile...)
		allOps = append(allOps, opsFromSnippets...)

		allCases = append(allCases, &model.Case{
			ID:         "export_case",
			Name:       "导出的 Case",
			Operations: allOps,
		})
	}

	if len(allCases) == 0 {
		return fmt.Errorf("没有找到任何可导出的 case 或操作")
	}

	if err := os.MkdirAll(exportOutputDir, 0755); err != nil {
		return err
	}

	for _, c := range allCases {
		if exportCaseID != "" && c.ID != exportCaseID {
			continue
		}

		eng := engine.NewSliceEngine()
		if err := eng.Execute(c.Operations); err != nil {
			return err
		}

		steps := eng.GetSteps()
		r := report.BuildReport(c.ID, c.Name, steps)

		if exportFormat == "md" || exportFormat == "all" {
			mdPath := filepath.Join(exportOutputDir, fmt.Sprintf("%s_report.md", c.ID))
			if err := report.GenerateMarkdownReport(r, mdPath); err != nil {
				return err
			}
			fmt.Printf("✅ Markdown 报告已导出: %s\n", mdPath)
		}

		if exportFormat == "json" || exportFormat == "all" {
			jsonPath := filepath.Join(exportOutputDir, fmt.Sprintf("%s_report.json", c.ID))
			if err := report.GenerateJSONReport(r, jsonPath, exportPretty); err != nil {
				return err
			}
			fmt.Printf("✅ JSON 报告已导出: %s\n", jsonPath)
		}

		fmt.Printf("\n=== Case %s 导出完成 ===\n", c.ID)
		fmt.Printf("  总操作数: %d\n", r.Summary.TotalOperations)
		fmt.Printf("  扩容次数: %d\n", r.Summary.TotalGrows)
		fmt.Printf("  别名问题: %d 处\n", r.Summary.TotalAliases)
		if len(r.Summary.BigArrayHolders) > 0 {
			fmt.Printf("  ⚠️  大数组持有者: %v\n", r.Summary.BigArrayHolders)
		}
		fmt.Println()
	}

	return nil
}
