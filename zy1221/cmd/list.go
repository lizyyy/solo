package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/zy1221/slice-teacher/internal/parser"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "列出可用的测试用例",
	Long: `列出 slice-cases.yaml 中定义的所有测试用例，
显示每个 case 的 ID、名称、描述和类别。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return listCases()
	},
}

var (
	listCaseFile string
)

func init() {
	rootCmd.AddCommand(listCmd)

	listCmd.Flags().StringVarP(&listCaseFile, "cases", "c", "slice-cases.yaml", "YAML 配置文件路径")
}

func listCases() error {
	caseFile, err := parser.ParseSliceCases(listCaseFile)
	if err != nil {
		return err
	}

	fmt.Println("========================================")
	fmt.Printf("可用的测试用例 (%d 个):\n", len(caseFile.Cases))
	fmt.Println("========================================")
	fmt.Println()

	for i, c := range caseFile.Cases {
		fmt.Printf("=== Case %d ===\n", i+1)
		fmt.Printf("  ID:         %s\n", c.ID)
		fmt.Printf("  名称:       %s\n", c.Name)
		if c.Description != "" {
			fmt.Printf("  描述:       %s\n", c.Description)
		}
		if c.Category != "" {
			fmt.Printf("  类别:       %s\n", c.Category)
		}
		fmt.Printf("  操作数:     %d\n", len(c.Operations))
		fmt.Printf("  Seed:       %d\n", c.Seed)
		fmt.Println()

		if len(c.Operations) > 0 {
			fmt.Println("  操作序列:")
			for j, op := range c.Operations {
				desc := op.Description
				if desc == "" {
					desc = string(op.Type)
				}
				fmt.Printf("    %d. [%s] %s\n", j+1, op.Type, desc)
			}
			fmt.Println()
		}
	}

	fmt.Println("========================================")
	fmt.Println("运行单个 case:")
	fmt.Println("  slice-teacher run -i <case-id>")
	fmt.Println("========================================")

	return nil
}
