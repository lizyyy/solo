package service

import (
	"cache-risk-analyzer/internal/db"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type FullReport struct {
	GeneratedAt       time.Time          `json:"generated_at"`
	Summary           ReportSummary      `json:"summary"`
	Risks             []ReportRisk       `json:"risks"`
	StrategyRankings  []StrategyRanking  `json:"strategy_rankings"`
	CurrentMetrics    *SimulationMetrics `json:"current_metrics"`
	Recommendations   []Recommendation   `json:"recommendations"`
	ManualCheckPoints []ManualCheckPoint `json:"manual_check_points"`
}

type ReportSummary struct {
	TotalRisks      int64   `json:"total_risks"`
	CriticalCount   int64   `json:"critical_count"`
	HighCount       int64   `json:"high_count"`
	MediumCount     int64   `json:"medium_count"`
	LowCount        int64   `json:"low_count"`
	MaxImpactScore  float64 `json:"max_impact_score"`
	TopRiskType     string  `json:"top_risk_type"`
	AffectedDomains int     `json:"affected_domains_count"`
}

type ReportRisk struct {
	RiskType          string                 `json:"risk_type"`
	Severity          string                 `json:"severity"`
	BusinessDomain    string                 `json:"business_domain"`
	CacheKey          string                 `json:"cache_key,omitempty"`
	Evidence          map[string]interface{} `json:"evidence"`
	ImpactScore       float64                `json:"impact_score"`
	RecommendedAction string                 `json:"recommended_action"`
	DetectedAt        time.Time              `json:"detected_at"`
}

type Recommendation struct {
	Priority     string   `json:"priority"`
	StrategyType string   `json:"strategy_type"`
	Description  string   `json:"description"`
	ExpectedGain string   `json:"expected_gain"`
	ActionItems  []string `json:"action_items"`
}

type ManualCheckPoint struct {
	Category    string `json:"category"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

func GenerateFullReport() (*FullReport, error) {
	report := &FullReport{
		GeneratedAt: time.Now(),
	}

	analysisResult, err := AnalyzeAllRisks()
	if err != nil {
		return nil, err
	}

	report.Risks = make([]ReportRisk, len(analysisResult.Risks))
	for i, r := range analysisResult.Risks {
		report.Risks[i] = ReportRisk{
			RiskType:          r.RiskType,
			Severity:          r.Severity,
			BusinessDomain:    r.BusinessDomain,
			CacheKey:          r.CacheKey,
			Evidence:          r.Evidence,
			ImpactScore:       r.ImpactScore,
			RecommendedAction: r.RecommendedAction,
			DetectedAt:        r.DetectedAt,
		}
	}

	report.Summary = ReportSummary{
		TotalRisks:      analysisResult.TotalRisks,
		CriticalCount:   analysisResult.Critical,
		HighCount:       analysisResult.High,
		MediumCount:     analysisResult.Medium,
		LowCount:        analysisResult.Low,
		MaxImpactScore:  analysisResult.Summary.MaxImpactScore,
		AffectedDomains: len(analysisResult.Summary.AffectedDomains),
	}

	if len(analysisResult.Summary.TopRisks) > 0 {
		report.Summary.TopRiskType = analysisResult.Summary.TopRisks[0]
	}

	database := db.GetDB()
	currentMetrics, _ := collectCurrentMetrics(database, "")
	report.CurrentMetrics = currentMetrics

	compareResult, _ := CompareAllStrategies("")
	report.StrategyRankings = compareResult.Rankings

	report.Recommendations = generateRecommendations(analysisResult, compareResult)
	report.ManualCheckPoints = generateManualCheckPoints(analysisResult)

	return report, nil
}

func generateRecommendations(analysis *RiskAnalysisResult, compare *CompareResult) []Recommendation {
	var recs []Recommendation

	for _, r := range analysis.Risks {
		if r.Severity == "CRITICAL" || r.Severity == "HIGH" {
			switch r.RiskType {
			case "CACHE_PENETRATION":
				recs = append(recs, Recommendation{
					Priority:     "CRITICAL",
					StrategyType: "bloom_filter",
					Description:  "缓存穿透风险较高，存在大量无效key访问",
					ExpectedGain: "预计拦截 80-90% 的无效key请求",
					ActionItems: []string{
						"部署布隆过滤器，key白名单校验",
						"实现短TTL负缓存（30-60秒）",
						"增加请求参数合法性校验",
					},
				})
			case "HOT_KEY_BREAKDOWN":
				recs = append(recs, Recommendation{
					Priority:     "CRITICAL",
					StrategyType: "hot_key_prewarm",
					Description:  fmt.Sprintf("热点key击穿风险: %s", r.CacheKey),
					ExpectedGain: "热点key命中率提升至 99%+",
					ActionItems: []string{
						"识别并预热TOP热点key",
						"热点key使用本地缓存 + 分布式缓存二级缓存",
						"延长热点key TTL或使用永不过期策略",
					},
				})
			case "TTL_AVALANCHE":
				recs = append(recs, Recommendation{
					Priority:     "HIGH",
					StrategyType: "ttl_jitter",
					Description:  "TTL集中过期，存在雪崩风险",
					ExpectedGain: "雪崩窗口减少 70-90%",
					ActionItems: []string{
						"为所有key的TTL增加随机抖动（±10-30%）",
						"分批次设置过期时间",
						"使用stale-while-revalidate策略",
					},
				})
			case "NEGATIVE_CACHE_MISSING":
				recs = append(recs, Recommendation{
					Priority:     "HIGH",
					StrategyType: "negative_cache",
					Description:  "高频未命中key缺少负缓存",
					ExpectedGain: "减少 40-60% 的无效回源",
					ActionItems: []string{
						"为不存在的key设置短TTL负缓存",
						"定期清理过期的负缓存",
					},
				})
			case "MUTEX_WAIT_RISK":
				recs = append(recs, Recommendation{
					Priority:     "MEDIUM",
					StrategyType: "mutex_lock",
					Description:  "并发回源等待风险",
					ExpectedGain: "并发回源减少 60-80%",
					ActionItems: []string{
						"使用single-flight模式合并重复请求",
						"实现公平锁避免饥饿",
						"设置合理的锁超时时间",
					},
				})
			case "STALE_WHILE_REVALIDATE_BENEFIT":
				recs = append(recs, Recommendation{
					Priority:     "MEDIUM",
					StrategyType: "stale_while_revalidate",
					Description:  "高命中率key可受益于异步刷新",
					ExpectedGain: "用户感知延迟降低 50%+",
					ActionItems: []string{
						"为高命中率key启用stale-while-revalidate",
						"设置合理的stale时间窗口",
						"监控异步刷新成功率",
					},
				})
			}
		}
	}

	if len(compare.Rankings) > 0 {
		best := compare.Rankings[0]
		recs = append(recs, Recommendation{
			Priority:     "RECOMMENDED",
			StrategyType: best.StrategyType,
			Description:  fmt.Sprintf("综合评分最高策略: %s (得分: %.2f)", best.StrategyType, best.Score),
			ExpectedGain: strings.Join(best.KeyImprovements, ", "),
			ActionItems: []string{
				"评估该策略的实施成本",
				"在测试环境验证效果",
				"制定灰度上线计划",
			},
		})
	}

	return recs
}

func generateManualCheckPoints(analysis *RiskAnalysisResult) []ManualCheckPoint {
	checks := []ManualCheckPoint{
		{
			Category:    "数据验证",
			Description: "确认导入的事件时间范围覆盖完整促销周期",
			Status:      "PENDING",
		},
		{
			Category:    "数据验证",
			Description: "验证后端容量指标（QPS上限、连接数）与实际一致",
			Status:      "PENDING",
		},
		{
			Category:    "策略验证",
			Description: "确认布隆过滤器的误判率设置（建议0.01-0.05）",
			Status:      "PENDING",
		},
		{
			Category:    "策略验证",
			Description: "确认互斥锁的超时时间不会导致用户体验问题",
			Status:      "PENDING",
		},
		{
			Category:    "监控",
			Description: "确认促销期间的监控告警阈值已调整",
			Status:      "PENDING",
		},
		{
			Category:    "应急预案",
			Description: "确认降级开关和熔断策略已就绪",
			Status:      "PENDING",
		},
	}

	for _, r := range analysis.Risks {
		if r.Severity == "CRITICAL" {
			checks = append(checks, ManualCheckPoint{
				Category:    "高风险跟进",
				Description: fmt.Sprintf("跟进 %s 风险: %s", r.RiskType, r.RecommendedAction[:min(50, len(r.RecommendedAction))]),
				Status:      "URGENT",
			})
		}
	}

	return checks
}

func GenerateMarkdownReport(report *FullReport) string {
	var sb strings.Builder

	sb.WriteString("# 缓存风险分析报告\n\n")
	sb.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", report.GeneratedAt.Format("2006-01-02 15:04:05")))

	sb.WriteString("## 一、风险概览\n\n")
	sb.WriteString("| 指标 | 值 |\n")
	sb.WriteString("|------|-----|\n")
	sb.WriteString(fmt.Sprintf("| 风险总数 | %d |\n", report.Summary.TotalRisks))
	sb.WriteString(fmt.Sprintf("| CRITICAL | %d |\n", report.Summary.CriticalCount))
	sb.WriteString(fmt.Sprintf("| HIGH | %d |\n", report.Summary.HighCount))
	sb.WriteString(fmt.Sprintf("| MEDIUM | %d |\n", report.Summary.MediumCount))
	sb.WriteString(fmt.Sprintf("| LOW | %d |\n", report.Summary.LowCount))
	sb.WriteString(fmt.Sprintf("| 最大影响分数 | %.2f |\n", report.Summary.MaxImpactScore))
	sb.WriteString(fmt.Sprintf("| 主要风险类型 | %s |\n", report.Summary.TopRiskType))
	sb.WriteString("\n")

	sb.WriteString("## 二、当前指标\n\n")
	if report.CurrentMetrics != nil {
		sb.WriteString("| 指标 | 值 |\n")
		sb.WriteString("|------|-----|\n")
		sb.WriteString(fmt.Sprintf("| 命中率 | %.2f%% |\n", report.CurrentMetrics.HitRate*100))
		sb.WriteString(fmt.Sprintf("| 未命中率 | %.2f%% |\n", report.CurrentMetrics.MissRate*100))
		sb.WriteString(fmt.Sprintf("| 后端平均延迟 | %.1f ms |\n", report.CurrentMetrics.BackendLatencyAvgMS))
		sb.WriteString(fmt.Sprintf("| 雪崩窗口大小 | %d keys |\n", report.CurrentMetrics.AvalancheWindowSize))
		sb.WriteString(fmt.Sprintf("| 最大并发未命中 | %d |\n", report.CurrentMetrics.MaxConcurrentMisses))
		sb.WriteString(fmt.Sprintf("| 热点key未命中率 | %.2f%% |\n", report.CurrentMetrics.HotKeyMissRate*100))
		sb.WriteString("\n")
	}

	sb.WriteString("## 三、风险详情\n\n")

	severityEmoji := map[string]string{
		"CRITICAL": "🔴",
		"HIGH":     "🟠",
		"MEDIUM":   "🟡",
		"LOW":      "🟢",
	}

	for _, r := range report.Risks {
		emoji := severityEmoji[r.Severity]
		sb.WriteString(fmt.Sprintf("### %s %s - %s\n\n", emoji, r.RiskType, r.Severity))
		sb.WriteString(fmt.Sprintf("- **业务域**: %s\n", r.BusinessDomain))
		if r.CacheKey != "" {
			sb.WriteString(fmt.Sprintf("- **关联Key**: %s\n", r.CacheKey))
		}
		sb.WriteString(fmt.Sprintf("- **影响分数**: %.2f\n", r.ImpactScore))
		sb.WriteString(fmt.Sprintf("- **检测时间**: %s\n", r.DetectedAt.Format("2006-01-02 15:04:05")))
		sb.WriteString(fmt.Sprintf("- **建议动作**: %s\n\n", r.RecommendedAction))

		if len(r.Evidence) > 0 {
			sb.WriteString("**证据**:\n")
			sb.WriteString("```json\n")
			evidenceJSON, _ := json.MarshalIndent(r.Evidence, "", "  ")
			sb.WriteString(string(evidenceJSON))
			sb.WriteString("\n```\n\n")
		}
	}

	sb.WriteString("## 四、策略对比排名\n\n")
	sb.WriteString("| 排名 | 策略类型 | 综合得分 | 关键改进 |\n")
	sb.WriteString("|------|----------|----------|----------|\n")
	for _, s := range report.StrategyRankings {
		improvements := strings.Join(s.KeyImprovements, "; ")
		if len(improvements) > 50 {
			improvements = improvements[:50] + "..."
		}
		sb.WriteString(fmt.Sprintf("| %d | %s | %.2f | %s |\n", s.Rank, s.StrategyType, s.Score, improvements))
	}
	sb.WriteString("\n")

	sb.WriteString("## 五、推荐方案\n\n")
	for i, rec := range report.Recommendations {
		priorityEmoji := map[string]string{
			"CRITICAL":    "🔴",
			"HIGH":        "🟠",
			"MEDIUM":      "🟡",
			"RECOMMENDED": "⭐",
		}
		emoji := priorityEmoji[rec.Priority]

		sb.WriteString(fmt.Sprintf("### %d. %s %s (%s)\n\n", i+1, emoji, rec.StrategyType, rec.Priority))
		sb.WriteString(fmt.Sprintf("**描述**: %s\n\n", rec.Description))
		sb.WriteString(fmt.Sprintf("**预期收益**: %s\n\n", rec.ExpectedGain))
		sb.WriteString("**行动项**:\n")
		for j, item := range rec.ActionItems {
			sb.WriteString(fmt.Sprintf("  %d. %s\n", j+1, item))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("## 六、人工检查清单\n\n")
	sb.WriteString("| 类别 | 描述 | 状态 |\n")
	sb.WriteString("|------|------|------|\n")
	for _, cp := range report.ManualCheckPoints {
		sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n", cp.Category, cp.Description, cp.Status))
	}
	sb.WriteString("\n")

	sb.WriteString("---\n\n")
	sb.WriteString("*此报告由缓存风险分析系统自动生成*\n")

	return sb.String()
}
