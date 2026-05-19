package controllers

import (
	"net/http"

	"customs-reconciliation/internal/services"

	"github.com/gin-gonic/gin"
)

type ImportController struct {
	importService *services.ImportService
}

func NewImportController() *ImportController {
	return &ImportController{
		importService: services.NewImportService(),
	}
}

func (c *ImportController) ImportDeclarationCSV(ctx *gin.Context) {
	batchID := ctx.Param("id")

	file, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	src, err := file.Open()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	result, err := c.importService.ImportDeclarationsFromCSV(src, batchID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *ImportController) ImportTariffJSON(ctx *gin.Context) {
	batchID := ctx.Param("id")

	file, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	src, err := file.Open()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	result, err := c.importService.ImportTariffsFromJSON(src, batchID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *ImportController) ImportReturnReceiptJSON(ctx *gin.Context) {
	batchID := ctx.Param("id")

	file, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	src, err := file.Open()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	result, err := c.importService.ImportReturnReceiptsFromJSON(src, batchID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}
