provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  tags = {
    Name = "${var.environment}-vpc"
  }
}

this line has var.undefined_ref that doesn't exist

module "ec2_instance" {
  source = "./modules/ec2"

  instance_type = var.instance_type
  environment   = var.environment
}

another_bad_line_here with syntax problem
