package cmd

import (
	"fmt"
	"os"

	"proto-enum-lint/internal/parser"
	"proto-enum-lint/internal/snapshot"
	"proto-enum-lint/pkg/types"

	"github.com/spf13/cobra"
)

var (
	snapshotProtoFiles []string
	snapshotProtoDir   string
	snapshotOutputDir  string
	snapshotService    string
	snapshotVersion    string
)

var snapshotCmd = &cobra.Command{
	Use:   "snapshot",
	Short: "管理 proto 枚举快照",
	Long: `创建和管理 proto 枚举快照，用于后续兼容性对比。
快照保存了所有枚举的当前状态，包括名称、编号、reserved 声明等。`,
}

var snapshotCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "创建新的快照",
	Run:   runSnapshotCreate,
}

var snapshotListCmd = &cobra.Command{
	Use:   "list",
	Short: "列出所有快照",
	Run:   runSnapshotList,
}

func init() {
	rootCmd.AddCommand(snapshotCmd)
	snapshotCmd.AddCommand(snapshotCreateCmd)
	snapshotCmd.AddCommand(snapshotListCmd)

	snapshotCreateCmd.Flags().StringSliceVarP(&snapshotProtoFiles, "files", "f", []string{}, "proto 文件列表（逗号分隔）")
	snapshotCreateCmd.Flags().StringVarP(&snapshotProtoDir, "dir", "d", "", "包含 proto 文件的目录")
	snapshotCreateCmd.Flags().StringVarP(&snapshotOutputDir, "output", "o", "./snapshots", "快照输出目录")
	snapshotCreateCmd.Flags().StringVarP(&snapshotService, "service", "n", "default", "服务名称")
	snapshotCreateCmd.Flags().StringVarP(&snapshotVersion, "version", "v", "", "快照版本标识")

	snapshotListCmd.Flags().StringVarP(&snapshotOutputDir, "output", "o", "./snapshots", "快照目录")
	snapshotListCmd.Flags().StringVarP(&snapshotService, "service", "n", "default", "服务名称")
}

func runSnapshotCreate(cmd *cobra.Command, args []string) {
	files, err := collectSnapshotProtoFiles()
	if err != nil {
		exitWithError(fmt.Sprintf("收集 proto 文件失败: %v", err), types.ExitCodeIOError)
	}

	if len(files) == 0 {
		exitWithError("未找到任何 proto 文件", types.ExitCodeValidationError)
	}

	p := parser.NewParser(files)
	protoFiles, err := p.Parse()
	if err != nil {
		exitWithError(fmt.Sprintf("解析 proto 文件失败: %v", err), types.ExitCodeParseError)
	}

	sm := snapshot.NewManager(snapshotOutputDir, snapshotService)
	savedPath, err := sm.Save(protoFiles, snapshotVersion)
	if err != nil {
		exitWithError(fmt.Sprintf("保存快照失败: %v", err), types.ExitCodeIOError)
	}

	fmt.Printf("✅ 快照已创建: %s\n", savedPath)
	fmt.Printf("   服务: %s\n", snapshotService)
	fmt.Printf("   文件数: %d\n", len(files))
	enumCount := 0
	for _, pf := range protoFiles {
		enumCount += len(pf.Enums)
	}
	fmt.Printf("   枚举数: %d\n", enumCount)
}

func runSnapshotList(cmd *cobra.Command, args []string) {
	sm := snapshot.NewManager(snapshotOutputDir, snapshotService)
	files, err := sm.List()
	if err != nil {
		exitWithError(fmt.Sprintf("列出快照失败: %v", err), types.ExitCodeIOError)
	}

	if len(files) == 0 {
		fmt.Println("未找到任何快照")
		return
	}

	fmt.Printf("找到 %d 个快照 (服务: %s):\n", len(files), snapshotService)
	for i, f := range files {
		info, err := os.Stat(f)
		if err != nil {
			continue
		}
		fmt.Printf("%d. %s (修改时间: %s)\n", i+1, f, info.ModTime().Format("2006-01-02 15:04:05"))
	}
}

func collectSnapshotProtoFiles() ([]string, error) {
	oldFiles, oldDir := checkProtoFiles, checkProtoDir
	checkProtoFiles, checkProtoDir = snapshotProtoFiles, snapshotProtoDir
	defer func() {
		checkProtoFiles, checkProtoDir = oldFiles, oldDir
	}()
	return collectProtoFiles()
}
