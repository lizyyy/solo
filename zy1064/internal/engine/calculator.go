package engine

import (
	"coupon-risk-calculator/internal/config"
	"coupon-risk-calculator/internal/models"
	"encoding/json"
	"fmt"
	"sort"
)

type CartContext struct {
	OriginalSubtotal float64
	CurrentSubtotal  float64
	TotalCost        float64
	Items            []CartItemContext
	Membership       *models.Membership
	AppliedCoupons   []*models.Coupon
	CouponDiscounts  map[uint]float64
	IsFreeShipping   bool
}

type CartItemContext struct {
	ProductID    uint
	SKU          string
	Quantity     int64
	UnitPrice    float64
	UnitCost     float64
	Category     string
	Subtotal     float64
	CurrentPrice float64
}

type CalculationEngine struct {
	cfg *config.Config
}

func NewCalculationEngine(cfg *config.Config) *CalculationEngine {
	return &CalculationEngine{cfg: cfg}
}

func (e *CalculationEngine) Calculate(
	cart *models.Cart,
	products map[uint]*models.Product,
	activeCoupons []models.Coupon,
	membership *models.Membership,
) (*models.CalculationResult, error) {
	
	if len(cart.Items) == 0 {
		return nil, models.ErrEmptyCart
	}
	
	ctx, err := e.buildCartContext(cart, products, membership)
	if err != nil {
		return nil, err
	}
	
	applicable, inapplicable := e.filterApplicableCoupons(ctx, activeCoupons)
	
	bestCombination := e.findBestCombination(ctx, applicable)
	
	result := e.buildResult(ctx, bestCombination, applicable, inapplicable)
	
	return result, nil
}

func (e *CalculationEngine) buildCartContext(
	cart *models.Cart,
	products map[uint]*models.Product,
	membership *models.Membership,
) (*CartContext, error) {
	
	ctx := &CartContext{
		CouponDiscounts: make(map[uint]float64),
		Membership:      membership,
	}
	
	var originalSubtotal, totalCost float64
	var itemCtxs []CartItemContext
	
	for _, item := range cart.Items {
		product, exists := products[item.ProductID]
		if !exists {
			product, exists = products[0]
			for _, p := range products {
				if p.SKU == item.SKU {
					product = p
					exists = true
					break
				}
			}
			if !exists {
				return nil, fmt.Errorf("product with ID %d or SKU %s not found", item.ProductID, item.SKU)
			}
		}
		
		if product.CostPrice <= 0 {
			return nil, models.NewAppError(
				models.ErrCodeUnprocessableEntity,
				models.ErrMissingCostPrice.Error(),
				fmt.Sprintf("Product %s (SKU: %s) has no valid cost price", product.Name, product.SKU),
			)
		}
		
		unitPrice := product.OriginalPrice
		if item.UnitPrice > 0 {
			unitPrice = item.UnitPrice
		}
		
		subtotal := unitPrice * float64(item.Quantity)
		itemCost := product.CostPrice * float64(item.Quantity)
		
		itemCtx := CartItemContext{
			ProductID:    product.ID,
			SKU:          product.SKU,
			Quantity:     item.Quantity,
			UnitPrice:    unitPrice,
			UnitCost:     product.CostPrice,
			Category:     product.Category,
			Subtotal:     subtotal,
			CurrentPrice: subtotal,
		}
		
		itemCtxs = append(itemCtxs, itemCtx)
		originalSubtotal += subtotal
		totalCost += itemCost
	}
	
	ctx.OriginalSubtotal = originalSubtotal
	ctx.CurrentSubtotal = originalSubtotal
	ctx.TotalCost = totalCost
	ctx.Items = itemCtxs
	
	if membership != nil && membership.DiscountRate > 0 {
		memberDiscount := originalSubtotal * membership.DiscountRate
		ctx.Membership = membership
		ctx.CurrentSubtotal = originalSubtotal - memberDiscount
	}
	
	return ctx, nil
}

