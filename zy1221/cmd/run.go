package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/zy1221/slice-teacher/internal/engine"
	"github.com/zy1221/slice-teacher/internal/errors"
	"github.com/zy1221/slice-teacher/internal/model"
	"github.com/zy1221/slice-teacher/internal/parser"
	"github.com/zy1221/slice-teacher/internal/report"
	"github.com/zy1221/slice-teacher/internal/storage"
)

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "运行 slice case 并分析",
	Long: `运行指定的 slice case，分析每一步的 len/cap、底层数组编号、
是否发生扩容、哪些切片还互相别名、哪里会因为 reslice 持有大数组。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runCase()
	},
}

var (
	caseFile   string
	opsFile    string
	snippetsDir string
	caseID     string
	outputDir  string
	exportJSON bool
	exportMD   bool
	noSQLite   bool
)

func init() {
	rootCmd.AddCommand(runCmd)

	runCmd.Flags().StringVarP(&caseFile, "cases", "c", "slice-cases.yaml", "YAML 配置文件路径")
	runCmd.Flags().StringVarP(&opsFile, "ops", "o", "", "JSONL 操作文件路径（可选）")
	runCmd.Flags().StringVarP(&snippetsDir, "snippets", "s", "snippets", "Go 代码片段目录（可选）")
	runCmd.Flags().StringVarP(&caseID, "case-id", "i", "", "要运行的 case ID（可选，不指定则运行所有）")
	runCmd.Flags().StringVarP(&outputDir, "output", "O", "reports", "输出目录")
	runCmd.Flags().BoolVar(&exportJSON, "json", true, "导出 JSON 报告")
	runCmd.Flags().BoolVar(&exportMD, "md", true, "导出 Markdown 报告")
	runCmd.Flags().BoolVar(&noSQLite, "no-sqlite", false, "不使用 SQLite 记录")
}

func runCase() error {
	var allCases []*model.Case
	var opsFromFile []*model.Operation
	var opsFromSnippets []*model.Operation

	if caseFile != "" {
		if _, err := os.Stat(caseFile); err == nil {
			caseFileData, err := parser.ParseSliceCases(caseFile)
			if err != nil {
				return err
			}
			allCases = caseFileData.Cases
		}
	}

	if opsFile != "" {
		if _, err := os.Stat(opsFile); err == nil {
			opsFromFile, err = parser.ParseOpsJSONL(opsFile)
			if err != nil {
				return err
			}
		}
	}

	if snippetsDir != "" {
		if _, err := os.Stat(snippetsDir); err == nil {
			_, opsFromSnippets, err = parser.ParseGoSnippets(snippetsDir)
			if err != nil {
				if stErr, ok := err.(*errors.SliceTeacherError); !ok || stErr.Type != errors.ErrTypeValidation {
					return err
				}
			}
		}
	}

	if len(allCases) == 0 && len(opsFromFile) == 0 && len(opsFromSnippets) == 0 {
		return errors.NewConfigError(
			"没有找到任何可运行的 case 或操作",
			caseFile,
			"请提供 slice-cases.yaml、ops.jsonl 或 snippets/*.go 文件",
		)
	}

	if len(allCases) == 0 && (len(opsFromFile) > 0 || len(opsFromSnippets) > 0) {
		var allOps []*model.Operation
		allOps = append(allOps, opsFromFile...)
		allOps = append(allOps, opsFromSnippets...)

		allCases = append(allCases, &model.Case{
			ID:         "dynamic_case",
			Name:       "动态生成的 Case",
			Operations: allOps,
		})
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return errors.NewIOError("无法创建输出目录", outputDir, err)
	}

	var store *storage.SQLiteStore
	if !noSQLite {
		dbPath := filepath.Join(outputDir, "traces.db")
		var err error
		store, err = storage.NewSQLiteStore(dbPath)
		if err != nil {
			return err
		}
		defer store.Close()
	}

	for _, c := range allCases {
		if caseID != "" && c.ID != caseID {
			continue
		}

		fmt.Printf("========================================\n")
		fmt.Printf("运行 Case: %s (%s)\n", c.Name, c.ID)
		fmt.Printf("========================================\n\n")

		eng := engine.NewSliceEngine()
		if err := eng.Execute(c.Operations); err != nil {
			return err
		}

		steps := eng.GetSteps()

		for _, step := range steps {
			fmt.Printf("--- 步骤 %d: %s ---\n", step.StepNumber, step.Operation.Type)
			if step.Operation.Description != "" {
				fmt.Printf("描述: %s\n", step.Operation.Description)
			}

			if step.DidGrow {
				fmt.Printf("⚠️  扩容发生! cap 从 %d 增长到 %d\n", step.GrowFrom, step.GrowTo)
			}

			fmt.Printf("切片状态:\n")
			for name, slice := range step.Slices {
				aliasMark := ""
				if slice.IsAliased {
					aliasMark = " ⚠️别名"
				}
				fmt.Printf("  %s: len=%d, cap=%d, 数组=%s[%d:%d]%s\n",
					name, slice.Len, slice.Cap, slice.ArrayID, slice.Start, slice.Start+slice.Cap, aliasMark)
			}

			if len(step.SliceAliases) > 0 {
				fmt.Printf("别名关系:\n")
				for name, aliases := range step.SliceAliases {
					fmt.Printf("  %s <-> %v\n", name, aliases)
				}
			}

			if len(step.Notes) > 0 {
				fmt.Printf("说明:\n")
				for _, note := range step.Notes {
					fmt.Printf("  - %s\n", note)
				}
			}

			fmt.Println()
		}

		r := report.BuildReport(c.ID, c.Name, steps)

		if store != nil {
			if err := store.SaveAllSteps(c.ID, steps); err != nil {
				fmt.Printf("警告: 无法保存到 SQLite: %v\n", err)
			}
		}

		if exportMD {
			mdPath := filepath.Join(outputDir, fmt.Sprintf("%s_report.md", c.ID))
			if err := report.GenerateMarkdownReport(r, mdPath); err != nil {
				return err
			}
			fmt.Printf("✅ Markdown 报告已导出: %s\n", mdPath)
		}

		if exportJSON {
			jsonPath := filepath.Join(outputDir, fmt.Sprintf("%s_report.json", c.ID))
			if err := report.GenerateJSONReport(r, jsonPath, true); err != nil {
				return err
			}
			fmt.Printf("✅ JSON 报告已导出: %s\n", jsonPath)
		}

		fmt.Printf("\n=== Case %s 执行完成 ===\n", c.ID)
		fmt.Printf("总操作数: %d\n", r.Summary.TotalOperations)
		fmt.Printf("扩容次数: %d\n", r.Summary.TotalGrows)
		fmt.Printf("别名问题: %d 处\n", r.Summary.TotalAliases)
		if len(r.Summary.BigArrayHolders) > 0 {
			fmt.Printf("⚠️  大数组持有者: %v\n", r.Summary.BigArrayHolders)
		}
		if r.Summary.Recommendation != "" {
			fmt.Printf("建议: %s\n", r.Summary.Recommendation)
		}
		fmt.Println()
	}

	return nil
}
