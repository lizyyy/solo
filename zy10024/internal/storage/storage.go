package storage

import (
	"database/sql"
)

func InitMySQL(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS test_orders (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id INT NOT NULL,
		status VARCHAR(50) NOT NULL DEFAULT 'pending',
		amount DECIMAL(10,2) NOT NULL DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		INDEX idx_user_id (user_id),
		INDEX idx_status (status)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

	CREATE TABLE IF NOT EXISTS test_users (
		id INT AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(100) NOT NULL,
		balance DECIMAL(10,2) NOT NULL DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

	CREATE TABLE IF NOT EXISTS config_history (
		id INT AUTO_INCREMENT PRIMARY KEY,
		key_name VARCHAR(255) NOT NULL,
		old_value TEXT,
		new_value TEXT,
		drifted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		INDEX idx_key_name (key_name),
		INDEX idx_drifted_at (drifted_at)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`
	
	_, err := db.Exec(schema)
	if err != nil {
		return err
	}
	
	initSeedData(db)
	
	return nil
}

func initSeedData(db *sql.DB) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM test_users").Scan(&count)
	if err != nil || count > 0 {
		return
	}
	
	tx, err := db.Begin()
	if err != nil {
		return
	}
	defer tx.Rollback()
	
	for i := 1; i <= 100; i++ {
		_, err := tx.Exec("INSERT INTO test_users (name, balance) VALUES (?, ?)", 
			"user_"+string(rune('A'+i%26))+string(rune('0'+i%10)), 
			float64(i*100))
		if err != nil {
			return
		}
		
		for j := 0; j < 3; j++ {
			_, err = tx.Exec("INSERT INTO test_orders (user_id, status, amount) VALUES (?, ?, ?)",
				i, "pending", float64(j*50+10))
			if err != nil {
				return
			}
		}
	}
	
	tx.Commit()
}
