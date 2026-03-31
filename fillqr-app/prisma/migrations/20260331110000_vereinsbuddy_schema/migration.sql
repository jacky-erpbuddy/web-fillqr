-- CreateTable
CREATE TABLE "tbl_membership_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" DECIMAL(65,30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tbl_membership_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_departments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extra_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tbl_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_members" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "member_no" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'eingegangen',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "birthdate" TIMESTAMP(3),
    "entry_date" TIMESTAMP(3),
    "membership_type_id" TEXT,
    "payment_interval" TEXT,
    "payment_method" TEXT,
    "photo_path" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tbl_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_member_departments" (
    "member_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,

    CONSTRAINT "tbl_member_departments_pkey" PRIMARY KEY ("member_id","department_id")
);

-- CreateIndex
CREATE INDEX "tbl_members_tenant_id_status_idx" ON "tbl_members"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_members_tenant_id_member_no_key" ON "tbl_members"("tenant_id", "member_no");

-- AddForeignKey
ALTER TABLE "tbl_membership_types" ADD CONSTRAINT "tbl_membership_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_departments" ADD CONSTRAINT "tbl_departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_members" ADD CONSTRAINT "tbl_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tbl_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_members" ADD CONSTRAINT "tbl_members_membership_type_id_fkey" FOREIGN KEY ("membership_type_id") REFERENCES "tbl_membership_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_member_departments" ADD CONSTRAINT "tbl_member_departments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "tbl_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_member_departments" ADD CONSTRAINT "tbl_member_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "tbl_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
