package cmd

import (
	"fmt"

	"capgate/internal/server"

	"github.com/spf13/cobra"
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "启动轻量本地 API 服务",
	Long: `启动一个本地 HTTP 服务，提供 REST API 来查看压测结果、对比分析和导出报告。

API 端点：
  GET  /                    主页
  GET  /api/health         健康检查
  GET  /api/results        结果列表
  GET  /api/results/{id}   结果详情
  GET  /api/comparisons    对比列表
  GET  /api/comparisons/{id} 对比详情
  GET  /api/export/{id}?format=md|json|csv 导出报告`,
	RunE: func(cmd *cobra.Command, args []string) error {
		resultsDir, _ := cmd.Flags().GetString("results")
		port, _ := cmd.Flags().GetInt("port")

		if resultsDir == "" {
			resultsDir = "./results"
		}
		if port == 0 {
			port = 8080
		}

		fmt.Printf("🌐 准备启动 API 服务...\n")
		fmt.Printf("   端口: %d\n", port)
		fmt.Printf("   结果目录: %s\n\n", resultsDir)

		srv := server.NewAPIServer(resultsDir, port)
		return srv.Start()
	},
}

func init() {
	serveCmd.Flags().StringP("results", "r", "", "结果文件目录 (默认: ./results)")
	serveCmd.Flags().IntP("port", "p", 8080, "服务端口 (默认: 8080)")
}
