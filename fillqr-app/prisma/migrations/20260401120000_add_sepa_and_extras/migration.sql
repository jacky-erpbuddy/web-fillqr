-- AlterTable: Zusatzoptionen-Felder auf tbl_members
ALTER TABLE "tbl_members" ADD COLUMN     "donation" DECIMAL(65,30),
ADD COLUMN     "newsletter" BOOLEAN,
ADD COLUMN     "photo_consent" BOOLEAN,
ADD COLUMN     "referred_by" TEXT,
ADD COLUMN     "volunteer" BOOLEAN;

-- CreateTable: SEPA-Mandate
CREATE TABLE "tbl_sepa_mandates" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT,
    "mandate_ref" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used" TIMESTAMP(3),

    CONSTRAINT "tbl_sepa_mandates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_sepa_mandates_member_id_key" ON "tbl_sepa_mandates"("member_id");
CREATE UNIQUE INDEX "tbl_sepa_mandates_mandate_ref_key" ON "tbl_sepa_mandates"("mandate_ref");
CREATE INDEX "tbl_sepa_mandates_tenant_id_idx" ON "tbl_sepa_mandates"("tenant_id");

-- AddForeignKey
ALTER TABLE "tbl_sepa_mandates" ADD CONSTRAINT "tbl_sepa_mandates_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tbl_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tbl_sepa_mandates" ADD CONSTRAINT "tbl_sepa_mandates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rechte fuer App-User
GRANT SELECT, INSERT, UPDATE, DELETE ON "tbl_sepa_mandates" TO fillqr_app;
