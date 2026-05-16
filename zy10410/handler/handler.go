package handler

import (
	"net/http"
	"task-recovery-api/service"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func CreateTask(c *gin.Context) {
	var req service.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	task, err := service.CreateTask(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "创建成功", Data: task})
}

func GetTask(c *gin.Context) {
	id := c.Param("id")
	task, err := service.GetTaskByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Message: "任务不存在"})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "查询成功", Data: task})
}

func QueryTasks(c *gin.Context) {
	var filter service.TaskQueryFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	tasks, total, err := service.QueryTasks(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Message: "查询失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "查询成功",
		Data:    gin.H{"list": tasks, "total": total},
	})
}

func UpdateStatus(c *gin.Context) {
	var req service.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	task, err := service.UpdateStatus(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "状态更新成功", Data: task})
}

func ManualFix(c *gin.Context) {
	var req service.ManualFixRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	task, err := service.ManualFix(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "人工修正成功", Data: task})
}

func GetImpactSummary(c *gin.Context) {
	id := c.Param("id")
	summary, err := service.CalculateImpact(id)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Message: "任务不存在"})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "查询成功", Data: summary})
}

func GetReport(c *gin.Context) {
	id := c.Param("id")
	report, err := service.GenerateReport(id)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Message: "任务不存在"})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "查询成功", Data: report})
}

func ExportReport(c *gin.Context) {
	id := c.Param("id")
	report, err := service.ExportReport(id)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Message: "任务不存在"})
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=recovery-report-"+id+".json")
	c.String(http.StatusOK, report)
}

func DetectMissTask(c *gin.Context) {
	var req struct {
		TaskName      string `json:"task_name" binding:"required"`
		ScheduledTime string `json:"scheduled_time" binding:"required"`
		Operator      string `json:"operator"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	task, err := service.DetectMissTasks(req.TaskName, req.ScheduledTime, req.Operator)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, Response{Code: 200, Message: "检测成功", Data: task})
}
