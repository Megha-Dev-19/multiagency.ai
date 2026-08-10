-- Epic 003: builders plugin, clients, client-scoped budgets/billings

-- Application converted status
ALTER TABLE "agency"."applications"
DROP CONSTRAINT IF EXISTS "applications_status_check";
--> statement-breakpoint
UPDATE "agency"."applications"
SET
    "status" = 'accepted'
WHERE
    "status" NOT IN (
        'new',
        'reviewing',
        'accepted',
        'declined'
    );
--> statement-breakpoint
ALTER TABLE "agency"."applications"
ADD CONSTRAINT "applications_status_check" CHECK (
    "status" IN (
        'new',
        'reviewing',
        'accepted',
        'declined',
        'converted'
    )
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agency"."clients" (
    "id" text PRIMARY KEY NOT NULL,
    "org_id" text NOT NULL,
    "name" text NOT NULL,
    "near_account_id" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_org_id" ON "agency"."clients" ("org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_near_account_id" ON "agency"."clients" ("near_account_id")
WHERE
    "near_account_id" IS NOT NULL;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agency"."client_projects" (
    "client_id" text NOT NULL REFERENCES "agency"."clients" ("id") ON DELETE CASCADE,
    "project_id" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    PRIMARY KEY ("client_id", "project_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_projects_project_id" ON "agency"."client_projects" ("project_id");

--> statement-breakpoint
ALTER TABLE "agency"."project_contributors"
ADD COLUMN IF NOT EXISTS "near_account" text;
--> statement-breakpoint
UPDATE "agency"."project_contributors" pc
SET
    "near_account" = c."near_account_id"
FROM "agency"."contributors" c
WHERE
    pc."contributor_id" = c."id"
    AND pc."near_account" IS NULL
    AND c."near_account_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "agency"."project_contributors" pc
SET
    "near_account" = c."id"
FROM "agency"."contributors" c
WHERE
    pc."contributor_id" = c."id"
    AND pc."near_account" IS NULL;
--> statement-breakpoint
DELETE FROM "agency"."project_contributors"
WHERE
    "near_account" IS NULL;
--> statement-breakpoint
ALTER TABLE "agency"."project_contributors"
DROP CONSTRAINT IF EXISTS "project_contributors_pkey";
--> statement-breakpoint
ALTER TABLE "agency"."project_contributors"
DROP COLUMN IF EXISTS "contributor_id";
--> statement-breakpoint
ALTER TABLE "agency"."project_contributors"
ALTER COLUMN "near_account"
SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "agency"."project_contributors"
ADD PRIMARY KEY ("project_id", "near_account");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_contributors_near_account" ON "agency"."project_contributors" ("near_account");

--> statement-breakpoint
ALTER TABLE "agency"."billings"
ADD COLUMN IF NOT EXISTS "near_account" text;
--> statement-breakpoint
ALTER TABLE "agency"."billings"
ADD COLUMN IF NOT EXISTS "client_id" text REFERENCES "agency"."clients" ("id") ON DELETE SET NULL;
--> statement-breakpoint
UPDATE "agency"."billings" b
SET
    "near_account" = c."near_account_id"
FROM "agency"."contributors" c
WHERE
    b."contributor_id" = c."id"
    AND b."near_account" IS NULL
    AND c."near_account_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "agency"."billings"
DROP COLUMN IF EXISTS "contributor_id";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billings_near_account" ON "agency"."billings" ("near_account");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billings_client_id" ON "agency"."billings" ("client_id");

--> statement-breakpoint
DROP TABLE IF EXISTS "agency"."contributors";