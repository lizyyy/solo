variable "db_name" {
  type        = string
  description = "数据库名称"
  default     = "appdb"
}

variable "db_user" {
  type        = string
  description = "数据库用户名"
  default     = "admin"
}

variable "db_pass" {
  type        = string
  description = "数据库密码（敏感）"
  sensitive   = true
  default     = "password123"
}

variable "storage_gb" {
  type        = number
  description = "存储容量（GB）"
  default     = 20
}

variable "backup_enabled" {
  type        = bool
  description = "是否启用备份"
  default     = true
}
