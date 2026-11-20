mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_data "aws_secretsmanager_secret_version" {
    defaults = { secret_string = "{\"client_id\":\"cliente-de-prueba\",\"client_secret\":\"ficticio\"}" }
  }
  mock_resource "aws_bedrock_inference_profile" {
    defaults = {
      arn    = "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/test"
      models = [{ model_arn = "arn:aws:bedrock:us-east-2::foundation-model/amazon.nova-2-lite-v1:0" }]
    }
  }
}
mock_provider "archive" {}
mock_provider "random" {}

variables {
  owner_email       = "estudiante@gmail.com"
  google_secret_arn = "arn:aws:secretsmanager:us-east-2:123456789012:secret:planestudio/google-test"
  mcp_redirect_uri  = "https://chatgpt.com/example-return"
}

run "infraestructura_con_presupuesto" {
  command = plan

  assert {
    condition     = aws_budgets_budget.study.limit_amount == "10" && aws_budgets_budget.study.time_unit == "MONTHLY"
    error_message = "El presupuesto debe ser de 10 USD al mes."
  }
  assert {
    condition     = toset([for item in aws_budgets_budget.study.notification : item.threshold]) == toset([60, 80, 100])
    error_message = "Configura los avisos al 60 %, 80 % y 100 %."
  }
  assert {
    condition     = length(aws_budgets_budget.study.cost_filter) == 0 && !aws_budgets_budget.study.cost_types[0].include_credit
    error_message = "Mide todos los cargos de la cuenta del proyecto antes de los créditos."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.study.block_public_policy && aws_s3_bucket_public_access_block.study.block_public_acls
    error_message = "El bucket debe ser privado."
  }
  assert {
    condition     = aws_cognito_user_pool_client.mcp[0].allowed_oauth_scopes == toset(["planestudio/lectura"])
    error_message = "ChatGPT solo necesita el permiso de lectura."
  }
}

run "despliegue_inicial_sin_credenciales" {
  command = plan

  variables {
    google_secret_arn = null
    mcp_redirect_uri  = ""
    enable_bedrock    = false
  }

  assert {
    condition     = length(aws_cognito_user_pool_client.web) == 0 && length(aws_cognito_user_pool_client.mcp) == 0
    error_message = "La cuenta requiere configurar Google antes de habilitar clientes OAuth."
  }
  assert {
    condition     = output.google_redirect_uri == "https://planestudio-123456789012.auth.us-east-2.amazoncognito.com/oauth2/idpresponse"
    error_message = "El retorno de Google debe usar Ohio para este despliegue."
  }
}
