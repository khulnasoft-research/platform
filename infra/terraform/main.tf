terraform {
  required_version = ">= 1.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "random_password" "redis_password" {
  length  = 24
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}
