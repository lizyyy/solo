environment  = "production"
region       = "cn-shanghai"
instance_count = 3
instance_type = "ecs.c6.large"
enable_monitoring = true

tags = {
  Project = "production-app"
  Tier    = "web"
  Env     = "prod"
}
