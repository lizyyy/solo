package cmd

import (
	"context-health/pkg/model"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "初始化 context 体检项目，生成模板文件和示例数据",
	Long: `init 命令会在当前目录创建一个 context 体检项目的基础结构，
包括 context-plan.yaml 模板、calls.jsonl 示例数据和 snippets 目录下的示例 Go 代码。`,
	RunE: runInit,
}

func init() {
	rootCmd.AddCommand(initCmd)
	initCmd.Flags().BoolP("force", "f", false, "覆盖已存在的文件")
	initCmd.Flags().StringP("template", "t", "default", "使用的模板类型: default, bad")
}

func runInit(cmd *cobra.Command, args []string) error {
	force, _ := cmd.Flags().GetBool("force")
	template, _ := cmd.Flags().GetString("template")

	fmt.Println("正在初始化 context 体检项目...")

	if template == "bad" {
		fmt.Println("使用坏配置模板（用于测试检测能力）")
	}

	if err := createContextPlan(force, template); err != nil {
		return err
	}

	if err := createCallsJSONL(force, template); err != nil {
		return err
	}

	if err := createSnippets(force, template); err != nil {
		return err
	}

	if err := createBadConfigExamples(force); err != nil {
		return err
	}

	fmt.Println("\n初始化完成！项目结构：")
	fmt.Println("  - context-plan.yaml")
	fmt.Println("  - calls.jsonl")
	fmt.Println("  - snippets/")
	fmt.Println("  - bad-configs/")
	fmt.Println("\n下一步：")
	fmt.Println("  1. 编辑 context-plan.yaml 定义您的 API 调用链")
	fmt.Println("  2. 生成或收集 calls.jsonl 数据")
	fmt.Println("  3. 运行 'context-health analyze' 进行体检")

	return nil
}

func createContextPlan(force bool, template string) error {
	filename := "context-plan.yaml"

	if !force && fileExists(filename) {
		return fmt.Errorf("文件 %s 已存在，使用 -f 覆盖", filename)
	}

	var plan *model.ContextPlan
	if template == "bad" {
		plan = createBadContextPlan()
	} else {
		plan = createDefaultContextPlan()
	}

	data, err := yaml.Marshal(plan)
	if err != nil {
		return err
	}

	header := `# Context 调用链规划文件
# 用于定义 API 接口的期望调用链、超时预算和验证规则
#
# 字段说明：
#   api_name: API 名称
#   description: 接口描述
#   entry_point: 入口点（允许使用 context.Background 的位置）
#   total_timeout: 整个调用链的总超时预算
#   call_chain: 调用链步骤定义
#     - from: 调用方
#     - to: 被调用方
#     - timeout: 该调用的超时时间
#     - requires_cancel: 是否要求传播取消信号
#     - is_goroutine: 是否在 goroutine 中执行
#   budgets: 各服务的超时预算（可选）
#   allowed_withvalue_keys: 允许使用的 WithValue 键前缀
`

	content := append([]byte(header), data...)

	if err := os.WriteFile(filename, content, 0644); err != nil {
		return err
	}

	fmt.Printf("  ✓ 创建 %s\n", filename)
	return nil
}

func createDefaultContextPlan() *model.ContextPlan {
	return &model.ContextPlan{
		APIName:     "create_order",
		Description: "创建订单接口",
		EntryPoint:  "OrderHandler",
		TotalTimeout: 30 * 1000000000, // 30s
		CallChain: []model.CallStep{
			{
				From:           "OrderHandler",
				To:             "OrderService",
				Timeout:        500 * 1000000, // 500ms
				RequiresCancel: true,
				IsGoroutine:    false,
			},
			{
				From:           "OrderService",
				To:             "UserService",
				Timeout:        1000 * 1000000, // 1s
				RequiresCancel: true,
				IsGoroutine:    false,
			},
			{
				From:           "OrderService",
				To:             "ProductService",
				Timeout:        2000 * 1000000, // 2s
				RequiresCancel: true,
				IsGoroutine:    false,
			},
			{
				From:           "OrderService",
				To:             "PaymentService",
				Timeout:        5000 * 1000000, // 5s
				RequiresCancel: true,
				IsGoroutine:    true,
			},
			{
				From:           "OrderService",
				To:             "NotificationService",
				Timeout:        3000 * 1000000, // 3s
				RequiresCancel: false,
				IsGoroutine:    true,
			},
		},
		Budgets: map[string]model.Budget{
			"UserService": {
				Service:    "UserService",
				Allocation: 1 * 1000000000, // 1s
				Percentage: 3.3,
			},
			"ProductService": {
				Service:    "ProductService",
				Allocation: 2 * 1000000000, // 2s
				Percentage: 6.7,
			},
			"PaymentService": {
				Service:    "PaymentService",
				Allocation: 5 * 1000000000, // 5s
				Percentage: 16.7,
			},
		},
		AllowedValues: []string{
			"request_id",
			"user_id",
			"trace_id",
			"tenant_id",
		},
	}
}

