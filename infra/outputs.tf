output "site" {
  value = "${local.app}/"
}
output "bucket" {
  value = aws_s3_bucket.study.bucket
}
output "distribution" {
  value = aws_cloudfront_distribution.study.id
}
output "cloudfront_domain" {
  value = aws_cloudfront_distribution.study.domain_name
}
output "google_redirect_uri" {
  value = "${local.cognito_url}/oauth2/idpresponse"
}
output "mcp_client_id" {
  value = try(aws_cognito_user_pool_client.mcp[0].id, "")
}
output "mcp_url" {
  value = "${local.app}/mcp"
}
