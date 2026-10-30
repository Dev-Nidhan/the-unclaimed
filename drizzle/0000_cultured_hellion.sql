CREATE TABLE "archive_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"investigation_id" uuid NOT NULL,
	"archive_url" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"original_url" text NOT NULL,
	"availability_status" text DEFAULT 'unknown' NOT NULL,
	CONSTRAINT "archive_captures_archive_url_http" CHECK ("archive_captures"."archive_url" ~ '^https?://[^[:space:]]+$'),
	CONSTRAINT "archive_captures_original_url_http" CHECK ("archive_captures"."original_url" ~ '^https?://[^[:space:]]+$'),
	CONSTRAINT "archive_captures_availability_known" CHECK ("archive_captures"."availability_status" in ('unknown', 'available', 'missing'))
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifacts_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "artifacts_filename_not_blank" CHECK (length(btrim("artifacts"."filename")) > 0),
	CONSTRAINT "artifacts_storage_key_not_blank" CHECK (length(btrim("artifacts"."storage_key")) > 0),
	CONSTRAINT "artifacts_mime_type_not_blank" CHECK (length(btrim("artifacts"."mime_type")) > 0)
);
--> statement-breakpoint
CREATE TABLE "browser_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"browserbase_session_id" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "browser_sessions_browserbase_session_id_unique" UNIQUE("browserbase_session_id"),
	CONSTRAINT "browser_sessions_browserbase_id_not_blank" CHECK (length(btrim("browser_sessions"."browserbase_session_id")) > 0),
	CONSTRAINT "browser_sessions_status_known" CHECK ("browser_sessions"."status" in ('created', 'active', 'closed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"description" text,
	CONSTRAINT "entities_id_investigation_unique" UNIQUE("id","investigation_id"),
	CONSTRAINT "entities_name_not_blank" CHECK (length(btrim("entities"."name")) > 0),
	CONSTRAINT "entities_entity_type_not_blank" CHECK (length(btrim("entities"."entity_type")) > 0)
);
--> statement-breakpoint
CREATE TABLE "finding_sources" (
	"finding_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	CONSTRAINT "finding_sources_pk" PRIMARY KEY("finding_id","source_id","observation_id")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"explanation" text NOT NULL,
	"classification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "findings_id_investigation_unique" UNIQUE("id","investigation_id"),
	CONSTRAINT "findings_title_not_blank" CHECK (length(btrim("findings"."title")) > 0),
	CONSTRAINT "findings_explanation_not_blank" CHECK (length(btrim("findings"."explanation")) > 0),
	CONSTRAINT "findings_classification_not_blank" CHECK (length(btrim("findings"."classification")) > 0)
);
--> statement-breakpoint
CREATE TABLE "investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"starting_url" text NOT NULL,
	"objective" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investigations_title_not_blank" CHECK (length(btrim("investigations"."title")) > 0),
	CONSTRAINT "investigations_subject_not_blank" CHECK (length(btrim("investigations"."subject")) > 0),
	CONSTRAINT "investigations_objective_not_blank" CHECK (length(btrim("investigations"."objective")) > 0),
	CONSTRAINT "investigations_starting_url_http" CHECK ("investigations"."starting_url" ~ '^https?://[^[:space:]]+$'),
	CONSTRAINT "investigations_status_known" CHECK ("investigations"."status" in ('open', 'investigating', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"investigation_id" uuid NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"page_title" text,
	"extracted_content" text NOT NULL,
	"content_hash" text NOT NULL,
	"http_status" integer,
	CONSTRAINT "observations_id_source_unique" UNIQUE("id","source_id"),
	CONSTRAINT "observations_extracted_content_not_blank" CHECK (length(btrim("observations"."extracted_content")) > 0),
	CONSTRAINT "observations_content_hash_hex" CHECK ("observations"."content_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "observations_http_status_range" CHECK ("observations"."http_status" is null or ("observations"."http_status" between 100 and 599))
);
--> statement-breakpoint
CREATE TABLE "presence_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"intensity" integer NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presence_events_event_type_not_blank" CHECK (length(btrim("presence_events"."event_type")) > 0),
	CONSTRAINT "presence_events_intensity_range" CHECK ("presence_events"."intensity" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"evidence_source_id" uuid NOT NULL,
	CONSTRAINT "relationships_entities_distinct" CHECK ("relationships"."from_entity_id" <> "relationships"."to_entity_id"),
	CONSTRAINT "relationships_type_not_blank" CHECK (length(btrim("relationships"."relationship_type")) > 0)
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text,
	"source_type" text NOT NULL,
	"discovery_method" text NOT NULL,
	"access_status" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_id_investigation_unique" UNIQUE("id","investigation_id"),
	CONSTRAINT "sources_source_type_not_blank" CHECK (length(btrim("sources"."source_type")) > 0),
	CONSTRAINT "sources_discovery_method_not_blank" CHECK (length(btrim("sources"."discovery_method")) > 0),
	CONSTRAINT "sources_url_http" CHECK ("sources"."url" ~ '^https?://[^[:space:]]+$'),
	CONSTRAINT "sources_canonical_url_http" CHECK ("sources"."canonical_url" ~ '^https?://[^[:space:]]+$'),
	CONSTRAINT "sources_access_status_known" CHECK ("sources"."access_status" in ('unknown', 'reachable', 'unreachable', 'blocked'))
);
--> statement-breakpoint
ALTER TABLE "archive_captures" ADD CONSTRAINT "archive_captures_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_captures" ADD CONSTRAINT "archive_captures_source_investigation_fk" FOREIGN KEY ("source_id","investigation_id") REFERENCES "public"."sources"("id","investigation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_source_investigation_fk" FOREIGN KEY ("source_id","investigation_id") REFERENCES "public"."sources"("id","investigation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_sources" ADD CONSTRAINT "finding_sources_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_sources" ADD CONSTRAINT "finding_sources_observation_source_fk" FOREIGN KEY ("observation_id","source_id") REFERENCES "public"."observations"("id","source_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_investigation_fk" FOREIGN KEY ("source_id","investigation_id") REFERENCES "public"."sources"("id","investigation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_events" ADD CONSTRAINT "presence_events_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_from_entity_fk" FOREIGN KEY ("from_entity_id","investigation_id") REFERENCES "public"."entities"("id","investigation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_to_entity_fk" FOREIGN KEY ("to_entity_id","investigation_id") REFERENCES "public"."entities"("id","investigation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_evidence_source_fk" FOREIGN KEY ("evidence_source_id","investigation_id") REFERENCES "public"."sources"("id","investigation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archive_captures_investigation_id_idx" ON "archive_captures" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "archive_captures_source_id_idx" ON "archive_captures" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "archive_captures_archive_url_idx" ON "archive_captures" USING btree ("archive_url");--> statement-breakpoint
CREATE INDEX "archive_captures_original_url_idx" ON "archive_captures" USING btree ("original_url");--> statement-breakpoint
CREATE INDEX "archive_captures_captured_at_idx" ON "archive_captures" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "artifacts_investigation_id_idx" ON "artifacts" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "artifacts_source_id_idx" ON "artifacts" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "artifacts_created_at_idx" ON "artifacts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "browser_sessions_investigation_id_idx" ON "browser_sessions" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "browser_sessions_created_at_idx" ON "browser_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "entities_investigation_id_idx" ON "entities" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "finding_sources_source_id_idx" ON "finding_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "finding_sources_observation_id_idx" ON "finding_sources" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "findings_investigation_id_idx" ON "findings" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "findings_created_at_idx" ON "findings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "investigations_starting_url_idx" ON "investigations" USING btree ("starting_url");--> statement-breakpoint
CREATE INDEX "investigations_created_at_idx" ON "investigations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "investigations_updated_at_idx" ON "investigations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "observations_investigation_id_idx" ON "observations" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "observations_source_id_idx" ON "observations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "observations_observed_at_idx" ON "observations" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "presence_events_investigation_id_idx" ON "presence_events" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "presence_events_triggered_at_idx" ON "presence_events" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "relationships_investigation_id_idx" ON "relationships" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "relationships_from_entity_id_idx" ON "relationships" USING btree ("from_entity_id");--> statement-breakpoint
CREATE INDEX "relationships_to_entity_id_idx" ON "relationships" USING btree ("to_entity_id");--> statement-breakpoint
CREATE INDEX "relationships_evidence_source_id_idx" ON "relationships" USING btree ("evidence_source_id");--> statement-breakpoint
CREATE INDEX "sources_investigation_id_idx" ON "sources" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "sources_url_idx" ON "sources" USING btree ("url");--> statement-breakpoint
CREATE INDEX "sources_canonical_url_idx" ON "sources" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "sources_created_at_idx" ON "sources" USING btree ("created_at");