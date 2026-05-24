import os
code = """package main

import (
	\"crypto/sha256\"
	\"database/sql\"
	\"fmt\"
	\"log\"
	\"os\"
	\"time\"

	\"github.com/gin-gonic/gin\"
	\"github.com/google/uuid\"
	_ \"github.com/mattn/go-sqlite3\"
)

var db *sql.DB

func main() {
	initDB()
	r := gin.Default()
	setupCORS(r)
	setupRoutes(r)
	log.Println(\"Server starting on port 8080...\")
	r.Run(\":8080\")
}
\"""
with open("main.go", "w") as f:
    f.write(code)
print("done")
