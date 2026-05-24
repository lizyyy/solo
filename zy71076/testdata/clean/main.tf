module "network" {
  source = "./modules/network"

  vpc_cidr     = "172.16.0.0/16"
  subnet_count = 3
  enable_nat   = true

  network_tags = {
    Project = "production-app"
  }
}
