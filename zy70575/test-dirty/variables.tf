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

this is a syntax error line that should be caught

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"
}

another invalid line without proper HCL

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "unused_var" {
  description = "This variable is never used"
  type        = string
  default     = "nothing"
}
