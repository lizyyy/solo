package reporter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/types"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"go.uber.org/zap"
)

type ReportExporter struct {
	outputDir string
}

type ExportFormat string

const (
	FormatJSON     ExportFormat = "json"
	FormatMarkdown ExportFormat = "markdown"
	FormatHTML     ExportFormat = "html"
)

func NewReportExporter(outputDir string) (*ReportExporter, error) {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}
	return &ReportExporter{outputDir: outputDir}, nil
}

func (e *ReportExporter) Export(ctx context.Context, report *types.ProblemReport, formats ...ExportFormat) ([]string, error) {
	if len(formats) == 0 {
		formats = []ExportFormat{FormatJSON, FormatMarkdown, FormatHTML}
	}

	var exportedFiles []string

	for _, format := range formats {
		filename, err := e.exportSingle(report, format)
		if err != nil {
			utils.GetLogger().Error("Failed to export report",
				zap.String("format", string(format)),
				zap.Error(err))
			continue
		}
		exportedFiles = append(exportedFiles, filename)
	}

	return exportedFiles, nil
}

func (e *ReportExporter) exportSingle(report *types.ProblemReport, format ExportFormat) (string, error) {
	var content []byte
	var ext string
	var err error

	switch format {
	case FormatJSON:
		ext = "json"
		content, err = e.toJSON(report)
	case FormatMarkdown:
		ext = "md"
		content, err = e.toMarkdown(report)
	case FormatHTML:
		ext = "html"
		content, err = e.toHTML(report)
	default:
		return "", fmt.Errorf("unsupported format: %s", format)
	}

	if err != nil {
		return "", err
	}

	filename := fmt.Sprintf("report_%s_%s.%s",
		report.ID[:8],
		time.Now().Format("20060102_150405"),
		ext)
	filepath := filepath.Join(e.outputDir, filename)

	if err := os.WriteFile(filepath, content, 0644); err != nil {
		return "", fmt.Errorf("failed to write report: %w", err)
	}

	utils.GetLogger().Info("Report exported successfully",
		zap.String("format", string(format)),
		zap.String("path", filepath))

	return filepath, nil
}

func (e *ReportExporter) toJSON(report *types.ProblemReport) ([]byte, error) {
	return json.MarshalIndent(report, "", "  ")
}

func (e *ReportExporter) toMarkdown(report *types.ProblemReport) ([]byte, error) {
	var buf bytes.Buffer

	buf.WriteString("# 系统问题分析报告\n\n")
	buf.WriteString(fmt.Sprintf("**报告ID:** %s  \n", report.ID))
	buf.WriteString(fmt.Sprintf("**生成时间:** %s  \n", report.GeneratedAt.Format("2006-01-02 15:04:05")))
	buf.WriteString(fmt.Sprintf("**TraceID:** %s  \n", report.TraceID))
	buf.WriteString(fmt.Sprintf("**问题类型:** %s  \n", report.ProblemType))
	buf.WriteString(fmt.Sprintf("**严重程度:** %s  \n\n", report.Severity))

	buf.WriteString("## 摘要\n\n")
	buf.WriteString(report.Summary + "\n\n")

	buf.WriteString("## 根因分析\n\n")
	buf.WriteString(report.RootCause + "\n\n")

	buf.WriteString("## 受影响服务\n\n")
	for i, svc := range report.AffectedServices {
		buf.WriteString(fmt.Sprintf("%d. %s\n", i+1, svc))
	}
	buf.WriteString("\n")

	buf.WriteString("## 问题证据\n\n")
	if len(report.Evidence) > 0 {
		buf.WriteString("| 服务 | 方法 | 状态 | 尝试次数 | 错误信息 | 时间 |\n")
		buf.WriteString("|------|------|------|----------|----------|------|\n")
		for _, item := range report.Evidence {
			errInfo := item.Error
			if errInfo == "" {
				errInfo = "-"
			}
			if len(errInfo) > 50 {
				errInfo = errInfo[:50] + "..."
			}
			buf.WriteString(fmt.Sprintf("| %s | %s | %s | %d | %s | %s |\n",
				item.Service, item.Method, item.Status, item.Attempt,
				errInfo, item.Time.Format("15:04:05")))
		}
	} else {
		buf.WriteString("无\n")
	}
	buf.WriteString("\n")

	buf.WriteString("## 事件时间线\n\n")
	if len(report.Timeline) > 0 {
		for _, event := range report.Timeline {
			buf.WriteString(fmt.Sprintf("- **%s** [%s] %s  \n",
				event.Time.Format("15:04:05.000"),
				event.Service,
				event.Event))
			if event.Details != "" {
				buf.WriteString(fmt.Sprintf("  - %s\n", event.Details))
			}
		}
	}
	buf.WriteString("\n")

	buf.WriteString("## 修复建议\n\n")
	for i, rec := range report.Recommendations {
		buf.WriteString(fmt.Sprintf("%d. %s\n", i+1, rec))
	}

	return buf.Bytes(), nil
}

