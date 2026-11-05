CREATE TABLE "domain_repository" (
	"user_id" text NOT NULL,
	"domain" text NOT NULL,
	"repository" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_repository_user_id_domain_pk" PRIMARY KEY("user_id","domain")
);
--> statement-breakpoint
ALTER TABLE "domain_repository" ADD CONSTRAINT "domain_repository_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;