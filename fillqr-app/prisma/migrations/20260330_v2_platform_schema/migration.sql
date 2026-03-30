-- DropForeignKey
ALTER TABLE "app_users" DROP CONSTRAINT "app_users_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "form_fields" DROP CONSTRAINT "form_fields_form_id_fkey";

-- DropForeignKey
ALTER TABLE "forms" DROP CONSTRAINT "forms_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_form_id_fkey";

-- DropForeignKey
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_tenant_id_fkey";

-- DropTable
DROP TABLE "app_users";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "form_fields";

-- DropTable
DROP TABLE "forms";

-- DropTable
DROP TABLE "submissions";

-- DropTable
DROP TABLE "tenants";

-- DropEnum
DROP TYPE "AppUserRole";

-- DropEnum
DROP TYPE "AuditAction";

-- DropEnum
DROP TYPE "AuditEntityType";

-- DropEnum
DROP TYPE "FormFieldType";

-- DropEnum
DROP TYPE "FormStatus";

-- DropEnum
DROP TYPE "FormType";

-- DropEnum
DROP TYPE "SubmissionStatus";

-- DropEnum
DROP TYPE "TenantStatus";

-- CreateTable
CREATE TABLE "tbl_tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logo_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tbl_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_apps" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tbl_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_tenant_apps" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings_json" JSONB NOT NULL DEFAULT '{}',
    "branding_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_tenant_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_app_users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tbl_app_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_apps_key_key" ON "tbl_apps"("key");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_tenant_apps_slug_key" ON "tbl_tenant_apps"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_app_users_email_key" ON "tbl_app_users"("email");

-- AddForeignKey
ALTER TABLE "tbl_tenant_apps" ADD CONSTRAINT "tbl_tenant_apps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_tenant_apps" ADD CONSTRAINT "tbl_tenant_apps_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "tbl_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_app_users" ADD CONSTRAINT "tbl_app_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

