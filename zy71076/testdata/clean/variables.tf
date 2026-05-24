variable "environment" {
  type        = string
  description = "部署环境名称"
  default     = "development"
}

variable "region" {
  type        = string
  description = "云服务区域"
  default     = "cn-beijing"
}

variable "instance_count" {
  type        = number
  description = "ECS实例数量"
  default     = 1
}

variable "instance_type" {
  type        = string
  description = "ECS实例规格"
  default     = "ecs.t5.large"
}

variable "api_key" {
  type        = string
  description = "API密钥（敏感）"
  sensitive   = true
  default     = "default-key-123"
}

variable "enable_monitoring" {
  type        = bool
  description = "是否启用监控"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "资源标签"
  default = {
    Project = "demo"
    Owner   = "devops"
  }
}
