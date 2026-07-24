resource "aws_rds_cluster" "main" {
  cluster_identifier  = "${var.app_name}-${var.environment}"
  engine              = "aurora-postgresql"
  engine_mode         = "serverless"
  database_name       = var.app_name
  master_username     = var.app_name
  master_password     = random_password.db_password.result
  skip_final_snapshot = true

  scaling_configuration {
    auto_pause               = true
    max_capacity             = 4
    min_capacity             = 0.5
    seconds_until_auto_pause = 3600
  }
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${var.app_name}-${var.environment}"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
}
