package handlers

import (
	"coupon-risk-calculator/internal/database"
	"coupon-risk-calculator/internal/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CouponHandler struct {
	repo *database.CouponRepo
}

func NewCouponHandler(db *gorm.DB) *CouponHandler {
	return &CouponHandler{
		repo: database.NewCouponRepo(db),
	}
}

type ImportCouponsRequest struct {
	Coupons []struct {
		Code          string             `json:"code" binding:"required"`
		Name          string             `json:"name" binding:"required"`
		Type          models.CouponType  `json:"type" binding:"required"`
		Threshold     float64            `json:"threshold"`
		DiscountValue float64            `json:"discount_value"`
		DiscountRate  float64            `json:"discount_rate"`
		FreeShipping  bool               `json:"free_shipping"`
		CategoryLimit string             `json:"category_limit"`
		MutexGroup    string             `json:"mutex_group"`
		StackOrder    int                `json:"stack_order"`
		IsActive      bool               `json:"is_active"`
		Description   string             `json:"description"`
	} `json:"coupons" binding:"required"`
}

func (h *CouponHandler) ImportCoupons(c *gin.Context) {
	var req ImportCouponsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    http.StatusBadRequest,
				"message": "请求参数错误",
				"details": err.Error(),
			},
		})
		return
	}
	
	var coupons []*models.Coupon
	for _, cp := range req.Coupons {
		coupons = append(coupons, &models.Coupon{
			Code:          cp.Code,
			Name:          cp.Name,
			Type:          cp.Type,
			Threshold:     cp.Threshold,
			DiscountValue: cp.DiscountValue,
			DiscountRate:  cp.DiscountRate,
			FreeShipping:  cp.FreeShipping,
			CategoryLimit: cp.CategoryLimit,
			MutexGroup:    cp.MutexGroup,
			StackOrder:    cp.StackOrder,
			IsActive:      cp.IsActive,
			Description:   cp.Description,
		})
	}
	
	if err := h.repo.BulkCreate(coupons); err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "优惠券导入成功",
		"count":   len(coupons),
	})
}

func (h *CouponHandler) ListCoupons(c *gin.Context) {
	coupons, err := h.repo.List()
	if err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    coupons,
	})
}

func (h *CouponHandler) GetCoupon(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    http.StatusBadRequest,
				"message": "无效的ID",
				"details": err.Error(),
			},
		})
		return
	}
	
	coupon, err := h.repo.FindByID(uint(id))
	if err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    coupon,
	})
}

func (h *CouponHandler) DeleteCoupon(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    http.StatusBadRequest,
				"message": "无效的ID",
				"details": err.Error(),
			},
		})
		return
	}
	
	if err := h.repo.Delete(uint(id)); err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "优惠券已删除",
	})
}
