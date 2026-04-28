variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for tagging and resource naming"
  type        = string
  default     = "investment-tracker"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# Budget Variables
variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 10

  validation {
    condition     = var.monthly_budget_limit > 0
    error_message = "Budget limit must be greater than 0"
  }
}

variable "budget_alert_threshold" {
  description = "Percentage of budget at which to send alert (0-100)"
  type        = number
  default     = 100

  validation {
    condition     = var.budget_alert_threshold > 0 && var.budget_alert_threshold <= 100
    error_message = "Alert threshold must be between 0 and 100"
  }
}

variable "budget_alert_email" {
  description = "Email address to receive budget alerts"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.budget_alert_email))
    error_message = "Must be a valid email address"
  }
}

variable "jwt_secret" {
  description = "Secret key for signing JWT tokens"
  type        = string
  sensitive   = true
}

variable "token_encryption_key" {
  description = "32-byte hex key for AES-256 encryption of stored API tokens"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth 2.0 Web Client ID for server-side token verification"
  type        = string
  sensitive   = true
}

variable "google_ios_client_id" {
  description = "Google OAuth 2.0 iOS Client ID for server-side token verification"
  type        = string
  sensitive   = true
}

variable "questrade_refresh_token" {
  description = "Questrade OAuth refresh token (bootstraps DB on first Lambda invocation)"
  type        = string
  sensitive   = true
}
