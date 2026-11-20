terraform {
  required_version = ">= 1.13, < 2.0"
  backend "local" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = { Project = "PlanEstudio" }
  }
}

data "aws_caller_identity" "this" {}

locals {
  name        = "planestudio"
  host        = "aisergio.dev"
  app         = "https://${local.host}/PlanEstudio"
  mcp_scope   = "planestudio/lectura"
  model       = "us.amazon.nova-2-lite-v1:0"
  cognito     = "${local.name}-${data.aws_caller_identity.this.account_id}"
  cognito_url = "https://${aws_cognito_user_pool_domain.study.domain}.auth.${var.aws_region}.amazoncognito.com"
  api_paths   = ["/PlanEstudio/api/*", "/PlanEstudio/mcp", "/PlanEstudio/oauth/*", "/.well-known/oauth-protected-resource/PlanEstudio/mcp", "/.well-known/oauth-authorization-server/PlanEstudio/oauth"]
}
