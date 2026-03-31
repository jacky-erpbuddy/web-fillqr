-- CreateTable
CREATE TABLE "tbl_guardians" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "relation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_guardians_pkey" PRIMARY KEY ("id")
);

-- AddIndex
CREATE INDEX "tbl_guardians_member_id_idx" ON "tbl_guardians"("member_id");

-- AddForeignKey
ALTER TABLE "tbl_guardians" ADD CONSTRAINT "tbl_guardians_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tbl_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rechte fuer App-User
GRANT SELECT, INSERT, UPDATE, DELETE ON "tbl_guardians" TO fillqr_app;
