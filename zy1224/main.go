package main

import (
	"fmt"
	"os"

	"github.com/alecthomas/kong"
	"deferpanic/cmd"
)

var CLI struct {
	Init    cmd.InitCmd    `cmd:"" help:"初始化工作目录，创建必要的文件结构。"`
	Replay  cmd.ReplayCmd  `cmd:"" help:"重放分析用例，模拟执行链。"`
	Compare cmd.CompareCmd `cmd:"" help:"比较两个执行记录的差异。"`
	Export  cmd.ExportCmd  `cmd:"" help:"导出分析报告为 Markdown 或 JSON。"`
}

func main() {
	ctx := kong.Parse(&CLI,
		kong.Name("deferpanic"),
		kong.Description("Go defer/panic/recover 执行链分析工具，帮助新人理解复杂的执行流程。"),
		kong.UsageOnError(),
	)

	err := ctx.Run(&cmd.Context{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}
}
