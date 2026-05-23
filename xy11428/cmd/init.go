package cmd

import (
	"fmt"
	"visitor-pass/internal/config"
	"visitor-pass/internal/repository"

	"github.com/spf13/cobra"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "初始化数据库和默认用户",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := config.Init(); err != nil {
			return fmt.Errorf("初始化配置失败: %v", err)
		}

		if err := repository.Migrate(); err != nil {
			return fmt.Errorf("数据库迁移失败: %v", err)
		}

		tx, err := config.DB.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()

		if err := repository.InitDefaultUsers(tx); err != nil {
			return fmt.Errorf("初始化默认用户失败: %v", err)
		}

		if err := tx.Commit(); err != nil {
			return err
		}

		fmt.Println("数据库初始化完成!")
		fmt.Printf("数据库位置: %s\n", config.AppConfig.DBPath)
		fmt.Println("\n默认用户 (密码同用户名):")
		fmt.Println("  - supervisor (主管)")
		fmt.Println("  - reviewer (复核员)")
		fmt.Println("  - data_entry (录入员)")
		fmt.Println("  - readonly (只读)")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}
