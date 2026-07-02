


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."route_day_enum" AS ENUM (
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
);


ALTER TYPE "public"."route_day_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_priority_enum" AS ENUM (
    'baja',
    'media',
    'alta',
    'crítica'
);


ALTER TYPE "public"."task_priority_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_state_enum" AS ENUM (
    'Completada',
    'Pendiente',
    'Atrasada',
    'Incompleta'
);


ALTER TYPE "public"."task_state_enum" OWNER TO "postgres";


CREATE TYPE "public"."user_role_enum" AS ENUM (
    'admin',
    'editor',
    'visitante',
    'rutero'
);


ALTER TYPE "public"."user_role_enum" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."check_record" (
    "record_id" bigint NOT NULL,
    "system_inventory" integer,
    "real_inventory" integer,
    "evidence_num" integer,
    "comments" "text",
    "time_date" timestamp without time zone DEFAULT "now"() NOT NULL,
    "product_id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "establishment_id" bigint NOT NULL,
    CONSTRAINT "check_record_non_negative_inv" CHECK (((("evidence_num" IS NULL) OR ("evidence_num" >= 0))))
);


ALTER TABLE "public"."check_record" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."check_record_record_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."check_record_record_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."check_record_record_id_seq" OWNED BY "public"."check_record"."record_id";



