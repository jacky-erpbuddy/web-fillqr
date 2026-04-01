-- AlterTable: Familienmitgliedschaft
ALTER TABLE "tbl_members" ADD COLUMN     "family_group_id" TEXT,
ADD COLUMN     "family_head" BOOLEAN;

-- Index fuer Familien-Gruppierung
CREATE INDEX "tbl_members_family_group_id_idx" ON "tbl_members"("family_group_id");