func createBadContextPlan() *model.ContextPlan {
	plan := createDefaultContextPlan()
	plan.Description = "坏配置示例 - 用于测试检测能力"
	plan.TotalTimeout = 1 * 1000000000 // 1s 太短
	plan.Budgets["PaymentService"] = model.Budget{
		Service:    "PaymentService",
		Allocation: 10 * 1000000000, // 10s 超过总预算
		Percentage: 1000,
	}
	return plan
}

func createCallsJSONL(force bool, template string) error {
	filename := "calls.jsonl"

	if !force && fileExists(filename) {
		return fmt.Errorf("文件 %s 已存在，使用 -f 覆盖", filename)
	}

	var calls []map[string]interface{}
	if template == "bad" {
		calls = createBadCalls()
	} else {
		calls = createDefaultCalls()
	}

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	for _, call := range calls {
		data, err := json.Marshal(call)
		if err != nil {
			return err
		}
		file.Write(data)
		file.WriteString("\n")
	}

	fmt.Printf("  ✓ 创建 %s\n", filename)
	return nil
}

func createDefaultCalls() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"caller":           "OrderHandler",
			"callee":           "OrderService",
			"method":           "CreateOrder",
			"has_deadline":     true,
			"timeout_budget_ms": 500,
			"has_cancel":       true,
			"cancel_propagated": true,
			"cancel_called":    true,
			"uses_background":  true,
			"source_file":      "snippets/handler.go",
			"line_number":      15,
		},
		{
			"caller":           "OrderService",
			"callee":           "UserService",
			"method":           "GetUser",
			"has_deadline":     true,
			"timeout_budget_ms": 1000,
			"has_cancel":       true,
			"cancel_propagated": true,
			"cancel_called":    true,
			"with_value_keys":  []string{"user_id", "request_id"},
			"source_file":      "snippets/service.go",
			"line_number":      28,
		},
		{
			"caller":           "OrderService",
			"callee":           "ProductService",
			"method":           "GetProduct",
			"has_deadline":     true,
			"timeout_budget_ms": 2000,
			"has_cancel":       true,
			"cancel_propagated": true,
			"cancel_called":    true,
			"source_file":      "snippets/service.go",
			"line_number":      35,
		},
	}
}

func createBadCalls() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"caller":           "OrderHandler",
			"callee":           "OrderService",
			"method":           "CreateOrder",
			"has_deadline":     false,
			"has_cancel":       false,
			"uses_background":  true,
			"source_file":      "snippets/bad_handler.go",
			"line_number":      12,
		},
		{
			"caller":           "OrderService",
			"callee":           "UserService",
			"method":           "GetUser",
			"has_deadline":     true,
			"timeout_budget_ms": 60000,
			"has_cancel":       true,
			"cancel_called":    false,
			"uses_background":  true,
			"with_value_keys":  []string{"BadKey", "secret_token", "password"},
			"source_file":      "snippets/bad_service.go",
			"line_number":      20,
		},
		{
			"caller":           "OrderService",
			"callee":           "PaymentService",
			"method":           "Charge",
			"has_deadline":     true,
			"timeout_budget_ms": 10000,
			"has_cancel":       false,
			"is_goroutine":     true,
			"uses_todo":        true,
			"source_file":      "snippets/bad_service.go",
			"line_number":      45,
		},
	}
}

func createSnippets(force bool, template string) error {
	dir := "snippets"
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	files := map[string]string{
		filepath.Join(dir, "handler.go"): createGoodHandlerCode(),
		filepath.Join(dir, "service.go"): createGoodServiceCode(),
	}

	if template == "bad" {
		files[filepath.Join(dir, "bad_handler.go")] = createBadHandlerCode()
		files[filepath.Join(dir, "bad_service.go")] = createBadServiceCode()
	}

	for filename, content := range files {
		if !force && fileExists(filename) {
			fmt.Printf("  ⚠  跳过 %s（已存在）\n", filename)
			continue
		}
		if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
			return err
		}
		fmt.Printf("  ✓ 创建 %s\n", filename)
	}

	return nil
}

