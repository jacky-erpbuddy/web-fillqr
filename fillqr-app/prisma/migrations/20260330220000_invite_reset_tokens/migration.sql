-- AlterTable
ALTER TABLE "tbl_app_users" ADD COLUMN     "invite_expires_at" TIMESTAMP(3),
ADD COLUMN     "invite_token" TEXT,
ADD COLUMN     "reset_expires_at" TIMESTAMP(3),
ADD COLUMN     "reset_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tbl_app_users_invite_token_key" ON "tbl_app_users"("invite_token");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_app_users_reset_token_key" ON "tbl_app_users"("reset_token");
