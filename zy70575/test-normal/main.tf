provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  tags = {
    Name = "${var.environment}-vpc"
  }
}

resource "aws_subnet" "public" {
  count             = length(var.subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.subnet_cidrs[count.index]
  availability_zone = element(data.aws_availability_zones.available.names, count.index)

  tags = {
    Name = "${var.environment}-public-${count.index}"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

module "ec2_instance" {
  source = "./modules/ec2"

  instance_type = var.instance_type
  environment   = var.environment
  subnet_id     = aws_subnet.public[0].id
}
