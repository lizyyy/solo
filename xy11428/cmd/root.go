package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "visitor-pass",
	Short: "园区访客通行验收回放链路服务",
	Long: `园区访客通行验收回放链路服务 - 管理访客预约、闸机记录、临时车牌的导入、对账和导出。

角色权限:
  data_entry (录入员): 导入数据、查看数据
  reviewer (复核员): 复核数据、发起对账、查看审计日志
  supervisor (主管):  所有权限、用户管理、冻结数据
  read_only (只读):   仅查看数据

默认账号密码均为: supervisor / reviewer / data_entry / readonly`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