func (e *ReportExporter) toHTML(report *types.ProblemReport) ([]byte, error) {
	htmlTemplate := `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>系统问题分析报告 - {{.Title}}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .severity {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            margin-left: 10px;
        }
        .severity-CRITICAL { background: #ff4444; color: white; }
        .severity-HIGH { background: #ff9800; color: white; }
        .severity-MEDIUM { background: #ffeb3b; color: #333; }
        .severity-LOW { background: #4caf50; color: white; }
        .problem-type {
            display: inline-block;
            padding: 8px 16px;
            background: #3f51b5;
            color: white;
            border-radius: 6px;
            font-weight: bold;
        }
        .card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .card h2 {
            color: #333;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
        }
        .meta-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .meta-item {
            background: #f5f5f5;
            padding: 10px 15px;
            border-radius: 6px;
        }
        .meta-label { color: #666; font-size: 12px; margin-bottom: 4px; }
        .meta-value { color: #333; font-weight: 600; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th {
            background: #f5f5f5;
            font-weight: 600;
            color: #333;
        }
        tr:hover { background: #fafafa; }
        .timeline {
            position: relative;
            padding-left: 30px;
            margin-top: 15px;
        }
        .timeline::before {
            content: '';
            position: absolute;
            left: 8px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #e0e0e0;
        }
        .timeline-item {
            position: relative;
            margin-bottom: 20px;
            padding: 15px;
            background: #fafafa;
            border-radius: 8px;
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -27px;
            top: 18px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #3f51b5;
            border: 2px solid white;
            box-shadow: 0 0 0 2px #3f51b5;
        }
        .timeline-time { font-size: 12px; color: #666; margin-bottom: 5px; }
        .timeline-service { font-weight: 600; color: #3f51b5; margin-bottom: 5px; }
        .timeline-event { color: #333; }
        .timeline-details { font-size: 13px; color: #666; margin-top: 5px; }
        .recommendations {
            list-style: none;
        }
        .recommendations li {
            padding: 12px 15px;
            background: #e8f5e9;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 4px solid #4caf50;
        }
        .service-badge {
            display: inline-block;
            padding: 5px 10px;
            background: #e3f2fd;
            color: #1565c0;
            border-radius: 4px;
            margin: 3px;
            font-size: 13px;
        }
        .status-success { color: #4caf50; }
        .status-error { color: #f44336; }
        .status-started { color: #ff9800; }
        h1 { color: #333; margin-bottom: 10px; }
        .summary-box {
            background: #fff3e0;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #ff9800;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 {{.Title}}</h1>
            <div style="margin-top: 15px;">
                <span class="problem-type">{{.ProblemType}}</span>
                <span class="severity severity-{{.Severity}}">{{.Severity}}</span>
            </div>
            <div class="meta-info">
                <div class="meta-item">
                    <div class="meta-label">报告ID</div>
                    <div class="meta-value">{{.ID}}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">TraceID</div>
                    <div class="meta-value">{{.TraceID}}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">生成时间</div>
                    <div class="meta-value">{{.GeneratedAt}}</div>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>📝 摘要</h2>
            <div class="summary-box">{{.Summary}}</div>
        </div>

        <div class="card">
            <h2>🎯 根因分析</h2>
            <p style="line-height: 1.8; color: #333;">{{.RootCause}}</p>
        </div>

        <div class="card">
            <h2>🔗 受影响服务</h2>
            <div style="margin-top: 10px;">
                {{range .AffectedServices}}
                <span class="service-badge">{{.}}</span>
                {{end}}
            </div>
        </div>

        {{if .Evidence}}
        <div class="card">
            <h2>🔬 问题证据</h2>
            <table>
                <thead>
                    <tr>
                        <th>服务</th>
                        <th>方法</th>
                        <th>状态</th>
                        <th>尝试次数</th>
                        <th>错误信息</th>
                        <th>时间</th>
                    </tr>
                </thead>
                <tbody>
                    {{range .Evidence}}
                    <tr>
                        <td>{{.Service}}</td>
                        <td>{{.Method}}</td>
                        <td class="status-{{.Status}}">{{.Status}}</td>
                        <td>{{.Attempt}}</td>
                        <td>{{if .Error}}{{.Error}}{{else}}-{{end}}</td>
                        <td>{{.Time}}</td>
                    </tr>
                    {{end}}
                </tbody>
            </table>
        </div>
        {{end}}

        {{if .Timeline}}
        <div class="card">
            <h2>📅 事件时间线</h2>
            <div class="timeline">
                {{range .Timeline}}
                <div class="timeline-item">
                    <div class="timeline-time">{{.Time}}</div>
                    <div class="timeline-service">[{{.Service}}]</div>
                    <div class="timeline-event">{{.Event}}</div>
                    {{if .Details}}<div class="timeline-details">{{.Details}}</div>{{end}}
                </div>
                {{end}}
            </div>
        </div>
        {{end}}

        <div class="card">
            <h2>💡 修复建议</h2>
            <ul class="recommendations">
                {{range .Recommendations}}
                <li>✅ {{.}}</li>
                {{end}}
            </ul>
        </div>
    </div>
</body>
</html>
`

	tmpl, err := template.New("report").Parse(htmlTemplate)
	if err != nil {
		return nil, err
	}

	data := map[string]interface{}{
		"ID":               report.ID,
		"Title":            report.Title,
		"Summary":          report.Summary,
		"TraceID":          report.TraceID,
		"ProblemType":      report.ProblemType,
		"Severity":         report.Severity,
		"AffectedServices": report.AffectedServices,
		"RootCause":        report.RootCause,
		"Evidence":         report.Evidence,
		"Recommendations":  report.Recommendations,
		"Timeline":         report.Timeline,
		"GeneratedAt":      report.GeneratedAt.Format("2006-01-02 15:04:05"),
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (e *ReportExporter) GetReports(ctx context.Context, limit int) ([]*types.ProblemReport, error) {
	fromRepo, ok := e.outputDir.(interface {
		GetProblemReports(ctx context.Context, limit int) ([]*types.ProblemReport, error)
	})
	if ok {
		return fromRepo.GetProblemReports(ctx, limit)
	}
	return nil, nil
}
