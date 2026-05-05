package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gmp-simulator/backend/internal/model"
	"github.com/gmp-simulator/backend/internal/simulator"
	"gorm.io/gorm"
)

// GetExperiments 获取所有实验
func GetExperiments(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var experiments []model.Experiment
		if err := db.Order("created_at DESC").Find(&experiments).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, experiments)
	}
}

// GetExperiment 获取单个实验
func GetExperiment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		var experiment model.Experiment
		if err := db.First(&experiment, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Experiment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, experiment)
	}
}

// CreateExperiment 创建实验
func CreateExperiment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var config model.SimulationConfig
		if err := c.ShouldBindJSON(&config); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		experiment := model.Experiment{
			Name:             config.Name,
			Description:      config.Description,
			GOMAXPROCS:       config.GOMAXPROCS,
			NumP:             config.NumP,
			NumM:             config.NumM,
			NumG:             config.NumG,
			EnableSyscall:    config.EnableSyscall,
			EnableNetpoll:    config.EnableNetpoll,
			EnableGCAssist:   config.EnableGCAssist,
			EnablePreemption: config.EnablePreemption,
			Status:           "created",
		}

		if config.GOMAXPROCS == 0 {
			experiment.GOMAXPROCS = 1
		}
		if config.NumP == 0 {
			experiment.NumP = experiment.GOMAXPROCS
		}
		if config.NumM == 0 {
			experiment.NumM = experiment.NumP
		}
		if config.NumG == 0 {
			experiment.NumG = 10
		}

		if err := db.Create(&experiment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, experiment)
	}
}

// UpdateExperiment 更新实验
func UpdateExperiment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		var experiment model.Experiment
		if err := db.First(&experiment, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Experiment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if experiment.Status == "running" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot update running experiment"})
			return
		}

		var config model.SimulationConfig
		if err := c.ShouldBindJSON(&config); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		experiment.Name = config.Name
		experiment.Description = config.Description
		if config.GOMAXPROCS > 0 {
			experiment.GOMAXPROCS = config.GOMAXPROCS
		}
		if config.NumP > 0 {
			experiment.NumP = config.NumP
		}
		if config.NumM > 0 {
			experiment.NumM = config.NumM
		}
		if config.NumG > 0 {
			experiment.NumG = config.NumG
		}
		experiment.EnableSyscall = config.EnableSyscall
		experiment.EnableNetpoll = config.EnableNetpoll
		experiment.EnableGCAssist = config.EnableGCAssist
		experiment.EnablePreemption = config.EnablePreemption

		if err := db.Save(&experiment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, experiment)
	}
}

// DeleteExperiment 删除实验
func DeleteExperiment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		result := db.Delete(&model.Experiment{}, uint(id))
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
			return
		}
		if result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Experiment not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Experiment deleted successfully"})
	}
}

// StartExperiment 开始实验
func StartExperiment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		var experiment model.Experiment
		if err := db.First(&experiment, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Experiment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if experiment.Status == "running" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Experiment is already running"})
			return
		}

		sim, err := simulator.NewSimulator(&experiment, db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create simulator: " + err.Error()})
			return
		}

		now := time.Now()
		experiment.Status = "running"
		experiment.StartTime = &now
		if err := db.Save(&experiment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		go func() {
			sim.Run()
		}()

		c.JSON(http.StatusOK, gin.H{"message": "Experiment started", "experiment": experiment})
	}
}

// PauseExperiment 暂停实验
func PauseExperiment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		var experiment model.Experiment
		if err := db.First(&experiment, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Experiment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if experiment.Status != "running" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Experiment is not running"})
			return
		}

		experiment.Status = "paused"
		if err := db.Save(&experiment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Experiment paused", "experiment": experiment})
	}
}

// StopExperiment 停止实验
func StopExperiment(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		var experiment model.Experiment
		if err := db.First(&experiment, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Experiment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if experiment.Status == "completed" || experiment.Status == "stopped" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Experiment is already stopped"})
			return
		}

		now := time.Now()
		experiment.Status = "stopped"
		experiment.EndTime = &now
		if err := db.Save(&experiment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Experiment stopped", "experiment": experiment})
	}
}
