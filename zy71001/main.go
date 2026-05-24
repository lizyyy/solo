package main

import (
	"database/sql"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

func main() {
	initDB()
	g := gin.Default()
	setupCORS(g)
	setupRoutes(g)
	log.Println("Server starting on :8080")
	g.Run(":8080")
}
