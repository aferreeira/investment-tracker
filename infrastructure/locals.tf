locals {
    name   = "ex-${basename(path.cwd)}"
    region = var.aws_region

    vpc_cidr = "10.0.0.0/16"
    azs      = slice(data.aws_availability_zones.available.names, 0, 3)

    common_tags = {
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "Terraform"
    }

    resource_prefix = "${var.environment}-${var.project_name}"
}
