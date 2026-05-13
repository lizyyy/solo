package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/gin-gonic/gin"

	"strategy-explainer/engine"
	"strategy-explainer/models"
)

var e = engine.New()

func genID(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func Health(c *gin.Context) {
	c.JSON(200, gin.H{"status": "ok"})
}

func ListStrategies(c *gin.Context) {
	c.JSON(200, models.ListStrategies())
}

func GetStrategy(c *gin.Context) {
	id := c.Param("id")
	s, ok := models.GetStrategy(id)
	if !ok {
		c.JSON(404, gin.H{"error": "strategy not found"})
		return
	}
	c.JSON(200, s)
}

func CreateStrategy(c *gin.Context) {
	var req models.CreateStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	s := &models.Strategy{
		ID:               "strat-" + genID(6),
		Name:             req.Name,
		Type:             req.Type,
		Description:      req.Description,
		CurrentVersion:   1,
		PublishedVersion: 0,
		CreatedAt:        now,
		UpdatedAt:        now,
		Versions: []models.StrategyVersion{
			{
				Version:    1,
				Status:     models.StatusDraft,
				Rules:      req.Rules,
				CreatedAt:  now,
			},
		},
	}
	models.SaveStrategy(s)
	c.JSON(201, s)
}

func UpdateStrategy(c *gin.Context) {
	id := c.Param("id")
	s, ok := models.GetStrategy(id)
	if !ok {
		c.JSON(404, gin.H{"error": "strategy not found"})
		return
	}
	var req models.UpdateStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	nextVer := s.CurrentVersion + 1
	now := time.Now()
	s.Versions = append(s.Versions, models.StrategyVersion{
		Version:   nextVer,
		Status:    models.StatusDraft,
		Rules:     req.Rules,
		CreatedAt: now,
	})
	if req.Description != "" {
		s.Description = req.Description
	}
	s.CurrentVersion = nextVer
	models.SaveStrategy(s)
	c.JSON(200, s)
}

func PublishStrategy(c *gin.Context) {
	id := c.Param("id")
	s, ok := models.GetStrategy(id)
	if !ok {
		c.JSON(404, gin.H{"error": "strategy not found"})
		return
	}
	var req models.PublishStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	found := false
	now := time.Now()
	for i := range s.Versions {
		if s.Versions[i].Version == req.Version {
			found = true
			if s.Versions[i].Status == models.StatusFrozen {
				c.JSON(400, gin.H{"error": "cannot publish frozen version"})
				return
			}
			s.Versions[i].Status = models.StatusPublished
			s.Versions[i].PublishedAt = &now
			break
		}
	}
	if !found {
		c.JSON(404, gin.H{"error": "version not found"})
		return
	}
	s.PublishedVersion = req.Version
	models.SaveStrategy(s)
	c.JSON(200, s)
}

func FreezeStrategy(c *gin.Context) {
	id := c.Param("id")
	s, ok := models.GetStrategy(id)
	if !ok {
		c.JSON(404, gin.H{"error": "strategy not found"})
		return
	}
	var req models.FreezeStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	found := false
	now := time.Now()
	for i := range s.Versions {
		if s.Versions[i].Version == req.Version {
			found = true
			if s.Versions[i].Status != models.StatusPublished {
				c.JSON(400, gin.H{"error": "only published version can be frozen"})
				return
			}
			s.Versions[i].Status = models.StatusFrozen
			s.Versions[i].FrozenAt = &now
			break
		}
	}
	if !found {
		c.JSON(404, gin.H{"error": "version not found"})
		return
	}
	models.SaveStrategy(s)
	c.JSON(200, s)
}

func RollbackStrategy(c *gin.Context) {
	id := c.Param("id")
	s, ok := models.GetStrategy(id)
	if !ok {
		c.JSON(404, gin.H{"error": "strategy not found"})
		return
	}
	var req models.RollbackStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	found := false
	for _, v := range s.Versions {
		if v.Version == req.ToVersion {
			found = true
			if v.Status != models.StatusPublished {
				c.JSON(400, gin.H{"error": "can only rollback to a published version"})
				return
			}
			if v.Status == models.StatusFrozen {
				c.JSON(400, gin.H{"error": "cannot rollback to a frozen version"})
				return
			}
			break
		}
	}
	if !found {
		c.JSON(404, gin.H{"error": "target version not found"})
		return
	}
	s.PublishedVersion = req.ToVersion
	models.SaveStrategy(s)
	c.JSON(200, s)
}

func Decide(c *gin.Context) {
	var req models.DecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	existing, ok := models.GetDecisionByRequestID(req.RequestID)
	if ok {
		c.JSON(200, gin.H{
			"decision_id":             existing.DecisionID,
			"decision":                existing.Decision,
			"simple_explanation":      existing.SimpleExplanation,
			"detailed_explanation":    existing.DetailedExplanation,
			"strategy_version":        existing.StrategyVersion,
			"is_replay":               true,
		})
		return
	}

	s, ok := models.GetStrategy(req.StrategyID)
	if !ok {
		c.JSON(404, gin.H{"error": "strategy not found"})
		return
	}
	if s.PublishedVersion == 0 {
		c.JSON(400, gin.H{"error": "strategy has no published version"})
		return
	}

	result, err := e.Decide(s, &req)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	result.DecisionID = "dec-" + genID(10)
	models.SaveDecision(result)

	c.JSON(200, gin.H{
		"decision_id":             result.DecisionID,
		"decision":                result.Decision,
		"simple_explanation":      result.SimpleExplanation,
		"detailed_explanation":    result.DetailedExplanation,
		"strategy_version":        result.StrategyVersion,
		"is_replay":               false,
	})
}

func QueryDecision(c *gin.Context) {
	var q models.QueryDecisionRequest
	if err := c.ShouldBindQuery(&q); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var d *models.DecisionResult
	var ok bool
	if q.DecisionID != "" {
		d, ok = models.GetDecisionByID(q.DecisionID)
	} else if q.RequestID != "" {
		d, ok = models.GetDecisionByRequestID(q.RequestID)
	} else {
		c.JSON(400, gin.H{"error": "decision_id or request_id required"})
		return
	}

	if !ok {
		c.JSON(404, gin.H{"error": "decision not found"})
		return
	}

	c.JSON(200, gin.H{
		"decision_id":          d.DecisionID,
		"strategy_id":          d.StrategyID,
		"strategy_type":        d.StrategyType,
		"decision":             d.Decision,
		"strategy_version":     d.StrategyVersion,
		"request_id":           d.RequestID,
		"simple_explanation":   d.SimpleExplanation,
		"detailed_explanation": d.DetailedExplanation,
		"decided_at":           d.DecidedAt,
		"rule_results":         d.RuleResults,
		"context":              d.Context,
	})
}

func ListStrategiesHandler() gin.HandlerFunc { return ListStrategies }
func HealthHandler() gin.HandlerFunc          { return Health }
