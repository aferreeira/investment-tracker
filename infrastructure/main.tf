# AWS Budget for cost monitoring
resource "aws_budgets_budget" "monthly" {
  account_id  = data.aws_caller_identity.current.account_id
  name        = "${var.environment}-${var.project_name}-monthly-budget"
  budget_type = "COST"
  limit_unit  = "USD"
  limit_amount      = var.monthly_budget_limit
  time_period_start = "2026-01-01_00:00"
  time_period_end   = "2050-12-31_23:59"
  time_unit         = "MONTHLY"

  # Notification for actual spend
  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = var.budget_alert_threshold
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  # Notification for forecasted spend
  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "FORECASTED"
    threshold                  = var.budget_alert_threshold
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-monthly-budget"
  }
}

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {}

data "aws_rds_engine_version" "postgresql" {
  engine  = "aurora-postgresql"
  version = "17.5"
}

data "archive_file" "backend" {
  type        = "zip"
  source_dir  = "${path.root}/../backend"
  output_path = "${path.root}/dist/backend.zip"
  excludes = [
    "db_data",
    ".env",
    ".env.local",
    "dist",
    "*.test.js",
    "**/*.test.js",
  ]
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.0"

  name = local.name
  cidr = local.vpc_cidr

  azs              = local.azs
  public_subnets   = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k)]
  private_subnets  = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k + 3)]
  database_subnets = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k + 6)]

  tags = local.common_tags
}

module "aurora_postgresql" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "v10.2.0"

  name              = "${var.environment}-${var.project_name}-db"
  engine            = data.aws_rds_engine_version.postgresql.engine
  engine_mode       = "provisioned"
  engine_version    = data.aws_rds_engine_version.postgresql.version
  storage_encrypted          = true
  master_username            = "postgres"
  manage_master_user_password = true

  vpc_id               = module.vpc.vpc_id
  db_subnet_group_name = module.vpc.database_subnet_group_name

  apply_immediately   = true
  skip_final_snapshot = true

  enable_http_endpoint = true

  serverlessv2_scaling_configuration = {
    min_capacity             = 0
    max_capacity             = 1
    seconds_until_auto_pause = 300
  }

  cluster_instance_class = "db.serverless"
  cluster_timeouts = {
    delete = "30m"
  }

  instances = {
    one = {}
  }
  instance_timeouts = {
    delete = "30m"
  }

  tags = local.common_tags
}

resource "aws_s3_object" "backend" {
  bucket = module.s3_bucket.s3_bucket_id
  key    = "backend/${data.archive_file.backend.output_md5}.zip"
  source = data.archive_file.backend.output_path
  etag   = data.archive_file.backend.output_md5

  depends_on = [module.s3_bucket]
}

module "s3_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "5.12.0"

  bucket        = "${local.resource_prefix}-lambda-packages"
  force_destroy = true

  versioning = {
    enabled = true
  }

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
    }
  }

  tags = local.common_tags
}

module "lambda_function" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "8.8.0"

  function_name = "${local.resource_prefix}-api"
  description   = "Investment Tracker API"
  handler       = "lambda.handler"
  runtime       = "nodejs22.x"
  timeout       = 60
  memory_size   = 512

  # Use the pre-built zip already uploaded to S3
  # create_package = false skips the module's internal package.py packaging step
  create_package = false
  s3_existing_package = {
    bucket = module.s3_bucket.s3_bucket_id
    key    = aws_s3_object.backend.key
  }

  environment_variables = {
    DB_CLUSTER_ARN       = module.aurora_postgresql.cluster_arn
    DB_SECRET_ARN        = module.aurora_postgresql.cluster_master_user_secret[0].secret_arn
    DB_NAME              = "investment_tracker"
    NODE_ENV             = var.environment
    LAMBDA               = "true"
    JWT_SECRET           = var.jwt_secret
    TOKEN_ENCRYPTION_KEY = var.token_encryption_key
  }

  # RDS Data API + Secrets Manager permissions
  attach_policy_statements = true
  policy_statements = {
    rds_data_api = {
      effect = "Allow"
      actions = [
        "rds-data:ExecuteStatement",
        "rds-data:BatchExecuteStatement",
        "rds-data:BeginTransaction",
        "rds-data:CommitTransaction",
        "rds-data:RollbackTransaction",
        "rds-data:DescribeTable",
      ]
      resources = [module.aurora_postgresql.cluster_arn]
    }
    secrets_manager = {
      effect    = "Allow"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = [module.aurora_postgresql.cluster_master_user_secret[0].secret_arn]
    }
  }

  cloudwatch_logs_retention_in_days = 14

  tags = local.common_tags
}

module "api_gateway" {
  source  = "terraform-aws-modules/apigateway-v2/aws"
  version = "6.1.0"

  name          = "${local.resource_prefix}-api"
  description   = "Investment Tracker REST API"
  protocol_type = "HTTP"

  # No custom domain needed for now
  create_domain_name = false

  # Single catch-all route — Express handles all routing internally
  routes = {
    "$default" = {
      integration = {
        uri                    = module.lambda_function.lambda_function_invoke_arn
        payload_format_version = "2.0"
        timeout_milliseconds   = 29000
      }
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_function.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.api_execution_arn}/*/*"
}