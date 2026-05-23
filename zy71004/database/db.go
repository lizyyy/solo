package database

import (
	"database/sql"
	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}
	return createTables()
}

func createTables() error { return nil }

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}
