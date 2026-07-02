# Design: Allow Negative Inventory Records

## Technical Approach

Allow negative `system_inventory` and `real_inventory` at every enforcement layer used by registros: mobile/browser inputs, Server Action parsing, and the Postgres `check_record_non_negative_inv` constraint. Keep evidence limits, lapso resolution, duplicate prevention, ownership checks, and RLS unchanged.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Validation boundary | Remove only non-negative validation for inventory fields | Add a feature flag or bypass validation only in some flows | Requirement applies to create/edit generally; a flag adds rollout complexity without changing data sensitivity. |
| Parser behavior | Rename/replace `parseOptionalNonNegativeNumber` with an optional finite-number parser | Inline parsing in create/update | Shared parser keeps create/update behavior identical and avoids one flow drifting. |
| DB constraint | Drop/recreate `check_record_non_negative_inv` to enforce only `evidence_num >= 0` | Delete the constraint entirely | Evidence count must remain protected by DB; inventory sign is the only rule changing. |
| Schema snapshots | Update snapshots if this repo treats them as review artifacts | Migration only | `schema_public_after_inventory.sql` and `rls_audit_dump.sql` currently contain the old constraint, so stale snapshots would mislead reviewers. |

## Data Flow

```text
RegistroForm number inputs (- allowed)
  └─ FormData systemInventory/realInventory
      └─ createRegistroAction/updateRegistroAction
          └─ optional finite-number parser: "" -> null, "-3" -> -3, invalid -> NaN
              └─ Supabase insert/update check_record
                  └─ DB constraint validates evidence_num only
```

## File Changes

| File | Action | Description |
|---|---|---|
| `app/registros/registro-form.tsx` | Modify | Remove `min={0}` from both inventory inputs so mobile/browser validation accepts negatives. |
| `app/registros/actions.ts` | Modify | Replace non-negative inventory parser with optional finite-number parser used by both create and update. |
| `supabase/migrations/<timestamp>_allow_negative_check_record_inventory.sql` | Create | Drop/recreate `check_record_non_negative_inv` with only `evidence_num IS NULL OR evidence_num >= 0`. |
| `supabase/schema_public_after_inventory.sql` | Modify | Mirror the updated check constraint if snapshots are maintained in this branch. |
| `supabase/rls_audit_dump.sql` | Modify | Mirror the updated check constraint in the audit dump if expected. |
| `app/registros/create-registro-partial-duplicate.test.mjs` | Modify | Add source-level tests proving negative inventory parsing is no longer rejected and evidence constraint remains. |
| `app/registros/registro-form-submit-messages.test.mjs` | Modify | Add source-level test proving inventory inputs no longer render `min={0}`. |

## Interfaces / Contracts

No public API changes. Existing form field names stay the same:

```ts
systemInventory: string | null; // "" -> null, finite numbers including negatives allowed
realInventory: string | null;   // invalid/non-finite -> action validation error
```

Database contract after migration:

```sql
constraint check_record_non_negative_inv
check ((evidence_num is null) or (evidence_num >= 0))
```

RLS policies are unaffected; they do not inspect inventory sign.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit/source | Inputs allow negative values | Node test reads `registro-form.tsx` and asserts the two inventory fields do not include `min={0}`. |
| Unit/source | Parser permits negatives but rejects invalid values | Node test reads `actions.ts` and asserts the parser no longer checks `< 0`, create/update still reject `Number.isNaN(...)`. |
| DB verification | Constraint allows negative inventory and still rejects negative evidence | Inspect migration SQL; optionally run Supabase migration locally/staging with insert checks. |
| Regression | Existing registro/lapso/evidence behavior | Run `node --test`, `npm run lint`, `npm run build`. |

## Implementation Handoff

### Execution Order

1. Update focused node:test assertions in `app/registros/create-registro-partial-duplicate.test.mjs` and `app/registros/registro-form-submit-messages.test.mjs`.
2. Update `app/registros/registro-form.tsx` and `app/registros/actions.ts`.
3. Add Supabase migration and refresh schema snapshots only if the repo expects checked-in snapshots.
4. Run verification commands.

### Apply Slices

| Slice | Goal | Files to Read/Edit | Acceptance | Verification |
|---|---|---|---|---|
| 1 | Lock expected app behavior | `app/registros/*.test.mjs` | Tests fail before implementation and encode negative-inventory acceptance. | `node --test app/registros/create-registro-partial-duplicate.test.mjs app/registros/registro-form-submit-messages.test.mjs` |
| 2 | Remove frontend/server blockers | `app/registros/registro-form.tsx`, `app/registros/actions.ts` | Create/edit FormData can pass `-3`/`-1`; blanks remain null. | `node --test app/registros/*.test.mjs` |
| 3 | Remove DB blocker | `supabase/migrations/*.sql`, schema snapshots | DB no longer rejects negative inventory; negative evidence remains rejected. | SQL inspection or staging/local migration check |

### Constraints for Apply

- Do not change lapso lookup, duplicate detection, evidence upload flow, or ownership/RLS rules.
- Keep Next.js Server Action pattern in `app/registros/actions.ts`.
- Keep migration small; no data backfill is required.

## Migration / Rollout

No data migration required. Rollout requires deploying the DB migration before or with the app change; otherwise the UI/server will accept values that Postgres rejects. Rollback: restore the old constraint only after confirming no existing rows have negative inventory, or first normalize/delete those values.

## Open Questions

- [ ] Should checked-in schema snapshots be regenerated in this PR, or is migration-only preferred to keep diff size smaller?
