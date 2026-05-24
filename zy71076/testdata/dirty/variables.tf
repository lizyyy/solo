variable "app_name" {
  type        = string
  description = "应用名称"
  default     = "my-app"
}

variable "environment" {
  type        = string
  description = "部署环境"
  default     = "dev"
}

variable "db_password" {
  type        = string
  description = "数据库密码（敏感）"
  sensitive   = true
  default     = "changeme"
}

variable "instance_size" {
  type        = string
  description = "实例规格"
  default     = "small"
}

variable "replicas" {
  type        = number
  description = "副本数量"
  default     = 1
}

variable "secret_key" {
  type        = string
  description = "应用密钥（敏感）"
  sensitive   = true
}

variable "feature_flags" {
  type        = map(bool)
  description = "功能开关"
  default = {
    new_ui    = false
    beta_api  = false
    caching   = true
  }
}