func (e *CalculationEngine) filterApplicableCoupons(
	ctx *CartContext,
	coupons []models.Coupon,
) (applicable []models.Coupon, inapplicable []models.InapplicableCoupon) {
	
	for _, coupon := range coupons {
		reason := e.checkCouponApplicability(ctx, &coupon)
		if reason == "" {
			applicable = append(applicable, coupon)
		} else {
			inapplicable = append(inapplicable, models.InapplicableCoupon{
				CouponID: coupon.ID,
				Code:     coupon.Code,
				Name:     coupon.Name,
				Reason:   reason,
			})
		}
	}
	
	sort.Slice(applicable, func(i, j int) bool {
		return applicable[i].StackOrder < applicable[j].StackOrder
	})
	
	return applicable, inapplicable
}

func (e *CalculationEngine) checkCouponApplicability(
	ctx *CartContext,
	coupon *models.Coupon,
) string {
	if !coupon.IsActive {
		return "优惠券未激活"
	}
	
	subtotal := ctx.CurrentSubtotal
	
	if coupon.Type == models.CouponTypeFreeShipping {
		if coupon.Threshold > 0 && subtotal < coupon.Threshold {
			return fmt.Sprintf("订单金额 %.2f 未达到包邮门槛 %.2f", subtotal, coupon.Threshold)
		}
		return ""
	}
	
	if coupon.Threshold > 0 && subtotal < coupon.Threshold {
		return fmt.Sprintf("订单金额 %.2f 未达到优惠券门槛 %.2f", subtotal, coupon.Threshold)
	}
	
	if coupon.CategoryLimit != "" {
		hasMatchingCategory := false
		for _, item := range ctx.Items {
			if item.Category == coupon.CategoryLimit {
				hasMatchingCategory = true
				break
			}
		}
		if !hasMatchingCategory {
			return fmt.Sprintf("购物车中没有 %s 类别的商品", coupon.CategoryLimit)
		}
	}
	
	return ""
}

type Combination struct {
	Coupons      []*models.Coupon
	TotalDiscount float64
	IsFreeShipping bool
}

func (e *CalculationEngine) findBestCombination(
	ctx *CartContext,
	applicable []models.Coupon,
) *Combination {
	if len(applicable) == 0 {
		return &Combination{
			TotalDiscount:  0,
			IsFreeShipping: e.checkMembershipFreeShipping(ctx),
		}
	}
	
	var coupons []*models.Coupon
	for i := range applicable {
		coupons = append(coupons, &applicable[i])
	}
	
	var best *Combination
	best = &Combination{
		TotalDiscount:  0,
		IsFreeShipping: e.checkMembershipFreeShipping(ctx),
	}
	
	e.generateCombinations(ctx, coupons, 0, []*models.Coupon{}, best)
	
	return best
}

func (e *CalculationEngine) generateCombinations(
	ctx *CartContext,
	coupons []*models.Coupon,
	index int,
	current []*models.Coupon,
	best *Combination,
) {
	if index >= len(coupons) {
		e.evaluateCombination(ctx, current, best)
		return
	}
	
	e.generateCombinations(ctx, coupons, index+1, current, best)
	
	if e.canAddCoupon(current, coupons[index]) {
		newCurrent := append(append([]*models.Coupon{}, current...), coupons[index])
		e.generateCombinations(ctx, coupons, index+1, newCurrent, best)
	}
}

func (e *CalculationEngine) canAddCoupon(
	current []*models.Coupon,
	coupon *models.Coupon,
) bool {
	if coupon.MutexGroup == "" {
		return true
	}
	
	for _, c := range current {
		if c.MutexGroup == coupon.MutexGroup {
			return false
		}
	}
	return true
}

