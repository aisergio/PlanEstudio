mock_provider "cloudflare" {}

variables {
  cloudfront_domain     = "d123example.cloudfront.net"
  cloudflare_zone_id    = "0123456789abcdef0123456789abcdef"
  cloudflare_account_id = "0123456789abcdef0123456789abcdef"
}

run "rutas_de_planestudio" {
  command = plan

  assert {
    condition     = length(cloudflare_worker_route.study) == 4 && length(cloudflare_record.study) == 0
    error_message = "Publica el sitio y el descubrimiento OAuth conservando el DNS existente por defecto."
  }
}
