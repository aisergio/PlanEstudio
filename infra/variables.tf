variable "aws_region" {
  type        = string
  default     = "us-east-2"
  description = "Región asignada al proyecto en AWS Settings."
}

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
  default     = null
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
  validation {
    condition     = var.mcp_redirect_uri == "" || var.google_secret_arn != null
    error_message = "Configura el secreto de Google para activar el cliente de ChatGPT."
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

variable "api_reserved_concurrency" {
  type        = number
  default     = null
  description = "Reserva de concurrencia opcional para cuentas con capacidad suficiente en Lambda."
}

variable "activate_cost_tag" {
  description = "Activa Project en facturación cuando AWS lo enumere como etiqueta disponible."
  type        = bool
  default     = false
}
