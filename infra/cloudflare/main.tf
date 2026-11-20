terraform {
  required_version = ">= 1.13, < 2.0"
  backend "local" {}

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.52.5"
    }
  }
}

locals {
  name = "planestudio"
  host = "aisergio.dev"
}

variable "cloudfront_domain" {
  type        = string
  description = "Salida cloudfront_domain del despliegue de AWS."
  validation {
    condition     = can(regex("^[a-z0-9]+\\.cloudfront\\.net$", var.cloudfront_domain))
    error_message = "Indica el nombre de la distribución de CloudFront, sin protocolo ni ruta."
  }
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.cloudflare_zone_id)) && can(regex("^[a-f0-9]{32}$", var.cloudflare_account_id))
    error_message = "Indica los identificadores de zona y cuenta de Cloudflare."
  }
}

variable "cloudflare_create_apex_record" {
  description = "Crea un registro con proxy para Workers cuando el dominio raíz carece de registros web."
  type        = bool
  default     = false
}

resource "cloudflare_worker_script" "study" {
  account_id         = var.cloudflare_account_id
  name               = local.name
  content            = file("${path.module}/worker.mjs")
  module             = true
  compatibility_date = "2026-01-01"
  plain_text_binding {
    name = "CLOUDFRONT_HOST"
    text = var.cloudfront_domain
  }
}

resource "cloudflare_record" "study" {
  count           = var.cloudflare_create_apex_record ? 1 : 0
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
  for_each = toset([
    "/PlanEstudio",
    "/PlanEstudio/*",
    "/.well-known/oauth-protected-resource/PlanEstudio/mcp*",
    "/.well-known/oauth-authorization-server/PlanEstudio/oauth*"
  ])
  zone_id     = var.cloudflare_zone_id
  pattern     = "${local.host}${each.value}"
  script_name = cloudflare_worker_script.study.name
}
