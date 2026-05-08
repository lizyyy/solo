package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/config"
	"github.com/chaos-simulator/chaos-simulator/internal/repository"
	"github.com/chaos-simulator/chaos-simulator/internal/service"
	"github.com/chaos-simulator/chaos-simulator/internal/types"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"github.com/chaos-simulator/chaos-simulator/pkg/reporter"
	"github.com/chaos-simulator/chaos-simulator/pkg/tracer"
	"go.uber.org/zap"
)

var (
	configPath = flag.String("config", "./configs/config.yaml", "Path to config file")
)

type ControlCenter struct {
	repo         *repository.SQLiteRepository
	chaosManager *service.ChaosManager
	analyzer     *reporter.ProblemAnalyzer
	exporter     *reporter.ReportExporter
}

func main() {
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	if err := utils.InitLogger(cfg.Logging.Level, cfg.Logging.Format); err != nil {
		fmt.Printf("Failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer utils.GetLogger().Sync()

	if err := os.MkdirAll(filepath.Dir(cfg.Database.SQLite.Path), 0755); err != nil {
		utils.GetLogger().Fatal("Failed to create data directory", zap.Error(err))
	}

	repo, err := repository.NewSQLiteRepository(cfg.Database.SQLite.Path)
	if err != nil {
		utils.GetLogger().Fatal("Failed to init database", zap.Error(err))
	}
	defer repo.Close()

	chaosManager := service.NewChaosManager(repo)
	analyzer := reporter.NewProblemAnalyzer(repo)

	exporter, err := reporter.NewReportExporter("./data/reports")
	if err != nil {
		utils.GetLogger().Fatal("Failed to init report exporter", zap.Error(err))
	}

	cc := &ControlCenter{
		repo:         repo,
		chaosManager: chaosManager,
		analyzer:     analyzer,
		exporter:     exporter,
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/", cc.handleHome)
	mux.HandleFunc("/api/scenarios", cc.handleScenarios)
	mux.HandleFunc("/api/scenarios/enable", cc.handleEnableScenario)
	mux.HandleFunc("/api/scenarios/disable", cc.handleDisableScenario)
	mux.HandleFunc("/api/traces", cc.handleGetTraces)
	mux.HandleFunc("/api/analyze", cc.handleAnalyze)
	mux.HandleFunc("/api/reports", cc.handleGetReports)
	mux.HandleFunc("/api/reports/export", cc.handleExportReport)
	mux.HandleFunc("/api/health", cc.handleHealth)

	utils.GetLogger().Info("Control Center starting",
		zap.Int("port", cfg.Server.ControlCenter.Port))

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.ControlCenter.Port),
		Handler: mux,
	}

	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		utils.GetLogger().Info("Shutting down control center...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		utils.GetLogger().Fatal("Failed to start control center", zap.Error(err))
	}
}

func (cc *ControlCenter) handleHome(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "text/html")

	homeTemplate := `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chaos Simulator 控制中心</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            min-height: 100vh;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 40px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 28px; margin-bottom: 5px; }
        .header p { opacity: 0.9; }
        .container { max-width: 1400px; margin: 30px auto; padding: 0 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 25px; }
        .card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .card h2 {
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
        }
        .scenario-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 8px;
            margin-bottom: 10px;
            transition: all 0.3s;
        }
        .scenario-item:hover { background: #f0f0f0; }
        .scenario-info h3 { color: #333; margin-bottom: 5px; font-size: 16px; }
        .scenario-info p { color: #666; font-size: 13px; }
        .scenario-type {
            display: inline-block;
            padding: 3px 8px;
            background: #e3f2fd;
            color: #1565c0;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 10px;
        }
        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
        }
        .status-active { background: #4caf50; color: white; }
        .status-inactive { background: #9e9e9e; color: white; }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
            margin-left: 10px;
        }
        .btn-primary { background: #667eea; color: white; }
        .btn-primary:hover { background: #5568d3; }
        .btn-danger { background: #f44336; color: white; }
        .btn-danger:hover { background: #d32f2f; }
        .btn-success { background: #4caf50; color: white; }
        .btn-success:hover { background: #43a047; }
        .analyze-form { display: flex; gap: 10px; margin-bottom: 20px; }
        .analyze-form input {
            flex: 1;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 14px;
        }
        .analyze-form input:focus { border-color: #667eea; outline: none; }
        .report-item {
            padding: 15px;
            background: #f9f9f9;
            border-radius: 8px;
            margin-bottom: 10px;
        }
        .report-item h3 { color: #333; margin-bottom: 8px; }
        .report-meta { color: #666; font-size: 13px; }
        .severity-critical { border-left: 4px solid #f44336; }
        .severity-high { border-left: 4px solid #ff9800; }
        .severity-medium { border-left: 4px solid #ffeb3b; }
        .severity-low { border-left: 4px solid #4caf50; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab {
            padding: 10px 20px;
            background: #e0e0e0;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .tab.active { background: #667eea; color: white; }
        .service-list { display: flex; gap: 10px; flex-wrap: wrap; }
        .service-badge {
            padding: 8px 16px;
            background: #e8f5e9;
            color: #2e7d32;
            border-radius: 6px;
            font-size: 14px;
        }
        .actions { display: flex; gap: 10px; align-items: center; }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Chaos Simulator 控制中心</h1>
        <p>分布式系统故障模拟与分析平台</p>
    </div>
    <div class="container">
        <div class="grid">
            <div class="card">
                <h2>🚨 Chaos 场景控制</h2>
                <div id="scenarios-container"></div>
            </div>
            <div class="card">
                <h2>🔬 问题分析</h2>
                <div class="analyze-form">
                    <input type="text" id="trace-id-input" placeholder="输入 TraceID 进行分析...">
                    <button class="btn btn-primary" onclick="analyzeTrace()">分析</button>
                </div>
                <div id="analysis-result" class="empty-state">请输入 TraceID 进行分析</div>
            </div>
            <div class="card">
                <h2>📊 问题报告</h2>
                <div id="reports-container"></div>
            </div>
            <div class="card">
                <h2>🔧 服务状态</h2>
                <div class="service-list">
                    <span class="service-badge">gateway (8080)</span>
                    <span class="service-badge">order-service (50052)</span>
                    <span class="service-badge">payment-service (50053)</span>
                    <span class="service-badge">inventory-service (50054)</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function loadScenarios() {
            const response = await fetch('/api/scenarios');
            const data = await response.json();
            const container = document.getElementById('scenarios-container');

            if (data.scenarios.length === 0) {
                container.innerHTML = '<div class="empty-state">暂无预设场景</div>';
                return;
            }

            container.innerHTML = data.scenarios.map(s => `
                <div class="scenario-item">
                    <div class="scenario-info">
                        <h3>${s.name} <span class="scenario-type">${s.type}</span></h3>
                        <p>${s.description || '服务: ' + s.target_service + (s.target_method ? ' / ' + s.target_method : '')}</p>
                    </div>
                    <div class="actions">
                        <span class="status-badge ${s.enabled ? 'status-active' : 'status-inactive'}">
                            ${s.enabled ? '已激活' : '未激活'}
                        </span>
                        ${s.enabled ?
                            `<button class="btn btn-danger" onclick="disableScenario('${s.id}')">停用</button>` :
                            `<button class="btn btn-success" onclick="enableScenario('${s.id}')">激活</button>`
                        }
                    </div>
                </div>
            `).join('');
        }

        async function enableScenario(id) {
            await fetch('/api/scenarios/enable?id=' + id, { method: 'POST' });
            loadScenarios();
        }

        async function disableScenario(id) {
            await fetch('/api/scenarios/disable?id=' + id, { method: 'POST' });
            loadScenarios();
        }

        async function analyzeTrace() {
            const traceID = document.getElementById('trace-id-input').value.trim();
            if (!traceID) return;

            const container = document.getElementById('analysis-result');
            container.innerHTML = '<div class="empty-state">分析中...</div>';

            try {
                const response = await fetch('/api/analyze?trace_id=' + encodeURIComponent(traceID));
                const data = await response.json();

                if (data.error) {
                    container.innerHTML = '<div class="empty-state">' + data.error + '</div>';
                    return;
                }

                const report = data.report;
                container.innerHTML = `
                    <div class="report-item severity-${report.severity.toLowerCase()}">
                        <h3>${report.title}</h3>
                        <div class="report-meta">
                            <strong>类型:</strong> ${report.problem_type} |
                            <strong>严重程度:</strong> ${report.severity}
                        </div>
                        <p style="margin-top: 10px; color: #666;">${report.summary}</p>
                        <div style="margin-top: 15px;">
                            <strong style="color: #333;">根因分析:</strong>
                            <p style="color: #666; margin-top: 5px;">${report.root_cause}</p>
                        </div>
                        <div style="margin-top: 15px;">
                            <strong style="color: #333;">影响服务:</strong>
                            <div style="margin-top: 5px;">
                                ${report.affected_services.map(s => `<span class="service-badge" style="margin: 2px;">${s}</span>`).join('')}
                            </div>
                        </div>
                        <div style="margin-top: 15px;">
                            <button class="btn btn-primary" onclick="exportReport('${report.id}')">导出报告</button>
                        </div>
                    </div>
                `;
            } catch (e) {
                container.innerHTML = '<div class="empty-state">分析失败: ' + e.message + '</div>';
            }
        }

        async function exportReport(id) {
            const response = await fetch('/api/reports/export?id=' + encodeURIComponent(id), { method: 'POST' });
            const data = await response.json();
            alert('报告已导出: ' + data.files.join(', '));
        }

        async function loadReports() {
            const response = await fetch('/api/reports?limit=10');
            const data = await response.json();
            const container = document.getElementById('reports-container');

            if (data.reports.length === 0) {
                container.innerHTML = '<div class="empty-state">暂无报告</div>';
                return;
            }

            container.innerHTML = data.reports.map(r => `
                <div class="report-item severity-${r.severity.toLowerCase()}">
                    <h3>${r.title}</h3>
                    <div class="report-meta">
                        ${new Date(r.generated_at).toLocaleString()} | ${r.severity}
                    </div>
                    <div style="margin-top: 10px;">
                        <button class="btn btn-primary" onclick="exportReport('${r.id}')">导出</button>
                    </div>
                </div>
            `).join('');
        }

        loadScenarios();
        loadReports();
        setInterval(loadScenarios, 5000);
        setInterval(loadReports, 10000);
    </script>
</body>
</html>
`

	tmpl, err := template.New("home").Parse(homeTemplate)
	if err != nil {
		http.Error(w, "Template error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	tmpl.Execute(w, nil)
}

func (cc *ControlCenter) handleScenarios(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		ctx := context.Background()
		scenarios, err := cc.chaosManager.GetAllScenarios(ctx)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":     "Failed to get scenarios",
				"scenarios": []interface{}{},
			})
			return
		}

		if len(scenarios) == 0 {
			cc.initDefaultScenarios(ctx)
			scenarios, _ = cc.chaosManager.GetAllScenarios(ctx)
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"scenarios": scenarios,
		})
	}
}

