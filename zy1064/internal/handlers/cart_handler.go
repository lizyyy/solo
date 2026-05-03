package handlers

import (
	"coupon-risk-calculator/internal/database"
	"coupon-risk-calculator/internal/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CartHandler struct {
	repo *database.CartRepo
}

func NewCartHandler(db *gorm.DB) *CartHandler {
	return &CartHandler{
		repo: database.NewCartRepo(db),
	}
}

type ImportCartsRequest struct {
	Carts []struct {
		Name             string                 `json:"name" binding:"required"`
		MembershipLevel  models.MembershipLevel `json:"membership_level"`
		Items            []CartItemRequest      `json:"items" binding:"required"`
		AppliedCoupons   []string               `json:"applied_coupons"`
		Notes            string                 `json:"notes"`
	} `json:"carts" binding:"required"`
}

type CartItemRequest struct {
	ProductID uint    `json:"product_id"`
	SKU       string  `json:"sku"`
	Quantity  int64   `json:"quantity" binding:"required"`
	UnitPrice float64 `json:"unit_price"`
}

func (h *CartHandler) ImportCarts(c *gin.Context) {
	var req ImportCartsRequest
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
	
	var carts []*models.Cart
	for _, cartReq := range req.Carts {
		var items []models.CartItem
		for _, itemReq := range cartReq.Items {
			items = append(items, models.CartItem{
				ProductID: itemReq.ProductID,
				SKU:       itemReq.SKU,
				Quantity:  itemReq.Quantity,
				UnitPrice: itemReq.UnitPrice,
			})
		}
		
		carts = append(carts, &models.Cart{
			Name:            cartReq.Name,
			MembershipLevel: cartReq.MembershipLevel,
			Items:           items,
			AppliedCoupons:  cartReq.AppliedCoupons,
			Notes:           cartReq.Notes,
		})
	}
	
	if err := h.repo.BulkCreate(carts); err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "购物车导入成功",
		"count":   len(carts),
	})
}

func (h *CartHandler) ListCarts(c *gin.Context) {
	carts, err := h.repo.List()
	if err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    carts,
	})
}

func (h *CartHandler) GetCart(c *gin.Context) {
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
	
	cart, err := h.repo.FindByID(uint(id))
	if err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    cart,
	})
}

func (h *CartHandler) DeleteCart(c *gin.Context) {
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
		"message": "购物车已删除",
	})
}
