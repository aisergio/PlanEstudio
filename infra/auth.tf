data "aws_secretsmanager_secret_version" "google" {
  secret_id = var.google_secret_arn
}

resource "aws_cognito_user_pool" "study" {
  name           = local.name
  user_pool_tier = "ESSENTIALS"

  username_configuration {
    case_sensitive = false
  }
  admin_create_user_config {
    allow_admin_create_user_only = true
  }
  account_recovery_setting {
    recovery_mechanism {
      name     = "admin_only"
      priority = 1
    }
  }
  lambda_config {
    pre_sign_up = aws_lambda_function.owner.arn
    pre_token_generation_config {
      lambda_arn     = aws_lambda_function.owner.arn
      lambda_version = "V2_0"
    }
  }
}

resource "aws_lambda_permission" "cognito" {
  statement_id   = "PlanEstudioCognito"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.owner.function_name
  principal      = "cognito-idp.amazonaws.com"
  source_arn     = aws_cognito_user_pool.study.arn
  source_account = data.aws_caller_identity.this.account_id
}

resource "aws_cognito_user_pool_domain" "study" {
  domain       = local.cognito
  user_pool_id = aws_cognito_user_pool.study.id
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.study.id
  provider_name = "Google"
  provider_type = "Google"
  provider_details = {
    authorize_scopes = "openid email profile"
    client_id        = jsondecode(data.aws_secretsmanager_secret_version.google.secret_string).client_id
    client_secret    = jsondecode(data.aws_secretsmanager_secret_version.google.secret_string).client_secret
  }
  attribute_mapping = {
    email          = "email"
    email_verified = "email_verified"
  }
}

resource "aws_cognito_resource_server" "mcp" {
  identifier   = "planestudio"
  name         = "Lectura de PlanEstudio"
  user_pool_id = aws_cognito_user_pool.study.id
  scope {
    scope_name        = "lectura"
    scope_description = "Consultar minutos, plan semanal y recursos de estudio."
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name                                 = "PlanEstudio Web"
  user_pool_id                         = aws_cognito_user_pool.study.id
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  supported_identity_providers         = [aws_cognito_identity_provider.google.provider_name]
  callback_urls                        = ["${local.app}/auth/callback/"]
  logout_urls                          = ["${local.app}/"]
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  access_token_validity                = 4
  id_token_validity                    = 4
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
}

resource "aws_cognito_user_pool_client" "mcp" {
  count                                = var.mcp_redirect_uri == "" ? 0 : 1
  name                                 = "PlanEstudio ChatGPT"
  user_pool_id                         = aws_cognito_user_pool.study.id
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = [local.mcp_scope]
  supported_identity_providers         = [aws_cognito_identity_provider.google.provider_name]
  callback_urls                        = [var.mcp_redirect_uri]
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  depends_on                           = [aws_cognito_resource_server.mcp]
}
