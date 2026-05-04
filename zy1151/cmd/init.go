package cmd

import (
	"fmt"
	"memreplay/internal/models"
	"memreplay/internal/storage"

	"github.com/spf13/cobra"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "初始化一个新的分析项目",
	Long: `初始化一个新的内存问题分析项目，创建一个批次用于组织相关的数据文件。

示例:
  memreplay init --name "my-service-v1.0.0" --service "user-service"
  memreplay init --name "memory-leak-investigation" --description "调查 2024-01-15 的内存泄漏问题"`,
	Run: func(cmd *cobra.Command, args []string) {
		name, _ := cmd.Flags().GetString("name")
		service, _ := cmd.Flags().GetString("service")
		description, _ := cmd.Flags().GetString("description")

		if name == "" {
			errorExit("必须指定 --name 参数", nil)
			return
		}

		batch := &models.Batch{
			Name:        name,
			ServiceName: service,
			Description: description,
		}

		if err := storage.CreateBatch(batch); err != nil {
			errorExit("创建批次失败", err)
			return
		}

		fmt.Printf("✓ 已创建批次: %s\n", batch.Name)
		fmt.Printf("  ID: %s\n", batch.ID)
		if batch.ServiceName != "" {
			fmt.Printf("  服务: %s\n", batch.ServiceName)
		}
		if batch.Description != "" {
			fmt.Printf("  描述: %s\n", batch.Description)
		}
		fmt.Println()
		fmt.Println("下一步:")
		fmt.Printf("  memreplay ingest --batch %s --memstats ./memstats.csv\n", batch.Name)
	},
}

func init() {
	rootCmd.AddCommand(initCmd)

	initCmd.Flags().StringP("name", "n", "", "批次名称 (必填)")
	initCmd.Flags().StringP("service", "s", "", "关联的服务名称")
	initCmd.Flags().StringP("description", "d", "", "批次描述")
	_ = initCmd.MarkFlagRequired("name")
}
