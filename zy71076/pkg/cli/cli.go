package cli

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"tfvars-trace/pkg/types"
)

type CLI struct {
	Config *types.OutputConfig
	TargetDir string
	ShowHelp  bool
	ShowVersion bool
}

const Version = "1.0.0"

func New() *CLI {
	return &CLI{
		Config: &types.OutputConfig{
			FormatConsole: true,
			MaskSensitive: true,
		},
	}
}

func (c *CLI) ParseArgs() int {
	flag.StringVar(&c.Config.OutputDir, "output-dir", "", "输出目录（默认：当前目录）")
	flag.StringVar(&c.Config.OutputDir, "o", "", "输出目录（简写）")
	flag.BoolVar(&c.Config.FormatJSON, "json", true, "生成 JSON 报告")
	flag.BoolVar(&c.Config.FormatMarkdown, "markdown", true, "生成 Markdown 报告")
	flag.BoolVar(&c.Config.FormatMarkdown, "md", true, "生成 Markdown 报告（简写）")
	flag.BoolVar(&c.Config.FormatConsole, "console", true, "在控制台显示摘要")
	flag.BoolVar(&c.Config.MaskSensitive, "mask-sensitive", true, "遮蔽敏感变量值")
	flag.BoolVar(&c.Config.MaskSensitive, "m", true, "遮蔽敏感变量值（简写）")
	flag.BoolVar(&c.Config.Verbose, "verbose", false, "显示详细信息")
	flag.BoolVar(&c.Config.Verbose, "v", false, "显示详细信息（简写）")
	flag.BoolVar(&c.ShowHelp, "help", false, "显示帮助信息")
	flag.BoolVar(&c.ShowHelp, "h", false, "显示帮助信息（简写）")
	flag.BoolVar(&c.ShowVersion, "version", false, "显示版本信息")

	flag.Usage = c.printUsage

	flag.Parse()

	args := flag.Args()
	if len(args) > 0 {
		c.TargetDir = args[0]
	} else {
		c.TargetDir = "."
	}

	if c.ShowHelp {
		c.printUsage()
		return types.ExitSuccess
	}

	if c.ShowVersion {
		fmt.Printf("tfvars-trace v%s\n", Version)
		return types.ExitSuccess
	}

	if exitCode := c.validateInputs(); exitCode != types.ExitSuccess {
		return exitCode
	}

	return types.ExitSuccess
}

func (c *CLI) validateInputs() int {
	absPath, err := filepath.Abs(c.TargetDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ 错误：无效的目录路径 '%s': %v\n", c.TargetDir, err)
		return types.ExitValidationError
	}
	c.TargetDir = absPath

	fileInfo, err := os.Stat(c.TargetDir)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "❌ 错误：目录不存在 '%s'\n", c.TargetDir)
		} else {
			fmt.Fprintf(os.Stderr, "❌ 错误：无法访问目录 '%s': %v\n", c.TargetDir, err)
		}
		return types.ExitValidationError
	}

	if !fileInfo.IsDir() {
		fmt.Fprintf(os.Stderr, "❌ 错误：'%s' 不是一个目录\n", c.TargetDir)
		return types.ExitValidationError
	}

	if c.Config.OutputDir != "" {
		outputAbs, err := filepath.Abs(c.Config.OutputDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ 错误：无效的输出目录 '%s': %v\n", c.Config.OutputDir, err)
			return types.ExitValidationError
		}
		c.Config.OutputDir = outputAbs
	} else {
		c.Config.OutputDir = c.TargetDir
	}

	if !c.Config.FormatJSON && !c.Config.FormatMarkdown && !c.Config.FormatConsole {
		fmt.Fprintf(os.Stderr, "⚠️  警告：所有输出格式都已禁用，将只使用控制台输出\n")
		c.Config.FormatConsole = true
	}

	return types.ExitSuccess
}

func (c *CLI) printUsage() {
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║                    tfvars-trace v" + Version + "                           ║")
	fmt.Println("║        Terraform 变量溯源工具 - 追踪变量值的最终来源          ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Println()
	fmt.Println("使用方法:")
	fmt.Println("  tfvars-trace [选项] [目标目录]")
	fmt.Println()
	fmt.Println("目标目录:")
	fmt.Println("  包含 Terraform 配置文件的目录（默认：当前目录）")
	fmt.Println()
	fmt.Println("选项:")
	fmt.Println("  -o, --output-dir <目录>    指定输出报告的目录（默认：目标目录）")
	fmt.Println("      --json                 生成 JSON 格式报告（默认：启用）")
	fmt.Println("      --md, --markdown       生成 Markdown 格式报告（默认：启用）")
	fmt.Println("      --console              在控制台显示摘要（默认：启用）")
	fmt.Println("  -m, --mask-sensitive       遮蔽敏感变量的值（默认：启用）")
	fmt.Println("  -v, --verbose              显示详细输出信息")
	fmt.Println("  -h, --help                 显示此帮助信息")
	fmt.Println("      --version              显示版本信息")
	fmt.Println()
	fmt.Println("退出码:")
	fmt.Println("   0 - 成功")
	fmt.Println("   1 - 输入验证错误")
	fmt.Println("   2 - 解析错误")
	fmt.Println("   3 - 检测到冲突或警告")
	fmt.Println("  10 - 内部错误")
	fmt.Println()
	fmt.Println("示例:")
	fmt.Println("  tfvars-trace ./terraform")
	fmt.Println("  tfvars-trace -o ./reports ./terraform")
	fmt.Println("  tfvars-trace -m=false ./terraform")
	fmt.Println()
	fmt.Println("优先级说明:")
	fmt.Println("  环境变量(15) > tfvars文件(10) > 模块输入(5) > 默认值(0)")
	fmt.Println()
}

func (c *CLI) PrintBanner() {
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║                    tfvars-trace v" + Version + "                           ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Println()
	fmt.Printf("📍 分析目录: %s\n", c.TargetDir)
	fmt.Printf("📂 输出目录: %s\n", c.Config.OutputDir)
	if c.Config.MaskSensitive {
		fmt.Println("🔒 敏感变量遮蔽: 启用")
	} else {
		fmt.Println("⚠️  敏感变量遮蔽: 禁用")
	}
	fmt.Println()
}

func DetermineExitCode(result *types.AnalysisResult, err error) int {
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "parse") || strings.Contains(errMsg, "syntax") {
			return types.ExitParseError
		}
		if strings.Contains(errMsg, "validation") || strings.Contains(errMsg, "invalid") {
			return types.ExitValidationError
		}
		return types.ExitInternalError
	}

	if result != nil && len(result.Conflicts) > 0 {
		warningCount := 0
		for _, c := range result.Conflicts {
			if c.Severity == "warning" {
				warningCount++
			}
		}
		if warningCount > 0 {
			return types.ExitConflict
		}
	}

	return types.ExitSuccess
}