func (cc *ControlCenter) initDefaultScenarios(ctx context.Context) {
	defaultScenarios := []*types.ChaosScenario{
		{
			ID:            "scenario-timeout-order",
			Name:          "订单服务超时",
			Description:   "订单服务 CreateOrder 方法超时 2 秒",
			TargetService: "order-service",
			TargetMethod:  "CreateOrder",
			Type:          types.ChaosTypeTimeout,
			Config: types.ChaosConfig{
				TimeoutMS: 2000,
			},
			Enabled: false,
		},
		{
			ID:            "scenario-error-payment",
			Name:          "支付服务随机错误",
			Description:   "支付服务 50% 概率返回错误",
			TargetService: "payment-service",
			TargetMethod:  "ProcessPayment",
			Type:          types.ChaosTypeError,
			Config: types.ChaosConfig{
				ErrorRate:    0.5,
				Probability:  0.5,
				ErrorMessage: "payment gateway unavailable",
			},
			Enabled: false,
		},
		{
			ID:            "scenario-slow-inventory",
			Name:          "库存服务慢响应",
			Description:   "库存服务响应延迟 3 秒",
			TargetService: "inventory-service",
			TargetMethod:  "DeductStock",
			Type:          types.ChaosTypeSlowResponse,
			Config: types.ChaosConfig{
				DelayMS: 3000,
			},
			Enabled: false,
		},
		{
			ID:            "scenario-network-order",
			Name:          "订单服务