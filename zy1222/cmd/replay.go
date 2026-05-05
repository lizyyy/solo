package cmd

import (
	"fmt"
	"mapdebug/pkg/replay"
	"mapdebug/pkg/storage"
	"mapdebug/pkg/types"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

var replayCmd = &cobra.Command{
	Use:   "replay",
	Short: "重放操作序列并保存复盘结果",
	Long: `replay 命令读取 ops.jsonl 中的操作序列，模拟 Go map 执行，
并将每一步的状态、桶分布、风险检测保存到 SQLite 数据库。

示例:
  mapdebug replay --ops ops.jsonl
  mapdebug replay -s 42 --verbose
  mapdebug replay --stop-at-expand`,
	RunE: runReplay,
}

func init() {
	rootCmd.AddCommand(replayCmd)
	replayCmd.Flags().String("ops", "ops.jsonl", "操作序列文件路径")
	replayCmd.Flags().BoolP("verbose", "v", false, "显示详细输出")
	replayCmd.Flags().Bool("stop-at-expand", false, "在扩容时停止")
	replayCmd.Flags().Int("max-steps", 0, "最大执行步数 (0 表示不限制)")
	replayCmd.Flags().String("name", "", "会话名称")
}

func runReplay(cmd *cobra.Command, args []string) error {
	workdir, _ := cmd.Flags().GetString("workdir")
	dbPath, _ := cmd.Flags().GetString("db")
	seed, _ := cmd.Flags().GetInt64("seed")
	opsFile, _ := cmd.Flags().GetString("ops")
	verbose, _ := cmd.Flags().GetBool("verbose")
	stopAtExpand, _ := cmd.Flags().GetBool("stop-at-expand")
	maxSteps, _ := cmd.Flags().GetInt("max-steps")
	name, _ := cmd.Flags().GetString("name")

	if err := checkWorkDir(workdir); err != nil {
		return err
	}

	opsPath := opsFile
	if !filepath.IsAbs(opsPath) {
		opsPath = filepath.Join(workdir, opsPath)
	}

	if _, err := os.Stat(opsPath); os.IsNotExist(err) {
		return fmt.Errorf("操作文件不存在: %s", opsPath)
	}

	if seed == 0 {
		seed = time.Now().UnixNano()
	}

	fmt.Printf("=== 开始复盘 ===\n")
	fmt.Printf("种子: %d\n", seed)
	fmt.Printf("操作文件: %s\n", opsPath)
	fmt.Printf("数据库: %s\n", dbPath)

	replayer := replay.NewReplayer(seed, 0)
	ops, err := replayer.LoadOperations(opsPath)
	if err != nil {
		return fmt.Errorf("加载操作失败: %w", err)
	}
	fmt.Printf("加载操作数: %d\n", len(ops))

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer store.Close()

	sessionID := uuid.New().String()
	if name == "" {
		name = fmt.Sprintf("replay_%s", sessionID[:8])
	}

	session := &types.Session{
		ID:        sessionID,
		Name:      name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Seed:      seed,
		OpCount:   len(ops),
	}

	if err := store.CreateSession(session); err != nil {
		return fmt.Errorf("创建会话失败: %w", err)
	}
	fmt.Printf("会话 ID: %s\n", sessionID)

	stepCount := 0
	var lastExpandPhase string

	for i, op := range ops {
		if maxSteps > 0 && i >= maxSteps {
			fmt.Printf("\n已达到最大步数限制 (%d)\n", maxSteps)
			break
		}

		result := replayer.ExecuteOperation(op)
		stepCount = i + 1

		if err := store.SaveStep(sessionID, &result); err != nil {
			return fmt.Errorf("保存步骤 %d 失败: %w", i, err)
		}

		if verbose {
			printStepResult(&result)
		}

		if stopAtExpand && result.ExpandPhase != "none" && result.ExpandPhase != lastExpandPhase {
			fmt.Printf("\n扩容事件触发 (步骤 %d): %s\n", i, result.ExpandPhase)
			printStepSummary(&result)
			lastExpandPhase = result.ExpandPhase

			if result.ExpandPhase == "started" {
				fmt.Print("继续执行直到扩容完成? (y/n): ")
				var response string
				fmt.Scanln(&response)
				if response != "y" && response != "Y" {
					break
				}
			}
		}
	}

	if err := store.UpdateSession(sessionID, stepCount); err != nil {
		return fmt.Errorf("更新会话失败: %w", err)
	}

	stats := replayer.GetPerformanceStats()
	finalSnapshot := replayer.GetFinalSnapshot()
	risks := replayer.GetRiskSummary()

	fmt.Printf("\n=== 复盘完成 ===\n")
	fmt.Printf("执行步骤: %d\n", stepCount)
	fmt.Printf("最终状态: %s\n", finalSnapshot.String())
	fmt.Printf("性能统计: %s\n", stats.String())
	
	if len(risks) > 0 {
		fmt.Printf("\n风险摘要:\n")
		for cat, count := range risks {
			fmt.Printf("  %s: %d 次\n", cat, count)
		}
	}

	fmt.Printf("\n会话已保存: %s\n", sessionID)
	fmt.Println("运行 'mapdebug analyze' 查看详细分析")

	return nil
}

func printStepResult(result *types.StepResult) {
	fmt.Printf("\n--- 步骤 %d: %s ---\n", result.StepIndex, result.Op.Type)
	fmt.Printf("  操作: %s", result.Op.Type)
	if result.Op.Key != "" {
		fmt.Printf(" key=%s", result.Op.Key)
	}
	if result.Op.Value != "" {
		fmt.Printf(" value=%s", result.Op.Value)
	}
	fmt.Println()
	
	fmt.Printf("  状态: count=%d, B=%d, load=%.2f, overflow=%d\n",
		result.MapState.Count, result.MapState.B,
		result.MapState.LoadFactor, result.MapState.OverflowCount)
	
	fmt.Printf("  查找成本: score=%.2f, overflow_walk=%d\n",
		result.LookupCost.CostScore, result.LookupCost.OverflowWalk)

	if result.ExpandTriggered {
		fmt.Printf("  🚀 扩容触发!\n")
	}
	if result.ExpandPhase != "none" {
		fmt.Printf("  扩容阶段: %s (进度: %.1f%%)\n",
			result.ExpandPhase, result.MapState.EvacProgress*100)
	}

	if len(result.RiskAlerts) > 0 {
		fmt.Printf("  风险:\n")
		for _, risk := range result.RiskAlerts {
			fmt.Printf("    [%s] %s: %s\n", risk.Level, risk.Category, risk.Message)
		}
	}
}

func printStepSummary(result *types.StepResult) {
	fmt.Printf("  桶分布: total=%d, used=%d, overflow_chains=%d\n",
		result.BucketDist.TotalBuckets,
		result.BucketDist.UsedBuckets,
		result.BucketDist.OverflowBuckets)
	
	for count, bucketNum := range result.BucketDist.BucketsByCount {
		if bucketNum > 0 {
			fmt.Printf("    %d 个元素的桶: %d 个\n", count, bucketNum)
		}
	}
}
