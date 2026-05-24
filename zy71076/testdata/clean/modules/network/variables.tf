variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR块"
  default     = "10.0.0.0/16"
}

variable "subnet_count" {
  type        = number
  description = "子网数量"
  default     = 2
}

variable "enable_nat" {
  type        = bool
  description = "是否启用NAT网关"
  default     = false
}

variable "network_tags" {
  type        = map(string)
  description = "网络资源标签"
  default = {
    Component = "network"
  }
}
