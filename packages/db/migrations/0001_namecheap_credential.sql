CREATE TABLE "namecheap_credential" (
	"user_id" text PRIMARY KEY NOT NULL,
	"api_user" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"api_key_last4" varchar(4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "namecheap_credential" ADD CONSTRAINT "namecheap_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;