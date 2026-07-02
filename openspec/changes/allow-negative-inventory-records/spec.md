## Molecular Spec: Allow negative inventory values in registros

### Source Inputs
- Issue/request: present — owner needs registros to accept negative `inventario sistema` and `inventario real`.
- Primary docs: `openspec/changes/fix-check-record-lapso-consistency/spec.md`
- Targeted code checked: `app/registros/registro-form.tsx`, `app/registros/actions.ts`, `app/registros/nuevo/page.tsx`, `app/registros/[recordId]/editar/page.tsx`, `app/mis-rutas/[routeId]/establecimientos/detail-data.ts`, `supabase/migrations/20260206063050_profile_photo_bucket_private.sql`, `supabase/schema_public_after_inventory.sql`, `supabase/rls_audit_dump.sql`, `supabase/migrations/20260209153000_route_lapso_and_check_record_scope.sql`, `supabase/migrations/20260622000000_enforce_check_record_lapso_consistency.sql`, `supabase/migrations/20260208150000_rls_reports_roles.sql`

### Intended Behavior
`check_record.system_inventory` and `check_record.real_inventory` must accept negative integers during create and edit flows. Empty values may still remain null. Evidence limits, lapso resolution, duplicate prevention, and ownership/RLS rules must stay unchanged.

### Capability / Domain
Mobile registros flow for `check_record` creation/editing, plus the persisted database constraint on inventory columns.

### Acceptance Scenarios
- GIVEN a user creates a registro with `inventario sistema = -3` and `inventario real = -1` WHEN the form is submitted THEN the frontend accepts the values and the `check_record` row is inserted with those negative integers.
- GIVEN a user edits an existing registro and changes one or both inventory values to negative integers WHEN the form is submitted THEN the update succeeds and preserves the existing lapso/evidence rules.
- GIVEN the inventory inputs are blank WHEN the form is submitted THEN null inventory values remain allowed.
- GIVEN evidence count, lapso assignment, duplicate-record checks, and user ownership validations are otherwise valid WHEN inventory values are negative THEN those flows continue behaving exactly as before.

### Minimal Affected Areas
- `app/registros/registro-form.tsx` — remove `min={0}` from both numeric inputs so the browser/mobile UI stops blocking negatives.
- `app/registros/actions.ts` — replace the non-negative parser with a generic optional numeric parser for `systemInventory` and `realInventory` in create/update actions.
- `supabase/migrations/*` — add a migration that drops/recreates `check_record_non_negative_inv` so only `evidence_num >= 0` remains enforced.
- `supabase/schema_public_after_inventory.sql` / `supabase/rls_audit_dump.sql` — update checked-in schema snapshots if this repo expects them to mirror the live schema.

### Risks
- Existing reports/admin consumers outside this exact form may assume inventories are non-negative; they should be spot-checked before rollout.
- If schema snapshot files are part of the review expectation, generated diff size can grow even though the runtime change is small.

### Owner Questions
- None

### Ready for Design
Yes — implementation looks small and targeted, with one frontend parser/UI change and one database constraint migration.
