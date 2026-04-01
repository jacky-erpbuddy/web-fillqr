-- CreateTable: E-Mail-Vorlagen
CREATE TABLE "tbl_email_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_key" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tbl_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_email_templates_tenant_id_app_key_template_key_key" ON "tbl_email_templates"("tenant_id", "app_key", "template_key");

-- AddForeignKey
ALTER TABLE "tbl_email_templates" ADD CONSTRAINT "tbl_email_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rechte fuer App-User
GRANT SELECT, INSERT, UPDATE, DELETE ON "tbl_email_templates" TO fillqr_app;
