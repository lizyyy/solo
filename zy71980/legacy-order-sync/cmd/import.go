package cmd

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"legacy-order-sync/db"

	"github.com/spf13/cobra"
)

type importItem struct {
	OrderNo               string `json:"order_no"`
	IdempotencyKey        string `json:"idempotency_key"`
	IdempotencyKeyValid   *bool  `json:"idempotency_key_valid"`
	ClientParams          string `json:"client_params"`
	ClientParamsCorrupted *bool  `json:"client_params_corrupted"`
	Source                string `json:"source"`
	RawData               string `json:"raw_data"`
	PendingReason         string `json:"pending_reason"`
}

var importFile string
var importOrderNo string
var importSource string
var importIdempotencyKey string
var importIdempotencyKeyInvalid bool
var importClientParams string
var importClientParamsCorrupted bool
var importPendingReason string

var importCmd = &cobra.Command{
	Use:   "import",
	Short: "导入订单数据",
	Long: `导入订单数据到旧版订单同步系统。

支持两种方式：
  1. 从 JSON 文件批量导入: los import -f orders.json
  2. 单条录入: los import --order-no ORD001 --source api_v1

导入时自动检测问题记录（幂等键失效、客户端参数被破坏）并标记为 pending。`,
	RunE: runImport,
}

func init() {
	rootCmd.AddCommand(importCmd)
	importCmd.Flags().StringVarP(&importFile, "file", "f", "", "批量导入的 JSON 文件路径")
	importCmd.Flags().StringVar(&importOrderNo, "order-no", "", "单条录入：订单编号")
	importCmd.Flags().StringVar(&importSource, "source", "api_v1", "来源标识 (api_v1, api_v2, file_import, manual)")
	importCmd.Flags().StringVar(&importIdempotencyKey, "idempotency-key", "", "幂等键")
	importCmd.Flags().BoolVar(&importIdempotencyKeyInvalid, "idempotency-key-invalid", false, "幂等键已失效")
	importCmd.Flags().StringVar(&importClientParams, "client-params", "{}", "客户端参数 (JSON)")
	importCmd.Flags().BoolVar(&importClientParamsCorrupted, "client-params-corrupted", false, "客户端参数被破坏")
	importCmd.Flags().StringVar(&importPendingReason, "pending-reason", "", "直接标记为待处理的原因")
}

func runImport(cmd *cobra.Command, args []string) error {
	database, err := db.EnsureDB()
	if err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	defer database.Close()

	if importFile != "" {
		return importFromFile(database)
	}
	return importSingle(database)
}