func createGoodHandlerCode() string {
	return `package handler

import (
	"context"
	"net/http"
	"time"
)

func OrderHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()

	ctx = context.WithValue(ctx, "request_id", r.Header.Get("X-Request-ID"))
	ctx = context.WithValue(ctx, "user_id", r.Header.Get("X-User-ID"))

	if err := orderService.CreateOrder(ctx); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}
`
}

func createGoodServiceCode() string {
	return `package service

import (
	"context"
	"time"
)

func (s *OrderService) CreateOrder(ctx context.Context) error {
	userCtx, userCancel := context.WithTimeout(ctx, 1*time.Second)
	defer userCancel()
	user, err := s.userService.GetUser(userCtx)
	if err != nil {
		return err
	}

	prodCtx, prodCancel := context.WithTimeout(ctx, 2*time.Second)
	defer prodCancel()
	product, err := s.productService.GetProduct(prodCtx)
	if err != nil {
		return err
	}

	go func() {
		notifCtx, notifCancel := context.WithTimeout(ctx, 3*time.Second)
		defer notifCancel()
		s.notificationService.Send(notifCtx, user.Email)
	}()

	return nil
}
`
}

func createBadHandlerCode() string {
	return `package handler

import (
	"context"
	"net/http"
)

func BadOrderHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	ctx = context.WithValue(ctx, "BadKey", "value")
	ctx = context.WithValue(ctx, "secret_token", "xxx")

	if err := orderService.CreateOrder(ctx); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}
`
}

func createBadServiceCode() string {
	return `package service

import (
	"context"
	"time"
)

func (s *OrderService) BadCreateOrder(ctx context.Context) error {
	ctx = context.Background()

	userCtx, _ := context.WithTimeout(ctx, 60*time.Second)
	user, err := s.userService.GetUser(userCtx)
	if err != nil {
		return err
	}

	go func() {
		todoCtx := context.TODO()
		s.paymentService.Charge(todoCtx)
	}()

	return nil
}
`
}

func createBadConfigExamples(force bool) error {
	dir := "bad-configs"
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	examples := map[string]string{
		filepath.Join(dir, "no_deadline.go"): `// 问题：没有设置 deadline
// 风险：请求可能永远阻塞
func BadNoDeadline(ctx context.Context) {
    // 没有设置超时
    result, err := externalService.Call(ctx)
    // ...
}
`,
		filepath.Join(dir, "cancel_not_called.go"): `// 问题：cancel 函数没有被调用
// 风险：资源泄漏
func BadCancelNotCalled(ctx context.Context) {
    ctx, _ = context.WithCancel(ctx)  // cancel 被忽略！
    // ... 没有 defer cancel()
}
`,
		filepath.Join(dir, "background_in_middle.go"): `// 问题：在调用链中间使用 context.Background
// 风险：中断 deadline 和取消信号传播
func BadBackgroundInMiddle(ctx context.Context) {
    // ❌ 错误：使用了新的 Background，上层的取消信号丢失
    newCtx := context.Background()
    externalService.Call(newCtx)
}
`,
		filepath.Join(dir, "withvalue_abuse.go"): `// 问题：WithValue 滥用
// 风险：类型不安全、难以维护
func BadWithValueAbuse(ctx context.Context) {
    // ❌ 传递过多值
    ctx = context.WithValue(ctx, "user", user)
    ctx = context.WithValue(ctx, "config", config)
    ctx = context.WithValue(ctx, "logger", logger)
    ctx = context.WithValue(ctx, "metrics", metrics)
    ctx = context.WithValue(ctx, "cache", cache)
    // ... 更多
}
`,
		filepath.Join(dir, "goroutine_no_cancel.go"): `// 问题：Goroutine 中没有可取消的 context
// 风险：Goroutine 泄漏
func BadGoroutineNoCancel(ctx context.Context) {
    go func() {
        // ❌ 没有使用可取消的 context
        for {
            externalService.Poll(ctx)
        }
    }()
}
`,
	}

	for filename, content := range files {
		if !force && fileExists(filename) {
			continue
		}
		if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
			return err
		}
	}

	fmt.Printf("  ✓ 创建 %s/\n", dir)
	return nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
