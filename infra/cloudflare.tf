resource "cloudflare_worker_script" "study" {
  count              = var.cloudflare_zone_id == "" ? 0 : 1
  account_id         = var.cloudflare_account_id
  name               = local.name
  content            = file("${path.module}/cloudflare-worker.mjs")
  module             = true
  compatibility_date = "2026-01-01"
  plain_text_binding {
    name = "CLOUDFRONT_HOST"
    text = aws_cloudfront_distribution.study.domain_name
  }
}

resource "cloudflare_record" "study" {
  count           = var.cloudflare_zone_id != "" && var.cloudflare_create_apex_record ? 1 : 0
  zone_id         = var.cloudflare_zone_id
  name            = local.host
  type            = "A"
  content         = "192.0.2.1"
  proxied         = true
  ttl             = 1
  allow_overwrite = false
  comment         = "Recepción de solicitudes para Workers"
}

resource "cloudflare_worker_route" "study" {
  for_each = var.cloudflare_zone_id == "" ? toset([]) : toset([
    "/PlanEstudio",
    "/PlanEstudio/*",
    "/.well-known/oauth-protected-resource/PlanEstudio/mcp*",
    "/.well-known/oauth-authorization-server/PlanEstudio/oauth*"
  ])
  zone_id     = var.cloudflare_zone_id
  pattern     = "${local.host}${each.value}"
  script_name = cloudflare_worker_script.study[0].name
}