func (e *CalculationEngine) evaluateCombination(
	ctx *CartContext,
	coupons []*models.Coupon,
	best *Combination,
) {
	sort.Slice(coupons, func(i, j int) bool {
		return coupons[i].StackOrder < coupons[j].StackOrder
	})
	
	currentPrice := ctx.CurrentSubtotal
	totalDiscount := 0.0
	isFreeShipping := e.checkMembershipFreeShipping(ctx)
	
	for _, coupon := range coupons {
		discount := e.calculateCouponDiscount(coupon, currentPrice, ctx)
		if discount > 0 {
			currentPrice -= discount
			totalDiscount += discount
		}
		if coupon.Type == models.CouponTypeFreeShipping || coupon.FreeShipping {
			isFreeShipping = true
		}
	}
	
	if totalDiscount > best.TotalDiscount || 
		(totalDiscount == best.TotalDiscount && isFreeShipping && !best.IsFreeShipping) {
		best.Coupons = make([]*models.Coupon, len(coupons))
		copy(best.Coupons, coupons)
		best.TotalDiscount = totalDiscount
		best.IsFreeShipping = isFreeShipping
	}
}

func (e *CalculationEngine) calculateCouponDiscount(
	coupon *models.Coupon,
	currentPrice float64,
	ctx *CartContext,
) float64 {
	switch coupon.Type {
	case models.CouponTypeFullReduction:
		if currentPrice >= coupon.Threshold {
			return coupon.DiscountValue
		}
		return 0
		
	case models.CouponTypeDiscount:
		applicablePrice := currentPrice
		if coupon.CategoryLimit != "" {
			applicablePrice = 0
			for _, item := range ctx.Items {
				if item.Category == coupon.CategoryLimit {
					applicablePrice += item.CurrentPrice
				}
			}
		}
		if coupon.Threshold > 0 && applicablePrice < coupon.Threshold {
			return 0
		}
		return applicablePrice * (1 - coupon.DiscountRate)
		
	case models.CouponTypeFreeShipping:
		return 0
		
	default:
		return 0
	}
}

func (e *CalculationEngine) checkMembershipFreeShipping(ctx *CartContext) bool {
	if ctx.Membership == nil {
		return false
	}
	if ctx.Membership.FreeShippingThreshold <= 0 {
		return true
	}
	return ctx.OriginalSubtotal >= ctx.Membership.FreeShippingThreshold
}

func (e *CalculationEngine) buildResult(
	ctx *CartContext,
	bestCombination *Combination,
	applicable []models.Coupon,
	inapplicable []models.InapplicableCoupon,
) *models.CalculationResult {
	
	memberDiscount := ctx.OriginalSubtotal - ctx.CurrentSubtotal
	totalDiscount := memberDiscount + bestCombination.TotalDiscount
	finalPrice := ctx.OriginalSubtotal - totalDiscount
	grossMargin := finalPrice - ctx.TotalCost
	
	var grossMarginRate float64
	if finalPrice > 0 {
		grossMarginRate = grossMargin / finalPrice
	}
	
	riskLevel := e.calculateRiskLevel(grossMarginRate)
	
	var appliedCoupons []models.AppliedCoupon
	for order, coupon := range bestCombination.Coupons {
		discount := e.calculateCouponDiscount(coupon, ctx.CurrentSubtotal, ctx)
		appliedCoupons = append(appliedCoupons, models.AppliedCoupon{
			CouponID:   coupon.ID,
			Code:       coupon.Code,
			Name:       coupon.Name,
			Discount:   discount,
			ApplyOrder: order + 1,
		})
	}
	
	var allInapplicable []models.InapplicableCoupon
	allInapplicable = append(allInapplicable, inapplicable...)
	
	for _, coupon := range applicable {
		found := false
		for _, c := range bestCombination.Coupons {
			if c.ID == coupon.ID {
				found = true
				break
			}
		}
		if !found {
			reason := e.explainUnusedCoupon(&coupon, bestCombination, applicable)
			allInapplicable = append(allInapplicable, models.InapplicableCoupon{
				CouponID: coupon.ID,
				Code:     coupon.Code,
				Name:     coupon.Name,
				Reason:   reason,
			})
		}
	}
	
	explanation := e.buildExplanation(ctx, bestCombination, grossMargin, grossMarginRate, riskLevel)
	
	result := &models.CalculationResult{
		OriginalSubtotal:    ctx.OriginalSubtotal,
		MembershipDiscount:  memberDiscount,
		TotalDiscount:       totalDiscount,
		FinalPrice:          finalPrice,
		TotalCost:           ctx.TotalCost,
		GrossMargin:         grossMargin,
		GrossMarginRate:     grossMarginRate,
		IsFreeShipping:      bestCombination.IsFreeShipping,
		RiskLevel:           string(riskLevel),
		AppliedCoupons:      appliedCoupons,
		InapplicableCoupons: allInapplicable,
		Explanation:         explanation,
	}
	
	detailsJSON, _ := json.Marshal(map[string]interface{}{
		"membership":         ctx.Membership,
		"best_combination":   bestCombination.Coupons,
		"total_discount":     totalDiscount,
	})
	result.DetailsJSON = string(detailsJSON)
	
	return result
}

