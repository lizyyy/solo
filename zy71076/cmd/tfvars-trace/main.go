package main

import (
	"fmt"
	"os"

	"tfvars-trace/pkg/cli"
	"tfvars-trace/pkg/reporter"
	"tfvars-trace/pkg/tracer"
	"tfvars-trace/pkg/types"
)

func main() {
	c := cli.New()
	exitCode := c.ParseArgs()

	if exitCode != types.ExitSuccess || c.ShowHelp || c.ShowVersion {
		os.Exit(exitCode)
	}

	c.PrintBanner()

	t := tracer.NewTracer()
	result, err := t.AnalyzeDirectory(c.TargetDir)

	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ 分析失败: %v\n", err)
		exitCode = cli.DetermineExitCode(nil, err)
		os.Exit(exitCode)
	}

	r := reporter.NewReporter(*c.Config)
	if err := r.Generate(result); err != nil {
		fmt.Fprintf(os.Stderr, "❌ 生成报告失败: %v\n", err)
		os.Exit(types.ExitInternalError)
	}

	exitCode = cli.DetermineExitCode(result, nil)

	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	if exitCode == types.ExitSuccess {
		fmt.Println("║                    ✅ 分析完成，无警告                        ║")
	} else if exitCode == types.ExitConflict {
		fmt.Println("║                    ⚠️  分析完成，检测到警告                    ║")
	} else {
		fmt.Println("║                    ❌ 分析完成，存在错误                       ║")
	}
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Printf("退出码: %d\n", exitCode)
	fmt.Println()

	os.Exit(exitCode)
}
