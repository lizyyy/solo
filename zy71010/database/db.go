package database

import (
	"database/sql"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}

	if err = DB.Ping(); err != nil {
		return err
	}

	_, err = DB.Exec(Schema)
	if err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
