-- AlterTable: email globally unique (statt nur pro Tenant)
-- Drop old composite unique constraint
ALTER TABLE "app_users" DROP CONSTRAINT IF EXISTS "app_users_tenant_id_email_key";

-- Add global unique constraint on email
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_email_key" UNIQUE ("email");
