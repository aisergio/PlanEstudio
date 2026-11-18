resource "aws_s3_bucket" "study" {
  bucket = "${local.name}-${data.aws_caller_identity.this.account_id}-us-east-1"
}

resource "aws_s3_bucket_public_access_block" "study" {
  bucket                  = aws_s3_bucket.study.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "study" {
  bucket = aws_s3_bucket.study.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "study" {
  bucket = aws_s3_bucket.study.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_dynamodb_table" "study" {
  name                        = local.name
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "owner"
  range_key                   = "key"
  deletion_protection_enabled = true
  attribute {
    name = "owner"
    type = "S"
  }
  attribute {
    name = "key"
    type = "S"
  }
  point_in_time_recovery {
    enabled                 = true
    recovery_period_in_days = 7
  }
}

resource "random_password" "origin" {
  length  = 48
  special = false
}

resource "aws_bedrock_inference_profile" "study" {
  count       = var.enable_bedrock ? 1 : 0
  name        = local.name
  description = "Tutor Nova 2 Lite de PlanEstudio"
  model_source {
    copy_from = "arn:aws:bedrock:us-east-1:${data.aws_caller_identity.this.account_id}:inference-profile/${local.model}"
  }
}

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/../.build/lambda/index.js"
  output_path = "${path.module}/../.build/planestudio.zip"
}

locals {
  lambda_names = { api = "${local.name}-api", owner = "${local.name}-owner" }
  lambda_trust = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role" "lambda" {
  for_each           = local.lambda_names
  name               = each.value
  assume_role_policy = local.lambda_trust
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = local.lambda_names
  name              = "/aws/lambda/${each.value}"
  retention_in_days = 14
}

resource "aws_iam_role_policy" "logs" {
  for_each = local.lambda_names
  name     = "logs"
  role     = aws_iam_role.lambda[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = ["${aws_cloudwatch_log_group.lambda[each.key].arn}:*"]
    }]
  })
}

resource "aws_iam_role_policy" "data" {
  name = "PlanEstudioData"
  role = aws_iam_role.lambda["api"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:DeleteItem"], Resource = aws_dynamodb_table.study.arn },
      { Effect = "Allow", Action = ["s3:GetObject"], Resource = "${aws_s3_bucket.study.arn}/private/library.json" }
      ], var.enable_bedrock ? [
      { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = aws_bedrock_inference_profile.study[0].arn },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = [for model in aws_bedrock_inference_profile.study[0].models : model.model_arn]
        Condition = {
          ArnEquals = { "bedrock:InferenceProfileArn" = aws_bedrock_inference_profile.study[0].arn }
        }
      }
    ] : [])
  })
}

resource "aws_lambda_function" "owner" {
  function_name    = local.lambda_names.owner
  role             = aws_iam_role.lambda["owner"].arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 5
  memory_size      = 256
  environment {
    variables = { OWNER_EMAIL = var.owner_email }
  }
  depends_on = [aws_iam_role_policy.logs]
}

resource "aws_lambda_function" "api" {
  function_name                  = local.lambda_names.api
  role                           = aws_iam_role.lambda["api"].arn
  runtime                        = "nodejs22.x"
  handler                        = "index.handler"
  filename                       = data.archive_file.lambda.output_path
  source_code_hash               = data.archive_file.lambda.output_base64sha256
  timeout                        = 28
  memory_size                    = 256
  reserved_concurrent_executions = 5
  environment {
    variables = {
      APP_URL           = local.app
      STUDY_BUCKET      = aws_s3_bucket.study.bucket
      STUDY_TABLE       = aws_dynamodb_table.study.name
      COGNITO_DOMAIN    = "https://${aws_cognito_user_pool_domain.study.domain}.auth.us-east-1.amazoncognito.com"
      USER_POOL         = aws_cognito_user_pool.study.id
      WEB_CLIENT        = aws_cognito_user_pool_client.web.id
      MCP_CLIENT        = try(aws_cognito_user_pool_client.mcp[0].id, "")
      MCP_REDIRECT      = var.mcp_redirect_uri
      MCP_SCOPE         = local.mcp_scope
      BEDROCK_MODEL     = try(aws_bedrock_inference_profile.study[0].arn, "")
      WORKER_TOKEN_HASH = var.worker_token_hash
      ORIGIN_SECRET     = random_password.origin.result
    }
  }
  depends_on = [aws_iam_role_policy.logs, aws_iam_role_policy.data]
}

resource "aws_apigatewayv2_api" "study" {
  name          = local.name
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "study" {
  api_id                 = aws_apigatewayv2_api.study.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}

resource "aws_apigatewayv2_route" "study" {
  api_id    = aws_apigatewayv2_api.study.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.study.id}"
}

resource "aws_apigatewayv2_stage" "study" {
  api_id      = aws_apigatewayv2_api.study.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 12
    throttling_rate_limit  = 5
  }
}

resource "aws_lambda_permission" "api" {
  statement_id   = "PlanEstudioGateway"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.api.function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${aws_apigatewayv2_api.study.execution_arn}/*"
  source_account = data.aws_caller_identity.this.account_id
}
