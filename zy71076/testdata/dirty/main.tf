module "database" {
  source = "./modules/database"

  db_name     = "production_db"
  db_user     = "prod_admin"
  db_pass     = "prod-secure-pass-2024"
  storage_gb  = 100
  backup_enabled = true
}
