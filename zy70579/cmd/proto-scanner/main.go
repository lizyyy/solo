package main

import (
	"flag"
	"fmt"
	"os"

	"proto-scanner/pkg/parser"
	"proto-scanner/pkg/reporter"
)

var (
	version = "1.0.0"
)

func main() {
	var (
		pathFlag     = flag.String("path", ".", "Proto文件或目录路径")
		outputFlag   = flag.String("output", "", "报告输出目录")
		verboseFlag  = flag.Bool("verbose", false, "详细输出模式")
		versionFlag  = flag.Bool("version", false, "显示版本信息")
	)

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Proto 默认值风险扫描工具 v%s\n\n", version)
		fmt.Fprintf(os.Stderr, "用于检测 Proto3 隐式默认值可能导致的语义歧义问题\n\n")
		fmt.Fprintf(os.Stderr, "用法:\n")
		fmt.Fprintf(os.Stderr, "  proto-scanner [选项]\n\n")
		fmt.Fprintf(os.Stderr, "选项:\n")
		flag.PrintDefaults()
		fmt.Fprintf(os.Stderr, "\n示例:\n")
		fmt.Fprintf(os.Stderr, "  proto-scanner --path ./proto                  # 扫描当前目录下的proto文件\n")
		fmt.Fprintf(os.Stderr, "  proto-scanner --path ./api --output ./reports  # 扫描api目录，输出到reports\n")
	}

	flag.Parse()

	if *versionFlag {
		fmt.Printf("proto-scanner v%s\n", version)
		os.Exit(0)
	}

	if *verboseFlag {
		fmt.Printf("Proto 默认值风险扫描工具 v%s\n", version)
		fmt.Printf("扫描路径: %s\n", *pathFlag)
	}

	p := parser.NewParser(*verboseFlag)
	protoFiles, err := p.ParsePath(*pathFlag)
	if err != nil {
		fmt.Fprintf(os.Stderr, "解析失败: %v\n", err)
		os.Exit(1)
	}

	if len(protoFiles) == 0 {
		fmt.Println("警告: 未找到任何 .proto 文件")
		os.Exit(0)
	}

	r := reporter.NewReporter(protoFiles, *outputFlag)
	if err := r.GenerateAll(); err != nil {
		fmt.Fprintf(os.Stderr, "生成报告失败: %v\n", err)
		os.Exit(1)
	}
}
