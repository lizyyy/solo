package handlers

import (
	"coupon-risk-calculator/internal/database"
	"coupon-risk-calculator/internal/models"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ReportHandler struct {
	resultRepo  *database.CalculationResultRepo
	productRepo *database.ProductRepo
	couponRepo  *database.CouponRepo
	cartRepo    *database.CartRepo
}

func NewReportHandler(db *gorm.DB) *ReportHandler {
	return &ReportHandler{
		resultRepo:  database.NewCalculationResultRepo(db),
		productRepo: database.NewProductRepo(db),
		couponRepo:  database.NewCouponRepo(db),
		cartRepo:    database.NewCartRepo(db),
	}
}

func (h *ReportHandler) ExportJSON(c *gin.Context) {
	results, err := h.resultRepo.List()
	if err != nil {
		c.Error(err)
		return
	}
	
	highRisk, mediumRisk, lowRisk, err := h.resultRepo.GetRiskSummary()
	if err != nil {
		c.Error(err)
		return
	}
	
	var totalMargin float64
	for _, r := range results {
		totalMargin += r.GrossMargin
	}
	
	avgMargin := 0.0
	if len(results) > 0 {
		avgMargin = totalMargin / float64(len(results))
	}
	
	report := gin.H{
		"generated_at": time.Now().Format(time.RFC3339),
		"summary": gin.H{
			"total_calculations": len(results),
			"high_risk":          highRisk,
			"medium_risk":        mediumRisk,
			"low_risk":           lowRisk,
			"avg_margin":         avgMargin,
		},
		"results": results,
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    report,
	})
}

func (h *ReportHandler) ExportMarkdown(c *gin.Context) {
	results, err := h.resultRepo.List()
	if err != nil {
		c.Error(err)
		return
	}
	
	highRisk, mediumRisk, lowRisk, err := h.resultRepo.GetRiskSummary()
	if err != nil {
		c.Error(err)
		return
	}
	
	var totalMargin float64
	for _, r := range results {
		totalMargin += r.GrossMargin
	}
	
	avgMargin := 0.0
	if len(results) > 0 {
		avgMargin = totalMargin / float64(len(results))
	}
	
	markdown := h.generateMarkdownReport(results, highRisk, mediumRisk, lowRisk, avgMargin)
	
	c.Header("Content-Type", "text/markdown; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=coupon-risk-report-%s.md", time.Now().Format("20060102")))
	c.String(http.StatusOK, markdown)
}

func (h *ReportHandler) generateMarkdownReport(
	results []models.CalculationResult,
	highRisk, mediumRisk, lowRisk int64,
	avgMargin float64,
) string {
	markdown := fmt.Sprintf(`# 优惠券叠加风险试算报告

> 生成时间：%s

## 风险概览

| 风险等级 | 数量 | 占比 |
|---------|------|------|
| 🔴 高风险 | %d | %.1f%% |
| 🟡 中风险 | %d | %.1f%% |
| 🟢 低风险 | %d | %.1f%% |
| **总计** | **%d** | **100%%** |

### 关键指标

- **平均毛利率**: %.2f%%
- **高风险订单数**: %d
- **中风险订单数**: %d
`,
		time.Now().Format("2006-01-02 15:04:05"),
		highRisk, float64(highRisk)/float64(len(results))*100,
		mediumRisk, float64(mediumRisk)/float64(len(results))*100,
		lowRisk, float64(lowRisk)/float64(len(results))*100,
		len(results),
		avgMargin*100,
		highRisk,
		mediumRisk,
	)
	
	if highRisk > 0 {
		markdown += `
## 🔴 高风险订单详情

以下订单毛利率过低，存在亏损风险，请重点关注：

`
		for _, r := range results {
			if r.RiskLevel == string(models.RiskHigh) {
				markdown += fmt.Sprintf(`### 购物车 %d

- **原始金额**: ¥%.2f
- **最终金额**: ¥%.2f
- **总成本**: ¥%.2f
- **毛利**: ¥%.2f (%.2f%%)
- **免邮**: %s
- **说明**: %s

`,
					r.CartID,
					r.OriginalSubtotal,
					r.FinalPrice,
					r.TotalCost,
					r.GrossMargin,
					r.GrossMarginRate*100,
					formatBool(r.IsFreeShipping),
					r.Explanation,
				)
			}
		}
	}
	
	if mediumRisk > 0 {
		markdown += `
## 🟡 中风险订单详情

以下订单毛利率偏低，建议优化：

`
		for _, r := range results {
			if r.RiskLevel == string(models.RiskMedium) {
				markdown += fmt.Sprintf(`### 购物车 %d

- **原始金额**: ¥%.2f
- **最终金额**: ¥%.2f
- **总成本**: ¥%.2f
- **毛利**: ¥%.2f (%.2f%%)
- **免邮**: %s
- **说明**: %s

`,
					r.CartID,
					r.OriginalSubtotal,
					r.FinalPrice,
					r.TotalCost,
					r.GrossMargin,
					r.GrossMarginRate*100,
					formatBool(r.IsFreeShipping),
					r.Explanation,
				)
			}
		}
	}
	
	markdown += `
## 风险等级说明

- **高风险 (🔴)**: 毛利率 < 5% - 极可能亏损，强烈建议调整活动策略
- **中风险 (🟡)**: 5% ≤ 毛利率 < 15% - 利润微薄，建议优化
- **低风险 (🟢)**: 毛利率 ≥ 15% - 利润安全

---
*此报告由优惠券风险试算系统自动生成*
`
	
	return markdown
}

func formatBool(b bool) string {
	if b {
		return "是"
	}
	return "否"
}
