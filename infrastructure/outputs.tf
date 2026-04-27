output "budget_name" {
  description = "Name of the budget"
  value       = aws_budgets_budget.monthly.name
}

output "budget_limit" {
  description = "Monthly budget limit in USD"
  value       = aws_budgets_budget.monthly.limit_amount
}

output "budget_alert_threshold" {
  description = "Alert threshold percentage"
  value       = "${var.budget_alert_threshold}%"
}

output "budget_alert_email" {
  description = "Email address receiving budget alerts"
  value       = var.budget_alert_email
  sensitive   = true
}

output "aws_account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS Region"
  value       = var.aws_region
}

# output "api_gateway_url" {
#   description = "Base URL for the API Gateway (append /api/... to call endpoints)"
#   value       = module.api_gateway.stage_invoke_url
# }

# output "lambda_function_name" {
#   description = "Name of the API Lambda function"
#   value       = module.lambda_function.lambda_function_name
# }

output "db_secret_arn" {
  value     = module.aurora_postgresql.cluster_master_user_secret[0].secret_arn
  sensitive = true
}