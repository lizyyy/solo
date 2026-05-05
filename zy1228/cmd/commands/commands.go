package commands

import (
	"concurrency-inspector/internal/storage"
)

var store *storage.SQLiteStorage

func SetStorage(s *storage.SQLiteStorage) {
	store = s
}
