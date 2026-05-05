package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
	"text/template"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/internal/model"
	"github.com/zy1232/microservice-framework/internal/persistence"
)

type ReportData struct {
	GeneratedAt    time.Time
	Date           string
	RequestLogs    []RequestLogSummary
	RoutingDecisions []RoutingDecisionSummary
	TotalRequests  int
	SuccessCount   int
	ErrorCount     int
	AvgDuration    time.Duration
	TopServices    map[string]int
	DecisionsByReason map[string]int
}

type RequestLogSummary struct {
	TraceID    string
	Service    string
	Endpoint   string
	Method     string
	StatusCode int
	Duration   time.Duration
	Error      string
	CreatedAt  time.Time
}

type RoutingDecisionSummary struct {
	TraceID   string
	Service   string
	Endpoint  string
	Method    string
	Decision  string
	Reason    string
	Error     string
	Timestamp time.Time
}

func main() {
	outputFormat := flag.String("format", "markdown", "Output format: markdown or json")
	outputFile := flag.String("output", "", "Output file path")
	date := flag.String("date", time.Now().Format("2006-01-02"), "Date for the report (YYYY-MM-DD)")
	dataDir := flag.String("data", "./data", "Data directory")
	flag.Parse()

	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	store, err := persistence.NewStore(*dataDir)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create persistence store")
	}

	logs, err := store.LoadRequestLogs(*date)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to load request logs")
	}

	decisions, err := store.LoadRoutingDecisions(*date)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to load routing decisions")
	}

	data := prepareReportData(logs, decisions, *date)

	var output []byte
	if *outputFormat == "json" {
		output, err = generateJSONReport(data)
	} else {
		output, err = generateMarkdownReport(data)
	}

	if err != nil {
		log.Fatal().Err(err).Msg("Failed to generate report")
	}

	if *outputFile != "" {
		if err := os.WriteFile(*outputFile, output, 0644); err != nil {
			log.Fatal().Err(err).Msg("Failed to write report file")
		}
		log.Info().Str("file", *outputFile).Msg("Report written")
	} else {
		fmt.Println(string(output))
	}
}

func prepareReportData(logs []*model.RequestLog, decisions []*model.RoutingDecision, date string) ReportData {
	data := ReportData{
		GeneratedAt:       time.Now(),
		Date:              date,
		TotalRequests:     len(logs),
		TopServices:       make(map[string]int),
		DecisionsByReason: make(map[string]int),
	}

	var totalDuration time.Duration
	for _, logEntry := range logs {
		data.RequestLogs = append(data.RequestLogs, RequestLogSummary{
			TraceID:    logEntry.TraceID,
			Service:    logEntry.Service,
			Endpoint:   logEntry.Endpoint,
			Method:     logEntry.Method,
			StatusCode: logEntry.StatusCode,
			Duration:   logEntry.Duration,
			Error:      logEntry.Error,
			CreatedAt:  logEntry.CreatedAt,
		})

		data.TopServices[logEntry.Service]++
		totalDuration += logEntry.Duration

		if logEntry.StatusCode >= 200 && logEntry.StatusCode < 400 {
			data.SuccessCount++
		} else {
			data.ErrorCount++
		}
	}

	if data.TotalRequests > 0 {
		data.AvgDuration = totalDuration / time.Duration(data.TotalRequests)
	}

	for _, decision := range decisions {
		data.RoutingDecisions = append(data.RoutingDecisions, RoutingDecisionSummary{
			TraceID:   decision.TraceID,
			Service:   decision.Service,
			Endpoint:  decision.Endpoint,
			Method:    decision.Method,
			Decision:  decision.Decision,
			Reason:    decision.Reason,
			Error:     decision.Error,
			Timestamp: decision.Timestamp,
		})

		data.DecisionsByReason[decision.Reason]++
	}

	return data
}

func generateJSONReport(data ReportData) ([]byte, error) {
	return json.MarshalIndent(data, "", "  ")
}

const markdownTemplate = `# 微服务运行报告

**生成时间**: {{.GeneratedAt.Format "2006-01-02 15:04:05"}}
**报告日期**: {{.Date}}

---

## 概览统计

| 指标 | 值 |
|------|-----|
| 总请求数 | {{.TotalRequests}} |
| 成功请求 | {{.SuccessCount}} |
| 失败请求 | {{.ErrorCount}} |
| 平均响应时间 | {{.AvgDuration}} |
| 成功率 | {{if .TotalRequests}}{{printf "%.1f%%" (divide .SuccessCount .TotalRequests)}}{{else}}N/A{{end}} |

---

## 服务调用统计

{{if .TopServices}}
| 服务 | 调用次数 |
|------|----------|
{{range $service, $count := .TopServices}}| {{$service}} | {{$count}} |
{{end}}
{{else}}
暂无数据
{{end}}

---

## 路由决策统计

{{if .DecisionsByReason}}
| 原因 | 次数 |
|------|------|
{{range $reason, $count := .DecisionsByReason}}| {{$reason}} | {{$count}} |
{{end}}
{{else}}
暂无数据
{{end}}

---

## 请求日志详情

{{if .RequestLogs}}
| Trace ID | 服务 | 端点 | 方法 | 状态码 | 耗时 | 错误 | 时间 |
|----------|------|------|------|--------|------|------|------|
{{range .RequestLogs}}| {{.TraceID}} | {{.Service}} | {{.Endpoint}} | {{.Method}} | {{.StatusCode}} | {{.Duration}} | {{if .Error}}{{.Error}}{{else}}-{{end}} | {{.CreatedAt.Format "15:04:05"}} |
{{end}}
{{else}}
暂无请求日志
{{end}}

---

## 路由决策详情

{{if .RoutingDecisions}}
| Trace ID | 服务 | 端点 | 方法 | 决策 | 原因 | 错误 | 时间 |
|----------|------|------|------|------|------|------|------|
{{range .RoutingDecisions}}| {{.TraceID}} | {{.Service}} | {{.Endpoint}} | {{.Method}} | {{.Decision}} | {{.Reason}} | {{if .Error}}{{.Error}}{{else}}-{{end}} | {{.Timestamp.Format "15:04:05"}} |
{{end}}
{{else}}
暂无路由决策记录
{{end}}

---

*报告由 microservice-framework 自动生成*
`

func generateMarkdownReport(data ReportData) ([]byte, error) {
	funcMap := template.FuncMap{
		"divide": func(a, b int) float64 {
			if b == 0 {
				return 0
			}
			return float64(a) * 100.0 / float64(b)
		},
	}

	tmpl, err := template.New("report").Funcs(funcMap).Parse(markdownTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}

	var buf strings.Builder
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}

	return []byte(buf.String()), nil
}
