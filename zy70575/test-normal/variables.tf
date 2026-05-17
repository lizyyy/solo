variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidrs" {
  description = "Subnet CIDRs"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "unused_var" {
  description = "This variable is never used"
  type        = string
  default     = "nothing"
}

variable "no_default_used" {
  description = "This variable has no default but is used"
  type        = string
}

variable "no_default_unused" {
  description = "This variable has no default and is unused"
  type        = number
}
