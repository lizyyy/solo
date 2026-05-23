package handlers

import (
	"car-wash-queue-api/models"
	"car-wash-queue-api/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func CreateMember(c *gin.Context) {
	var req struct {
		Name    string  `json:"name" binding:"required"`
		Phone   string  `json:"phone" binding:"required"`
		Level   string  `json:"level"`
		Balance float64 `json:"balance"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "请求参数错误",
			Conclusion: "必填参数缺失",
		})
		return
	}

	if req.Level == "" {
		req.Level = "普通会员"
	}

	member, err := services.CreateMember(req.Name, req.Phone, req.Level, req.Balance)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "创建会员失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    member,
	})
}

func GetMemberList(c *gin.Context) {
	members, err := services.GetMemberList()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "查询会员列表失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    members,
	})
}

func GetMemberByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的会员ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	member, err := services.GetMemberByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Success:    false,
			Message:    "会员不存在",
			Conclusion: "找不到对应会员记录",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    member,
	})
}

func GetMemberByPhone(c *gin.Context) {
	phone := c.Param("phone")

	member, err := services.GetMemberByPhone(phone)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Success:    false,
			Message:    "会员不存在",
			Conclusion: "找不到对应会员记录",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    member,
	})
}

func UpdateMember(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的会员ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "请求参数错误",
			Conclusion: "JSON格式错误",
		})
		return
	}

	member, err := services.UpdateMember(id, data)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "更新会员失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    member,
	})
}