CREATE TABLE IF NOT EXISTS "public"."company" (
    "company_id" bigint NOT NULL,
    "name" character varying(120) NOT NULL,
    "direction" character varying(255),
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."company" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."company_company_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."company_company_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."company_company_id_seq" OWNED BY "public"."company"."company_id";



CREATE TABLE IF NOT EXISTS "public"."establishment" (
    "establishment_id" bigint NOT NULL,
    "name" character varying(120) NOT NULL,
    "route_id" bigint,
    "direction" character varying(255),
    "lat" numeric(9,6),
    "long" numeric(9,6),
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."establishment" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."establishment_establishment_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."establishment_establishment_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."establishment_establishment_id_seq" OWNED BY "public"."establishment"."establishment_id";



CREATE TABLE IF NOT EXISTS "public"."evidence" (
    "evidence_id" bigint NOT NULL,
    "url" "text" NOT NULL,
    "record_id" bigint NOT NULL,
    "geo_info" "text"
);


ALTER TABLE "public"."evidence" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."evidence_evidence_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."evidence_evidence_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."evidence_evidence_id_seq" OWNED BY "public"."evidence"."evidence_id";



CREATE TABLE IF NOT EXISTS "public"."product" (
    "product_id" bigint NOT NULL,
    "sku" character varying(80) NOT NULL,
    "name" character varying(120) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "company_id" bigint NOT NULL
);


ALTER TABLE "public"."product" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_product_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."product_product_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_product_id_seq" OWNED BY "public"."product"."product_id";



CREATE TABLE IF NOT EXISTS "public"."products_establishment" (
    "establishment_id" bigint NOT NULL,
    "product_id" bigint NOT NULL
);


ALTER TABLE "public"."products_establishment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."route" (
    "route_id" bigint NOT NULL,
    "nombre" character varying(120) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "visit_period" character varying(40),
    "day" "public"."route_day_enum" NOT NULL,
    "assigned_user" bigint
);


ALTER TABLE "public"."route" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."route_route_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."route_route_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."route_route_id_seq" OWNED BY "public"."route"."route_id";



CREATE TABLE IF NOT EXISTS "public"."task" (
    "task_id" bigint NOT NULL,
    "title" character varying(160) NOT NULL,
    "description" "text",
    "priority" "public"."task_priority_enum" NOT NULL,
    "due_to" timestamp without time zone
);


ALTER TABLE "public"."task" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."task_task_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."task_task_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."task_task_id_seq" OWNED BY "public"."task"."task_id";



CREATE TABLE IF NOT EXISTS "public"."user_profile" (
    "user_id" bigint NOT NULL,
    "name" character varying(120) NOT NULL,
    "role" "public"."user_role_enum" NOT NULL,
    "phone_num" character varying(30)
);


ALTER TABLE "public"."user_profile" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_profile_user_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_profile_user_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_profile_user_id_seq" OWNED BY "public"."user_profile"."user_id";



CREATE TABLE IF NOT EXISTS "public"."user_tasks" (
    "user_id" bigint NOT NULL,
    "task_id" bigint NOT NULL,
    "task_state" "public"."task_state_enum" DEFAULT 'Pendiente'::"public"."task_state_enum" NOT NULL,
    "comments" "text"
);


ALTER TABLE "public"."user_tasks" OWNER TO "postgres";


ALTER TABLE ONLY "public"."check_record" ALTER COLUMN "record_id" SET DEFAULT "nextval"('"public"."check_record_record_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."company" ALTER COLUMN "company_id" SET DEFAULT "nextval"('"public"."company_company_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."establishment" ALTER COLUMN "establishment_id" SET DEFAULT "nextval"('"public"."establishment_establishment_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."evidence" ALTER COLUMN "evidence_id" SET DEFAULT "nextval"('"public"."evidence_evidence_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product" ALTER COLUMN "product_id" SET DEFAULT "nextval"('"public"."product_product_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."route" ALTER COLUMN "route_id" SET DEFAULT "nextval"('"public"."route_route_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."task" ALTER COLUMN "task_id" SET DEFAULT "nextval"('"public"."task_task_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_profile" ALTER COLUMN "user_id" SET DEFAULT "nextval"('"public"."user_profile_user_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."check_record"
    ADD CONSTRAINT "check_record_pkey" PRIMARY KEY ("record_id");



ALTER TABLE ONLY "public"."company"
    ADD CONSTRAINT "company_pkey" PRIMARY KEY ("company_id");



ALTER TABLE ONLY "public"."establishment"
    ADD CONSTRAINT "establishment_pkey" PRIMARY KEY ("establishment_id");



ALTER TABLE ONLY "public"."evidence"
    ADD CONSTRAINT "evidence_pkey" PRIMARY KEY ("evidence_id");



ALTER TABLE ONLY "public"."product"
    ADD CONSTRAINT "product_company_id_sku_key" UNIQUE ("company_id", "sku");



ALTER TABLE ONLY "public"."product"
    ADD CONSTRAINT "product_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "public"."products_establishment"
    ADD CONSTRAINT "products_establishment_pkey" PRIMARY KEY ("establishment_id", "product_id");



ALTER TABLE ONLY "public"."route"
    ADD CONSTRAINT "route_pkey" PRIMARY KEY ("route_id");



ALTER TABLE ONLY "public"."task"
    ADD CONSTRAINT "task_pkey" PRIMARY KEY ("task_id");



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_tasks"
    ADD CONSTRAINT "user_tasks_pkey" PRIMARY KEY ("user_id", "task_id");



CREATE INDEX "check_record_establishment_id_idx" ON "public"."check_record" USING "btree" ("establishment_id");



CREATE INDEX "check_record_product_id_idx" ON "public"."check_record" USING "btree" ("product_id");



CREATE INDEX "check_record_user_id_idx" ON "public"."check_record" USING "btree" ("user_id");



CREATE INDEX "establishment_route_id_idx" ON "public"."establishment" USING "btree" ("route_id");



CREATE INDEX "evidence_record_id_idx" ON "public"."evidence" USING "btree" ("record_id");



CREATE INDEX "product_company_id_idx" ON "public"."product" USING "btree" ("company_id");



CREATE INDEX "products_establishment_product_id_idx" ON "public"."products_establishment" USING "btree" ("product_id");



CREATE INDEX "route_assigned_user_idx" ON "public"."route" USING "btree" ("assigned_user");



CREATE INDEX "user_tasks_task_id_idx" ON "public"."user_tasks" USING "btree" ("task_id");



ALTER TABLE ONLY "public"."check_record"
    ADD CONSTRAINT "check_record_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishment"("establishment_id");



ALTER TABLE ONLY "public"."check_record"
    ADD CONSTRAINT "check_record_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id");



ALTER TABLE ONLY "public"."check_record"
    ADD CONSTRAINT "check_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("user_id");



ALTER TABLE ONLY "public"."establishment"
    ADD CONSTRAINT "establishment_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."route"("route_id");



ALTER TABLE ONLY "public"."evidence"
    ADD CONSTRAINT "evidence_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."check_record"("record_id");



ALTER TABLE ONLY "public"."product"
    ADD CONSTRAINT "product_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."company"("company_id");



ALTER TABLE ONLY "public"."products_establishment"
    ADD CONSTRAINT "products_establishment_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishment"("establishment_id");



ALTER TABLE ONLY "public"."products_establishment"
    ADD CONSTRAINT "products_establishment_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("product_id");



ALTER TABLE ONLY "public"."route"
    ADD CONSTRAINT "route_assigned_user_fkey" FOREIGN KEY ("assigned_user") REFERENCES "public"."user_profile"("user_id");



ALTER TABLE ONLY "public"."user_tasks"
    ADD CONSTRAINT "user_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."task"("task_id");



ALTER TABLE ONLY "public"."user_tasks"
    ADD CONSTRAINT "user_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("user_id");



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."check_record" TO "anon";
GRANT ALL ON TABLE "public"."check_record" TO "authenticated";
GRANT ALL ON TABLE "public"."check_record" TO "service_role";



GRANT ALL ON SEQUENCE "public"."check_record_record_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."check_record_record_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."check_record_record_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."company" TO "anon";
GRANT ALL ON TABLE "public"."company" TO "authenticated";
GRANT ALL ON TABLE "public"."company" TO "service_role";



GRANT ALL ON SEQUENCE "public"."company_company_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."company_company_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."company_company_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."establishment" TO "anon";
GRANT ALL ON TABLE "public"."establishment" TO "authenticated";
GRANT ALL ON TABLE "public"."establishment" TO "service_role";



GRANT ALL ON SEQUENCE "public"."establishment_establishment_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."establishment_establishment_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."establishment_establishment_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."evidence" TO "anon";
GRANT ALL ON TABLE "public"."evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."evidence" TO "service_role";



GRANT ALL ON SEQUENCE "public"."evidence_evidence_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."evidence_evidence_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."evidence_evidence_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product" TO "anon";
GRANT ALL ON TABLE "public"."product" TO "authenticated";
GRANT ALL ON TABLE "public"."product" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_product_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_product_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_product_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products_establishment" TO "anon";
GRANT ALL ON TABLE "public"."products_establishment" TO "authenticated";
GRANT ALL ON TABLE "public"."products_establishment" TO "service_role";



GRANT ALL ON TABLE "public"."route" TO "anon";
GRANT ALL ON TABLE "public"."route" TO "authenticated";
GRANT ALL ON TABLE "public"."route" TO "service_role";



GRANT ALL ON SEQUENCE "public"."route_route_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."route_route_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."route_route_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."task" TO "anon";
GRANT ALL ON TABLE "public"."task" TO "authenticated";
GRANT ALL ON TABLE "public"."task" TO "service_role";



GRANT ALL ON SEQUENCE "public"."task_task_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."task_task_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."task_task_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_profile" TO "anon";
GRANT ALL ON TABLE "public"."user_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profile" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_profile_user_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_profile_user_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_profile_user_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_tasks" TO "anon";
GRANT ALL ON TABLE "public"."user_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tasks" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