func importFromFile(database *sql.DB) error {
	f, err := os.Open(importFile)
	if err != nil {
		return fmt.Errorf("打开文件失败: %w", err)
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return fmt.Errorf("读取文件失败: %w", err)
	}

	var items []importItem
	if err := json.Unmarshal(data, &items); err != nil {
		return fmt.Errorf("解析 JSON 失败: %w", err)
	}

	imported := 0
	pending := 0
	for i, item := range items {
		if item.OrderNo == "" {
			fmt.Printf("  跳过第 %d 条: 缺少 order_no\n", i+1)
			continue
		}

		source := item.Source
		if source == "" {
			source = "file_import"
		}

		idempotencyKeyValid := true
		if item.IdempotencyKeyValid != nil {
			idempotencyKeyValid = *item.IdempotencyKeyValid
		}

		clientParamsCorrupted := false
		if item.ClientParamsCorrupted != nil {
			clientParamsCorrupted = *item.ClientParamsCorrupted
		}

		clientParams := item.ClientParams
		if clientParams == "" {
			clientParams = "{}"
		}

		rawData := item.RawData
		if rawData == "" {
			rawData = string(data)
		}

		status := db.StatusImported
		pendingReason := item.PendingReason

		if item.PendingReason != "" {
			status = db.StatusPending
		} else if !idempotencyKeyValid || clientParamsCorrupted {
			status = db.StatusPending
			reasons := []string{}
			if !idempotencyKeyValid {
				reasons = append(reasons, "幂等键失效")
			}
			if clientParamsCorrupted {
				reasons = append(reasons, "客户端参数被破坏")
			}
			pendingReason = joinReasons(reasons)
		}

		order := &db.Order{
			OrderNo:               item.OrderNo,
			IdempotencyKey:        item.IdempotencyKey,
			IdempotencyKeyValid:   idempotencyKeyValid,
			ClientParams:          clientParams,
			ClientParamsCorrupted: clientParamsCorrupted,
			Source:                source,
			Status:                status,
			PendingReason:         pendingReason,
			RawData:               rawData,
		}

		id, err := db.InsertOrder(database, order)
		if err != nil {
			fmt.Printf("  导入第 %d 条 (%s) 失败: %v\n", i+1, item.OrderNo, err)
			continue
		}

		history := &db.OrderHistory{
			OrderID:   id,
			Action:    "import",
			OldStatus: "",
			NewStatus: status,
			Operator:  "system",
			Reason:    pendingReason,
			Detail:    fmt.Sprintf(`{"source":"%s","file":"%s"}`, source, importFile),
		}
		if err := db.InsertHistory(database, history); err != nil {
			fmt.Printf("  写入第 %d 条历史失败: %v\n", i+1, err)
		}

		imported++
		if status == db.StatusPending {
			pending++
		}
	}

	fmt.Printf("导入完成: 共 %d 条, 正常 %d 条, 待处理 %d 条\n", imported, imported-pending, pending)
	return nil
}

func importSingle(database *sql.DB) error {
	if importOrderNo == "" {
		return fmt.Errorf("单条导入需要指定 --order-no")
	}

	idempotencyKeyValid := !importIdempotencyKeyInvalid
	status := db.StatusImported
	pendingReason := importPendingReason

	if importPendingReason != "" {
		status = db.StatusPending
	} else if !idempotencyKeyValid || importClientParamsCorrupted {
		status = db.StatusPending
		reasons := []string{}
		if !idempotencyKeyValid {
			reasons = append(reasons, "幂等键失效")
		}
		if importClientParamsCorrupted {
			reasons = append(reasons, "客户端参数被破坏")
		}
		pendingReason = joinReasons(reasons)
	}

	clientParams := importClientParams
	if clientParams == "" {
		clientParams = "{}"
	}

	order := &db.Order{
		OrderNo:               importOrderNo,
		IdempotencyKey:        importIdempotencyKey,
		IdempotencyKeyValid:   idempotencyKeyValid,
		ClientParams:          clientParams,
		ClientParamsCorrupted: importClientParamsCorrupted,
		Source:                importSource,
		Status:                status,
		PendingReason:         pendingReason,
		RawData:               fmt.Sprintf(`{"order_no":"%s","source":"%s"}`, importOrderNo, importSource),
	}

	id, err := db.InsertOrder(database, order)
	if err != nil {
		return fmt.Errorf("插入订单失败: %w", err)
	}

	history := &db.OrderHistory{
		OrderID:   id,
		Action:    "import",
		OldStatus: "",
		NewStatus: status,
		Operator:  "system",
		Reason:    pendingReason,
		Detail:    fmt.Sprintf(`{"source":"%s","mode":"single"}`, importSource),
	}
	if err := db.InsertHistory(database, history); err != nil {
		return fmt.Errorf("写入历史失败: %w", err)
	}

	fmt.Printf("导入成功: ID=%d, 订单号=%s, 状态=%s\n", id, importOrderNo, status)
	if status == db.StatusPending {
		fmt.Printf("  待处理原因: %s\n", pendingReason)
	}
	return nil
}

func joinReasons(reasons []string) string {
	result := ""
	for i, r := range reasons {
		if i > 0 {
			result += "; "
		}
		result += r
	}
	return result
}
