variable "owner_email" {
  type        = string
  description = "Correo Google autorizado y destinatario de AWS Budgets."
  validation {
    condition     = can(regex("^[A-Za-z0-9._%+-]+@gmail\\.com$", var.owner_email))
    error_message = "Indica la cuenta de Gmail autorizada."
  }
}

variable "google_secret_arn" {
  type        = string
  description = "ARN de Secrets Manager con el objeto client_id y client_secret de Google OAuth web."
}

variable "mcp_redirect_uri" {
  type        = string
  default     = ""
  description = "URL exacta de retorno que muestre ChatGPT. Vacía mientras se conecta la aplicación."
  validation {
    condition     = var.mcp_redirect_uri == "" || can(regex("^https://(chatgpt\\.com|chat\\.openai\\.com)/[^#\\s]+$", var.mcp_redirect_uri))
    error_message = "Usa la URL HTTPS de retorno que indica ChatGPT."
  }
}

variable "worker_token_hash" {
  type        = string
  sensitive   = true
  default     = ""
  description = "SHA-256 hexadecimal del secreto del proceso de video en Windows."
  validation {
    condition     = var.worker_token_hash == "" || can(regex("^[0-9a-f]{64}$", var.worker_token_hash))
    error_message = "Usa un SHA-256 hexadecimal en minúsculas."
  }
}

variable "enable_bedrock" {
  description = "Crea y habilita el perfil privado etiquetado para el tutor."
  type        = bool
  default     = true
}

variable "activate_cost_tag" {
  description = "Activa Project en facturación cuando AWS lo enumere como etiqueta disponible."
  type        = bool
  default     = false
}

variable "cloudflare_account_id" {
  type    = string
  default = ""
}

variable "cloudflare_zone_id" {
  type    = string
  default = ""
  validation {
    condition     = var.cloudflare_zone_id == "" || (can(regex("^[a-f0-9]{32}$", var.cloudflare_zone_id)) && can(regex("^[a-f0-9]{32}$", var.cloudflare_account_id)))
    error_message = "Cuando usas Cloudflare indica los identificadores de zona y cuenta."
  }
}

variable "cloudflare_create_apex_record" {
  description = "Crea un registro con proxy para Workers cuando el dominio raíz aún carece de registros web."
  type        = bool
  default     = false
}
