resource "aws_cloudfront_origin_access_control" "study" {
  name                              = local.name
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "study" {
  name    = local.name
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/viewer.js")
}

resource "aws_cloudfront_response_headers_policy" "study" {
  name = "PlanEstudio"
  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      preload                    = false
      override                   = true
    }
  }
}

resource "aws_cloudfront_distribution" "study" {
  enabled         = true
  comment         = "PlanEstudio"
  is_ipv6_enabled = true
  price_class     = "PriceClass_100"

  origin {
    origin_id                = "static"
    domain_name              = aws_s3_bucket.study.bucket_regional_domain_name
    origin_path              = "/site"
    origin_access_control_id = aws_cloudfront_origin_access_control.study.id
  }

  origin {
    origin_id   = "api"
    domain_name = trimprefix(aws_apigatewayv2_api.study.api_endpoint, "https://")
    custom_header {
      name  = "X-PlanEstudio-Origin"
      value = random_password.origin.result
    }
    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }
  }

  default_cache_behavior {
    target_origin_id           = "static"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.study.id
    compress                   = true
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.study.arn
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = local.api_paths
    content {
      path_pattern               = ordered_cache_behavior.value
      target_origin_id           = "api"
      viewer_protocol_policy     = "https-only"
      allowed_methods            = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods             = ["GET", "HEAD"]
      cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
      origin_request_policy_id   = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
      response_headers_policy_id = aws_cloudfront_response_headers_policy.study.id
      compress                   = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_s3_bucket_policy" "cloudfront" {
  bucket = aws_s3_bucket.study.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "s3:GetObject"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Resource  = "${aws_s3_bucket.study.arn}/site/PlanEstudio/*"
        Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.study.arn } }
      },
      {
        Effect    = "Deny"
        Action    = "s3:*"
        Principal = "*"
        Resource  = [aws_s3_bucket.study.arn, "${aws_s3_bucket.study.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      }
    ]
  })
  depends_on = [aws_s3_bucket_public_access_block.study]
}
