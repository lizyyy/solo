package api

import (
	"errors"
	"net/http"
	"presigned-link-governance/model"
	"presigned-link-governance/repository"
	"presigned-link-governance/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

var linkService = service.NewLinkService()
var fileRepo = repository.NewFileRepository()
var issuerRepo = repository.NewIssuerRepository()

func SetupRouter() *gin.Engine {
	r := gin.Default()

	api := r.Group("/api/v1")
	{
		files := api.Group("/files")
		{
			files.POST("", CreateFile)
			files.GET("", ListFiles)
			files.GET("/:id", GetFile)
		}

		issuers := api.Group("/issuers")
		{
			issuers.POST("", CreateIssuer)
			issuers.GET("", ListIssuers)
			issuers.GET("/:id", GetIssuer)
		}

		links := api.Group("/links")
		{
			links.POST("", CreateLink)
			links.GET("", ListLinks)
			links.GET("/:id", GetLink)
			links.POST("/:id/revoke", RevokeLink)
			links.GET("/:id/logs", GetLinkAccessLogs)
		}

		access := api.Group("/access")
		{
			access.GET("/validate/:token", ValidateLink)
			access.GET("/logs", ListAccessLogs)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return r
}

func CreateFile(c *gin.Context) {
	var file model.FileObject
	if err := c.ShouldBindJSON(&file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := fileRepo.Create(&file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, file)
}

func ListFiles(c *gin.Context) {
	files, err := fileRepo.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, files)
}

func GetFile(c *gin.Context) {
	id := c.Param("id")
	file, err := fileRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	c.JSON(http.StatusOK, file)
}

func CreateIssuer(c *gin.Context) {
	var issuer model.Issuer
	if err := c.ShouldBindJSON(&issuer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := issuerRepo.Create(&issuer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, issuer)
}

func ListIssuers(c *gin.Context) {
	issuers, err := issuerRepo.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, issuers)
}

func GetIssuer(c *gin.Context) {
	id := c.Param("id")
	issuer, err := issuerRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "issuer not found"})
		return
	}
	c.JSON(http.StatusOK, issuer)
}

func CreateLink(c *gin.Context) {
	var req service.CreateLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	link, err := linkService.CreateLink(req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrFileNotFound), errors.Is(err, service.ErrIssuerNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrInvalidMaxAccess):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusCreated, link)
}

func ListLinks(c *gin.Context) {
	links, err := linkService.ListLinks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, links)
}

func GetLink(c *gin.Context) {
	id := c.Param("id")
	link, err := linkService.GetLink(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "link not found"})
		return
	}
	c.JSON(http.StatusOK, link)
}

func RevokeLink(c *gin.Context) {
	id := c.Param("id")
	var req service.RevokeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.LinkID = id

	link, err := linkService.RevokeLink(req)
	if err != nil {
		if errors.Is(err, service.ErrLinkNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, link)
}

func GetLinkAccessLogs(c *gin.Context) {
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	logs, err := linkService.GetAccessLogs(id, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logs)
}

func ValidateLink(c *gin.Context) {
	token := c.Param("token")
	clientIP := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	result, err := linkService.ValidateLink(token, clientIP, userAgent)
	if err != nil && result == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !result.Valid {
		c.JSON(http.StatusForbidden, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

func ListAccessLogs(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	logs, count, err := linkService.ListAccessLogs(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": count,
		"limit": limit,
		"offset": offset,
	})
}
