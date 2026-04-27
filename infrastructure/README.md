# Investment Tracker - AWS Infrastructure

Terraform configuration for deploying Investment Tracker infrastructure on AWS.

## Project Structure

```
infrastructure/
├── provider.tf              # AWS provider configuration
├── variables.tf             # Input variables
├── main.tf                  # Main resource definitions
├── locals.tf                # Local values
├── outputs.tf               # Output values
├── terraform.tfvars.example # Example variables (copy to terraform.tfvars)
├── .gitignore               # Terraform files to ignore
└── README.md                # This file
```

## Prerequisites

### Local Setup
1. **Terraform** >= 1.0
   ```bash
   brew install terraform  # macOS
   terraform --version
   ```

2. **AWS CLI** >= 2.0
   ```bash
   brew install awscliv2  # macOS
   aws --version
   ```

3. **AWS Credentials**
   - IAM Identity Center user created
   - Billing access enabled
   - AWS CLI configured:
     ```bash
     aws configure sso
     # Follow prompts to configure your SSO profile
     ```

### AWS Account Setup (Already Done)
- ✅ New AWS account created
- ✅ IAM Identity Center enabled
- ✅ Identity User created
- ✅ Billing access enabled

## Configuration

### 1. Create terraform.tfvars

Copy the example file and customize it:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
aws_region              = "us-east-1"
project_name            = "investment-tracker"
environment             = "dev"
monthly_budget_limit    = 10
budget_alert_threshold  = 100  # Alert at 100% (when you reach $10)
budget_alert_email      = "your-email@example.com"  # Your email address
```

**Important**: `terraform.tfvars` is in `.gitignore` and won't be committed.

### 2. Configure AWS CLI with SSO

```bash
aws configure sso
# Follow prompts:
# SSO session name: investment-tracker
# SSO start URL: https://[your-id].awsapps.com/start
# SSO region: us-east-1
# CLI region: us-east-1
# CLI output format: json
# CLI profile name: investment-tracker
```

Verify configuration:
```bash
aws sts get-caller-identity --profile investment-tracker
```

## Terraform Commands

### 1. Initialize Terraform

```bash
cd infrastructure/
terraform init
```

This downloads the AWS provider and initializes the local Terraform state.

### 2. Plan Infrastructure Changes

```bash
terraform plan -out=tfplan
```

Review the changes before applying. Output shows:
- New resources to be created
- Existing resources to be modified
- Resources to be destroyed

### 3. Apply Infrastructure

```bash
terraform apply tfplan
```

Creates the AWS resources (Budget + Alerts).

### 4. View Outputs

```bash
terraform output
```

Shows outputs like Account ID, region, and budget configuration.

### 5. Destroy Infrastructure (if needed)

```bash
terraform destroy
```

⚠️ This will delete all managed resources.

## First Deployment - Budget Alert Setup

This initial configuration creates:

### AWS Budget ($10 Monthly Limit)
- Monthly budget of $10 USD
- Alerts at 100% threshold (when you reach $10)
- Notifications for both:
  - **ACTUAL** spend (when $10 is actually spent)
  - **FORECASTED** spend (when trends indicate you'll hit $10)

### Alert Emails
You'll receive email notifications when:
1. Your actual spending reaches 100% of $10 ($10 spent)
2. Forecasted spending indicates you'll reach 100% of $10

These emails are sent to the `budget_alert_email` you specified in `terraform.tfvars`.

## Verifying Budget Alert in AWS Console

1. Sign in to AWS Console
2. Go to **Billing & Cost Management** → **Budgets**
3. Look for `investment-tracker-dev-monthly-budget`
4. Verify:
   - Budget: $10.00 USD
   - Alert at: 100%
   - Email: Your configured email

## Updating Budget Later

To change the budget amount (e.g., from $10 to $20):

```hcl
# In terraform.tfvars
monthly_budget_limit = 20
```

Then apply:
```bash
terraform plan
terraform apply
```

## AWS Regions

Default: `us-east-1` (recommended for new accounts)

To use a different region, update `terraform.tfvars`:
```hcl
aws_region = "us-west-2"  # Example: Oregon
```

## Adding More Infrastructure

As you grow, add resources to `main.tf`:
- VPC & Subnets
- RDS database
- Lambda functions
- API Gateway
- etc.

Keep the structure organized by creating subdirectories:
```
infrastructure/
├── main.tf
├── budget/
│   ├── main.tf
│   └── variables.tf
├── networking/
│   ├── main.tf
│   └── variables.tf
└── database/
    ├── main.tf
    └── variables.tf
```

## State Management (Production)

For team collaboration and production deployments, use S3 backend:

### 1. Create S3 Bucket for Terraform State

```bash
aws s3api create-bucket --bucket investment-tracker-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket investment-tracker-terraform-state \
  --versioning-configuration Status=Enabled
```

### 2. Uncomment backend block in provider.tf

```hcl
backend "s3" {
  bucket         = "investment-tracker-terraform-state"
  key            = "prod/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "terraform-locks"
}
```

### 3. Re-initialize Terraform

```bash
terraform init
```

## Environment Isolation

Create separate folders for different environments:

```
infrastructure/
├── dev/
│   ├── terraform.tfvars
│   └── main.tf (symlink or module)
├── staging/
│   ├── terraform.tfvars
│   └── main.tf
└── prod/
    ├── terraform.tfvars
    └── main.tf
```

## Useful Commands

```bash
# Format Terraform files
terraform fmt -recursive

# Validate configuration
terraform validate

# Show current state
terraform show

# List resources
terraform state list

# Show specific resource
terraform state show aws_budgets_budget.monthly

# Plan with specific variables
terraform plan -var="monthly_budget_limit=20"

# Auto-approve (use with caution)
terraform apply -auto-approve
```

## Troubleshooting

### AWS CLI Not Finding Credentials

```bash
# Check SSO profile
aws sts get-caller-identity --profile investment-tracker

# Set AWS_PROFILE environment variable
export AWS_PROFILE=investment-tracker
```

### Terraform State Lock Issues

```bash
# Force unlock (use only if stuck)
terraform force-unlock <LOCK_ID>
```

### Email Not Received

1. Check spam folder
2. Verify email address in `terraform.tfvars`
3. Check AWS Budgets alerts settings in console
4. Confirm email was subscribed (may require email confirmation link)

## Cost Estimation

This initial configuration costs:
- **AWS Budget**: Free (no charge for creating budgets)
- **SNS Notifications**: Free tier typically covers email alerts
- **Total**: ~$0/month

## Next Steps

1. Deploy budget alert (this setup)
2. Create VPC and networking infrastructure
3. Set up RDS database for Investment Tracker backend
4. Deploy containers (ECS/Fargate) for mobile backend
5. Configure CI/CD pipeline

## Support & Documentation

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Budgets Documentation](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/budgets-managing-costs.html)
- [Terraform Best Practices](https://www.terraform.io/cloud-docs/recommended-practices)

