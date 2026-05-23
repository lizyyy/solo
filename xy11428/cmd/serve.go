package cmd

import (
	"fmt"
	"visitor-pass/internal/api"
	"visitor-pass/internal/config"
	"visitor-pass/internal/repository"

	"github.com/spf13/cobra"
)

var port string

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "启动API服务",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := config.Init(); err != nil {
			return fmt.Errorf("初始化配置失败: %v", err)
		}

		if err := repository.Migrate(); err != nil {
			return fmt.Errorf("数据库迁移失败: %v", err)
		}

		if port != "" {
			config.AppConfig.ServerPort = port
		}

		r := api.SetupRouter()
		fmt.Printf("API服务启动在端口 %s...\n", config.AppConfig.ServerPort)
		fmt.Printf("登录API: POST http://localhost:%s/api/auth/login\n", config.AppConfig.ServerPort)
		return r.Run(":" + config.AppConfig.ServerPort)
	},
}

func init() {
	serveCmd.Flags().StringVarP(&port, "port", "p", "", "服务端口 (默认: 8080)")
	rootCmd.AddCommand(serveCmd)
}
