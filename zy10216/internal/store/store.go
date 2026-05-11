package store

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"lensrent/internal/models"

	"gopkg.in/yaml.v3"
)

const (
	dataDir     = "data"
	dbFile      = "lensrent_db.yaml"
	defaultFee  = 50.0
	defaultOverdueMultiplier = 1.5
)

type Store struct {
	dbPath     string
	accessoryFee float64
	overdueRate  float64
}

func New() *Store {
	return &Store{
		dbPath:       filepath.Join(dataDir, dbFile),
		accessoryFee: defaultFee,
		overdueRate:  defaultOverdueMultiplier,
	}
}

func (s *Store) ensureDataDir() error {
	return os.MkdirAll(dataDir, 0755)
}

func (s *Store) Load() (*models.Database, error) {
	if err := s.ensureDataDir(); err != nil {
		return nil, fmt.Errorf("创建数据目录失败: %w", err)
	}

	data, err := os.ReadFile(s.dbPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &models.Database{
				Equipments:   []models.Equipment{},
				Renters:      []models.Renter{},
				Rentals:      []models.Rental{},
				Disputes:     []models.DisputeRecord{},
				LastModified: time.Now().Format(time.RFC3339),
			}, nil
		}
		return nil, fmt.Errorf("读取数据库失败: %w", err)
	}

	var db models.Database
	if err := yaml.Unmarshal(data, &db); err != nil {
		return nil, fmt.Errorf("解析数据库失败: %w", err)
	}

	return &db, nil
}

func (s *Store) Save(db *models.Database) error {
	if err := s.ensureDataDir(); err != nil {
		return fmt.Errorf("创建数据目录失败: %w", err)
	}

	db.LastModified = time.Now().Format(time.RFC3339)

	data, err := yaml.Marshal(db)
	if err != nil {
		return fmt.Errorf("序列化数据库失败: %w", err)
	}

	if err := os.WriteFile(s.dbPath, data, 0644); err != nil {
		return fmt.Errorf("写入数据库失败: %w", err)
	}

	return nil
}

func (s *Store) GetAccessoryFee() float64 {
	return s.accessoryFee
}

func (s *Store) GetOverdueRate() float64 {
	return s.overdueRate
}
