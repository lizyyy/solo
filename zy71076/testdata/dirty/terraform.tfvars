app_name    = "production-app"
environment = "production"
instance_size = "large"
replicas    = 3

feature_flags = {
  new_ui   = true
  beta_api = true
  caching  = true
}
