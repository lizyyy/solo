package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"proto-enum-lint/internal/checker"
	"proto-enum-lint/internal/parser"
	"proto-enum-lint/internal/reporter"
	"proto-enum-lint/internal/snapshot"
	"proto-enum-lint/pkg/types"

	"github.com/spf13/cobra"
)

var (
	checkProtoFiles    []string
	checkProtoDir      string
	checkSnapshotFile  string
	checkOutputDir     string
	checkService       string
	checkUseLatestSnap bool
)

var checkCmd = &cobra.Command{
	Use:   "check",
	Short: "检查 proto 文件中的枚举兼容性问题",
	Long: `检查 proto 文件中的枚举兼容性问题，包括:
- 枚举编号重复
- reserved 声明违规
- 别名使用不当
- 与历史快照对比发现的破坏性变更`,
	Run: runCheck,
}

func init() {
	rootCmd.AddCommand(checkCmd)

	checkCmd.Flags().StringSliceVarP(&checkProtoFiles, "files", "f", []string{}, "要检查的 proto 文件列表（逗号分隔）")
	checkCmd.Flags().StringVarP(&checkProtoDir, "dir", "d", "", "包含 proto 文件的目录（递归扫描）")
	checkCmd.Flags().StringVarP(&checkSnapshotFile, "snapshot", "s", "", "历史快照文件路径（用于对比兼容性）")
	checkCmd.Flags().BoolVar(&checkUseLatestSnap, "use-latest", false, "使用最新的快照进行对比")
	checkCmd.Flags().StringVarP(&checkOutputDir, "output", "o", "./reports", "输出报告目录")
	checkCmd.Flags().StringVarP(&checkService, "service", "n", "default", "服务名称（用于标识报告）")
}

func runCheck(cmd *cobra.Command, args []string) {
	files, err := collectProtoFiles()
	if err != nil {
		exitWithError(fmt.Sprintf("收集 proto 文件失败: %v", err), types.ExitCodeIOError)
	}

	if len(files) == 0 {
		exitWithError("未找到任何 proto 文件，请通过 --files 或 --dir 指定", types.ExitCodeValidationError)
	}

	p := parser.NewParser(files)
	protoFiles, err := p.Parse()
	if err != nil {
		exitWithError(fmt.Sprintf("解析 proto 文件失败: %v", err), types.ExitCodeParseError)
	}

	c := checker.NewChecker(protoFiles)
	issues := c.Check()

	snapManager := snapshot.NewManager(checkOutputDir, checkService)

	var snapshotFile string
	var oldFiles []types.ProtoFile

	if checkSnapshotFile != "" {
		snap, err := snapManager.Load(checkSnapshotFile)
		if err != nil {
			exitWithError(fmt.Sprintf("加载快照失败: %v", err), types.ExitCodeSnapshotError)
		}
		oldFiles = snap.Files
		snapshotFile = checkSnapshotFile
	} else if checkUseLatestSnap {
		snap, file, err := snapManager.GetLatest()
		if err == nil {
			oldFiles = snap.Files
			snapshotFile = file
		}
	}

	if len(oldFiles) > 0 {
		issues = append(issues, checker.FindRemovedEnums(oldFiles, protoFiles)...)
		issues = append(issues, checker.FindRemovedEnumValues(oldFiles, protoFiles)...)
		issues = append(issues, checker.FindNumberReuse(oldFiles, protoFiles)...)
	}

	totalErrors := 0
	totalWarnings := 0
	for _, issue := range issues {
		if issue.Severity == types.SeverityError {
			totalErrors++
		} else if issue.Severity == types.SeverityWarning {
			totalWarnings++
		}
	}

	exitCode, exitCodeDesc := reporter.CalculateExitCode(issues)

	report := types.Report{
		Service:       checkService,
		GeneratedAt:   time.Now(),
		InputFiles:    files,
		SnapshotFile:  snapshotFile,
		Issues:        issues,
		TotalErrors:   totalErrors,
		TotalWarnings: totalWarnings,
		ExitCode:      exitCode,
		ExitCodeDesc:  exitCodeDesc,
	}

	r := reporter.NewReporter(checkOutputDir, checkService)
	if err := r.Generate(report); err != nil {
		exitWithError(fmt.Sprintf("生成报告失败: %v", err), types.ExitCodeIOError)
	}

	os.Exit(exitCode)
}

func collectProtoFiles() ([]string, error) {
	var files []string

	for _, f := range checkProtoFiles {
		f = strings.TrimSpace(f)
		if f == "" {
			continue
		}
		matches, err := filepath.Glob(f)
		if err != nil {
			return nil, err
		}
		files = append(files, matches...)
	}

	if checkProtoDir != "" {
		err := filepath.Walk(checkProtoDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() && strings.HasSuffix(strings.ToLower(path), ".proto") {
				files = append(files, path)
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	uniqueFiles := make(map[string]bool)
	var result []string
	for _, f := range files {
		if !uniqueFiles[f] {
			uniqueFiles[f] = true
			result = append(result, f)
		}
	}

	return result, nil
}
