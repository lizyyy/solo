package handlers

import (
	"coupon-risk-calculator/internal/database"
	"coupon-risk-calculator/internal/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MemberHandler struct {
	repo *database.MembershipRepo
}

func NewMemberHandler(db *gorm.DB) *MemberHandler {
	return &MemberHandler{
		repo: database.NewMembershipRepo(db),
	}
}

type ImportMembershipsRequest struct {
	Memberships []struct {
		Level               models.MembershipLevel `json:"level" binding:"required"`
		Name                string                 `json:"name" binding:"required"`
		DiscountRate        float64                `json:"discount_rate"`
		FreeShippingThreshold float64              `json:"free_shipping_threshold"`
		Description         string                 `json:"description"`
	} `json:"memberships" binding:"required"`
}

func (h *MemberHandler) ImportMemberships(c *gin.Context) {
	var req ImportMembershipsRequest
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
	
	var memberships []*models.Membership
	for _, m := range req.Memberships {
		memberships = append(memberships, &models.Membership{
			Level:               m.Level,
			Name:                m.Name,
			DiscountRate:        m.DiscountRate,
			FreeShippingThreshold: m.FreeShippingThreshold,
			Description:         m.Description,
		})
	}
	
	if err := h.repo.BulkCreate(memberships); err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "会员等级导入成功",
		"count":   len(memberships),
	})
}

func (h *MemberHandler) ListMemberships(c *gin.Context) {
	memberships, err := h.repo.List()
	if err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    memberships,
	})
}

func (h *MemberHandler) GetMembership(c *gin.Context) {
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
	
	membership, err := h.repo.FindByID(uint(id))
	if err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    membership,
	})
}

func (h *MemberHandler) DeleteMembership(c *gin.Context) {
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
		"message": "会员等级已删除",
	})
}
