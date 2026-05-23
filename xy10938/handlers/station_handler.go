package handlers

import (
	"car-wash-queue-api/models"
	"car-wash-queue-api/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func CreateStation(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "请求参数错误",
			Conclusion: "必填参数缺失",
		})
		return
	}

	station, err := services.CreateStation(req.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "创建工位失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    station,
	})
}

func GetStationList(c *gin.Context) {
	stations, err := services.GetStationList()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "查询工位列表失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stations,
	})
}

func GetStationByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的工位ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	station, err := services.GetStationByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Success:    false,
			Message:    "工位不存在",
			Conclusion: "找不到对应工位记录",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    station,
	})
}

func UpdateStation(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的工位ID",
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

	station, err := services.UpdateStation(id, data)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "更新工位失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    station,
	})
}