func (e *CalculationEngine) calculateRiskLevel(marginRate float64) models.RiskLevel {
	if marginRate < e.cfg.HighRiskMargin {
		return models.RiskHigh
	} else if marginRate < e.cfg.MediumRiskMargin {
		return models.RiskMedium
	}
	return models.RiskLow
}

func (e *CalculationEngine) explainUnusedCoupon(
	coupon *models.Coupon,
	bestCombination *Combination,
	applicable []models.Coupon,
) string {
	if coupon.MutexGroup != "" {
		for _, c := range bestCombination.Coupons {
			if c.MutexGroup == coupon.MutexGroup {
				return fmt.Sprintf("与已选用券 %s(%s) 互斥，属于同一互斥组 %s", c.Name, c.Code, coupon.MutexGroup)
			}
		}
	}
	
	return "选用其他组合可获得更大优惠"
}

func (e *CalculationEngine) buildExplanation(
	ctx *CartContext,
	bestCombination *Combination,
	grossMargin float64,
	marginRate float64,
	riskLevel models.RiskLevel,
) string {
	explanation := ""
	
	if ctx.Membership != nil && ctx.Membership.DiscountRate > 0 {
		explanation += fmt.Sprintf("会员等级 %s 享受 %.0f%% 折扣；", 
			ctx.Membership.Name, ctx.Membership.DiscountRate*100)
	}
	
	if len(bestCombination.Coupons) > 0 {
		explanation += "最优组合包含："
		for i, c := range bestCombination.Coupons {
			if i > 0 {
				explanation += "、"
			}
			explanation += fmt.Sprintf("%s(%s)", c.Name, c.Code)
		}
		explanation += "；"
	} else {
		explanation += "无适用优惠券；"
	}
	
	if bestCombination.IsFreeShipping {
		if ctx.Membership != nil && e.checkMembershipFreeShipping(ctx) {
			explanation += "会员免邮；"
		} else {
			explanation += "使用包邮券；"
		}
	}
	
	explanation += fmt.Sprintf("毛利率 %.2f%% (%.2f 元)，", marginRate*100, grossMargin)
	
	switch riskLevel {
	case models.RiskHigh:
		explanation += fmt.Sprintf("风险等级【高】：毛利率低于 %.0f%% 警戒线，请警惕亏损风险！", 
			e.cfg.HighRiskMargin*100)
	case models.RiskMedium:
		explanation += fmt.Sprintf("风险等级【中】：毛利率低于 %.0f%%，建议再优化活动策略。", 
			e.cfg.MediumRiskMargin*100)
	case models.RiskLow:
		explanation += fmt.Sprintf("风险等级【低】：毛利率在安全范围内。")
	}
	
	return explanation
}
