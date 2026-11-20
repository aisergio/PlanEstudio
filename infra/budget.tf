resource "aws_ce_cost_allocation_tag" "project" {
  count   = var.activate_cost_tag ? 1 : 0
  tag_key = "Project"
  status  = "Active"
}

resource "aws_budgets_budget" "study" {
  name         = "PlanEstudio"
  budget_type  = "COST"
  limit_amount = "10"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  cost_types {
    include_credit = false
  }
  dynamic "notification" {
    for_each = toset([60, 80, 100])
    content {
      comparison_operator        = "GREATER_THAN"
      notification_type          = "ACTUAL"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      subscriber_email_addresses = [var.owner_email]
    }
  }
}
