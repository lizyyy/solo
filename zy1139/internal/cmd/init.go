package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"capgate/internal/config"

	"github.com/spf13/cobra"
)

const (
	SampleRoutesYAML = `routes:
  - name: "get-user-profile"
    path: "/api/v1/users/{id}"
    method: "GET"
    description: "获取用户详情接口"
    tags: ["user", "read"]
    budget:
      p95_latency_ms: 200.0
      p99_latency_ms: 500.0
      max_error_rate: 0.01
      max_rps: 1000
      max_concurrent: 200
      cpu_budget_percent: 30.0
      memory_budget_mb: 256
    dependencies:
      - name: "user-db"
        factor: 1.0
      - name: "profile-cache"
        factor: 0.8

  - name: "create-order"
    path: "/api/v1/orders"
    method: "POST"
    description: "创建订单接口"
    tags: ["order", "write"]
    budget:
      p95_latency_ms: 300.0
      p99_latency_ms: 800.0
      max_error_rate: 0.005
      max_rps: 500
      max_concurrent: 100
      cpu_budget_percent: 45.0
      memory_budget_mb: 512
    dependencies:
      - name: "order-db"
        factor: 1.0
      - name: "inventory-service"
        factor: 1.0
      - name: "payment-gateway"
        factor: 1.0

  - name: "search-products"
    path: "/api/v1/products/search"
    method: "GET"
    description: "商品搜索接口"
    tags: ["product", "search", "read"]
    budget:
      p95_latency_ms: 150.0
      p99_latency_ms: 300.0
      max_error_rate: 0.02
      max_rps: 2000
      max_concurrent: 500
      cpu_budget_percent: 60.0
      memory_budget_mb: 384
    dependencies:
      - name: "search-engine"
        factor: 1.0

  - name: "update-stock"
    path: "/api/v1/inventory/stock"
    method: "PATCH"
    description: "更新库存接口"
    tags: ["inventory", "write"]
    budget:
      p95_latency_ms: 100.0
      p99_latency_ms: 200.0
      max_error_rate: 0.001
      max_rps: 800
      max_concurrent: 150
      cpu_budget_percent: 25.0
      memory_budget_mb: 128
    dependencies:
      - name: "inventory-db"
        factor: 1.0
      - name: "stock-cache"
        factor: 0.5
`

	SampleTrafficPlanJSON = `{
  "version": "1.0",
  "plan_name": "release-capacity-test",
  "description": "上线前容量测试计划",
  "routes": [
    {
      "name": "get-user-profile",
      "weight": 0.4,
      "steps": [
        {
          "duration_sec": 60,
          "target_rps": 500,
          "concurrent_users": 100
        },
        {
          "duration_sec": 120,
          "target_rps": 800,
          "concurrent_users": 160
        },
        {
          "duration_sec": 60,
          "target_rps": 1000,
          "concurrent_users": 200
        }
      ]
    },
    {
      "name": "create-order",
      "weight": 0.2,
      "steps": [
        {
          "duration_sec": 60,
          "target_rps": 200,
          "concurrent_users": 50
        },
        {
          "duration_sec": 120,
          "target_rps": 400,
          "concurrent_users": 80
        },
        {
          "duration_sec": 60,
          "target_rps": 500,
          "concurrent_users": 100
        }
      ]
    },
    {
      "name": "search-products",
      "weight": 0.3,
      "steps": [
        {
          "duration_sec": 60,
          "target_rps": 1000,
          "concurrent_users": 250
        },
        {
          "duration_sec": 120,
          "target_rps": 1500,
          "concurrent_users": 375
        },
        {
          "duration_sec": 60,
          "target_rps": 2000,
          "concurrent_users": 500
        }
      ]
    },
    {
      "name": "update-stock",
      "weight": 0.1,
      "steps": [
        {
          "duration_sec": 60,
          "target_rps": 300,
          "concurrent_users": 60
        },
        {
          "duration_sec": 120,
          "target_rps": 600,
          "concurrent_users": 120
        },
        {
          "duration_sec": 60,
          "target_rps": 800,
          "concurrent_users": 150
        }
      ]
    }
  ],
  "scenarios": [
    {
      "name": "cache-miss-simulation",
      "description": "模拟缓存全命中到全未命中",
      "type": "cache_miss",
      "params": {
        "hit_rate_start": 0.9,
        "hit_rate_end": 0.1
      },
      "apply_routes": ["get-user-profile", "update-stock"]
    },
    {
      "name": "downstream-slow",
      "description": "模拟下游服务响应变慢",
      "type": "downstream_slow",
      "params": {
        "latency_multiplier": 2.5,
        "timeout_chance": 0.05
      },
      "apply_routes": ["create-order"]
    },
    {
      "name": "circuit-breaker-open",
      "description": "模拟熔断器打开",
      "type": "circuit_open",
      "params": {
        "error_rate": 0.5
      },
      "apply_routes": ["search-products"]
    }
  ]
}
`

	SampleBaselineCSV = `route_name,p50_latency_ms,p95_latency_ms,p99_latency_ms,avg_latency_ms,throughput_rps,error_rate,max_concurrent,cpu_peak_percent,memory_peak_mb
get-user-profile,45.0,120.0,180.0,55.0,950.0,0.005,180,28.5,220
create-order,80.0,200.0,350.0,95.0,480.0,0.002,95,42.0,480
search-products,30.0,80.0,120.0,35.0,1900.0,0.01,450,55.0,360
update-stock,25.0,60.0,90.0,28.0,780.0,0.001,140,22.0,115
`

	SampleDependencyLimitsYAML = `dependencies:
  - name: "user-db"
    type: "database"
    max_qps: 5000
    max_concurrent: 100
    max_latency_ms: 100.0
    timeout_ms: 3000.0
    connection_pool:
      max_connections: 100
      max_idle_connections: 20

  - name: "profile-cache"
    type: "cache"
    max_qps: 10000
    max_concurrent: 500
    max_latency_ms: 10.0
    timeout_ms: 500.0

  - name: "order-db"
    type: "database"
    max_qps: 3000
    max_concurrent: 80
    max_latency_ms: 150.0
    timeout_ms: 5000.0
    connection_pool:
      max_connections: 80
      max_idle_connections: 15

  - name: "inventory-service"
    type: "grpc"
    max_qps: 2000
    max_concurrent: 50
    max_latency_ms: 200.0
    timeout_ms: 3000.0

  - name: "payment-gateway"
    type: "http"
    max_qps: 1000
    max_concurrent: 30
    max_latency_ms: 500.0
    timeout_ms: 10000.0

  - name: "search-engine"
    type: "http"
    max_qps: 5000
    max_concurrent: 200
    max_latency_ms: 100.0
    timeout_ms: 5000.0

  - name: "inventory-db"
    type: "database"
    max_qps: 4000
    max_concurrent: 100
    max_latency_ms: 80.0
    timeout_ms: 3000.0
    connection_pool:
      max_connections: 100
      max_idle_connections: 20

  - name: "stock-cache"
    type: "cache"
    max_qps: 8000
    max_concurrent: 300
    max_latency_ms: 8.0
    timeout_ms: 500.0
`
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "初始化项目，生成样例配置文件",
	Long: `在当前目录或指定目录生成压测计划所需的样例配置文件：
- routes.yaml: 路由定义和容量预算
- traffic-plan.json: 压测流量计划和场景配置
- baseline.csv: 基线性能数据
- dependency-limits.yaml: 下游依赖限额配置`,
	RunE: func(cmd *cobra.Command, args []string) error {
		outputDir, _ := cmd.Flags().GetString("output")
		force, _ := cmd.Flags().GetBool("force")

		if outputDir == "" {
			outputDir = "."
		}

		if err := config.EnsureDir(outputDir); err != nil {
			return fmt.Errorf("创建输出目录失败: %w", err)
		}

		files := []struct {
			name    string
			content string
		}{
			{"routes.yaml", SampleRoutesYAML},
			{"traffic-plan.json", SampleTrafficPlanJSON},
			{"baseline.csv", SampleBaselineCSV},
			{"dependency-limits.yaml", SampleDependencyLimitsYAML},
		}

		for _, file := range files {
			filePath := fmt.Sprintf("%s/%s", outputDir, file.name)

			if config.FileExists(filePath) && !force {
				reader := bufio.NewReader(os.Stdin)
				fmt.Printf("文件 %s 已存在，是否覆盖？(y/N): ", filePath)
				response, _ := reader.ReadString('\n')
				response = strings.TrimSpace(strings.ToLower(response))
				if response != "y" && response != "yes" {
					fmt.Printf("跳过 %s\n", filePath)
					continue
				}
			}

			if err := config.WriteFile(filePath, file.content); err != nil {
				return fmt.Errorf("写入文件失败 %s: %w", filePath, err)
			}
			fmt.Printf("已创建: %s\n", filePath)
		}

		fmt.Println("\n初始化完成！已生成以下样例文件：")
		fmt.Println("  - routes.yaml          路由定义和容量预算")
		fmt.Println("  - traffic-plan.json    压测流量计划和场景配置")
		fmt.Println("  - baseline.csv         基线性能数据")
		fmt.Println("  - dependency-limits.yaml 下游依赖限额配置")
		fmt.Println("\n下一步建议：")
		fmt.Println("  1. 根据实际情况修改配置文件")
		fmt.Println("  2. 运行 'capgate validate' 验证配置")
		fmt.Println("  3. 运行 'capgate run' 执行压测计划")

		return nil
	},
}

func init() {
	initCmd.Flags().StringP("output", "o", "", "输出目录（默认为当前目录）")
	initCmd.Flags().BoolP("force", "f", false, "强制覆盖已存在的文件")
}
