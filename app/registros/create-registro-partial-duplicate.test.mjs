import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const TEMP_ACTIONS_RUNTIME_DIR = mkdtempSync(join(tmpdir(), "reporteria-actions-runtime-"));
let actionsRuntimePromise;

function createQueryBuilder(table, state) {
  const builder = {
    data: table === "evidence" ? state.evidenceRows : null,
    error: null,
    select() {
      return builder;
    },
    eq(column, value) {
      if (table === "check_record" && state.pendingUpdate && column === "record_id") {
        state.updateRecordId = value;
      }
      return builder;
    },
    lte() {
      return builder;
    },
    gt() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    in() {
      return builder;
    },
    delete() {
      return builder;
    },
    insert(payload) {
      state.insertCalls.push({ table, payload });
      return {
        ...builder,
        select() {
          return {
            ...builder,
            async single() {
              return { data: { record_id: state.insertedRecordId }, error: null };
            },
          };
        },
      };
    },
    update(payload) {
      state.pendingUpdate = payload;
      return builder;
    },
    async maybeSingle() {
      switch (table) {
        case "user_profile":
          return {
            data: {
              user_id: state.profileUserId,
              role: state.role,
            },
            error: null,
          };
        case "route":
          return {
            data: {
              route_id: state.routeId,
              assigned_user: state.profileUserId,
            },
            error: null,
          };
        case "route_lapso":
          return {
            data: {
              lapso_id: state.lapsoId,
              user_id: state.profileUserId,
            },
            error: null,
          };
        case "establishment":
          return {
            data: {
              establishment_id: state.establishmentId,
              route_id: state.routeId,
              is_active: true,
            },
            error: null,
          };
        case "products_establishment":
          return {
            data: {
              product_id: state.productId,
            },
            error: null,
          };
        case "check_record":
          return {
            data: state.recordRow,
            error: null,
          };
        default:
          return { data: null, error: null };
      }
    },
  };
  return builder;
}

function createSupabaseRuntimeState(overrides = {}) {
  const state = {
    routeId: 1,
    establishmentId: 2,
    productId: 3,
    profileUserId: 77,
    role: "rutero",
    lapsoId: 88,
    insertedRecordId: 901,
    evidenceRows: [],
    recordRow: null,
    insertCalls: [],
    pendingUpdate: null,
    updateRecordId: null,
    closeCalls: [],
    revalidatedPaths: [],
    redirects: [],
    ...overrides,
  };
  const client = {
    auth: {
      async getUser() {
        return {
          data: {
            user: { id: "auth-user-1" },
          },
        };
      },
    },
    from(table) {
      return createQueryBuilder(table, state);
    },
    storage: {
      from() {
        return {
          async upload() {
            return { error: null };
          },
          async remove() {
            return { error: null };
          },
        };
      },
    },
  };
  return { state, client };
}

function buildCreateFormData(overrides = {}) {
  const formData = new FormData();
  const values = {
    routeId: "1",
    establishmentId: "2",
    productId: "3",
    systemInventory: "-3",
    realInventory: "-1",
    comments: "",
    manualEvidenceCount: "0",
    evidenceGeoJson: "[]",
    source: "manual",
    backHref: "/registros",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

function buildUpdateFormData(overrides = {}) {
  const formData = new FormData();
  const values = {
    recordId: "44",
    systemInventory: "-5",
    realInventory: "-2",
    comments: "",
    manualEvidenceCount: "0",
    evidenceGeoJson: "[]",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

function getRecordedUpdate(state) {
  if (!state.pendingUpdate) {
    throw new Error("Expected update payload to be recorded.");
  }
  return { recordId: state.updateRecordId, payload: state.pendingUpdate };
}

async function loadActionsRuntime() {
  if (!actionsRuntimePromise) {
    const stubsDir = join(TEMP_ACTIONS_RUNTIME_DIR, "stubs");
    mkdirSync(stubsDir, { recursive: true });
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: "actions.ts",
    }).outputText
      .replace('from "next/cache"', 'from "./stubs/next-cache.mjs"')
      .replace('from "next/navigation"', 'from "./stubs/next-navigation.mjs"')
      .replace('from "@/lib/auth/roles"', 'from "./stubs/roles.mjs"')
      .replace('from "@/lib/route-lapsos"', 'from "./stubs/route-lapsos.mjs"')
      .replace('from "@/lib/supabase/server"', 'from "./stubs/supabase-server.mjs"')
      .replace('from "./duplicate-check-record.mjs"', 'from "./stubs/duplicate-check-record.mjs"');

    for (const [fileName, contents] of [
      ["next-cache.mjs", 'export function revalidatePath(path) { globalThis.__reporteriaRuntimeState.revalidatedPaths.push(path); }\n'],
      ["next-navigation.mjs", 'export function redirect(url) { globalThis.__reporteriaRuntimeState.redirects.push(url); throw new Error(`redirect:${url}`); }\n'],
      ["roles.mjs", 'export function isAllowedAppRole(role) { return role === "admin" || role === "rutero"; }\n'],
      ["route-lapsos.mjs", 'export async function closeRouteLapsoIfFullyRegisteredAfterRecord(_supabase, recordId) { globalThis.__reporteriaRuntimeState.closeCalls.push(recordId); return { closed: false, routeId: null, establishmentId: null }; }\n'],
      ["supabase-server.mjs", 'export async function createSupabaseServerClient() { return globalThis.__reporteriaSupabaseClient; }\n'],
      ["duplicate-check-record.mjs", 'export const DUPLICATE_REGISTRO_ERROR = "Ya existe un registro para este producto en este establecimiento durante el lapso activo. Puedes editar el registro existente.";\nexport function isDuplicateCheckRecordInsertError(error) { return Boolean(error && error.code === "23505" && error.message === DUPLICATE_REGISTRO_ERROR); }\n'],
    ]) writeFileSync(join(stubsDir, fileName), contents, "utf8");
    writeFileSync(join(TEMP_ACTIONS_RUNTIME_DIR, "actions.runtime.mjs"), transpiled, "utf8");
    actionsRuntimePromise = import(pathToFileURL(join(TEMP_ACTIONS_RUNTIME_DIR, "actions.runtime.mjs")).href);
  }
  return actionsRuntimePromise;
}

test("manual create treats a partial existing record as a duplicate instead of resuming it", () => {
  assert.doesNotMatch(source, /function\s+getRecoverableExistingRecord/);
  assert.doesNotMatch(source, /resumedExistingRecord:\s*true/);
  assert.doesNotMatch(source, /resumeUploadFromIndex/);
});

test("manual create checks any existing lapso record before inserting", () => {
  assert.match(source, /findExistingLapsoRecordId/);
  assert.match(source, /DUPLICATE_REGISTRO_ERROR/);
});

test("server-side evidence validation allows zero photos while keeping max limit", () => {
  assert.doesNotMatch(source, /finalEvidenceCount\s*<\s*1/);
  assert.doesNotMatch(source, /resultingEvidenceCount\s*<\s*1/);
  assert.doesNotMatch(source, /entre 1 y \$\{MAX_EVIDENCE_PER_RECORD\}/);
  assert.match(source, /finalEvidenceCount\s*<\s*0/);
  assert.match(source, /resultingEvidenceCount\s*<\s*0/);
  assert.match(source, /entre 0 y \$\{MAX_EVIDENCE_PER_RECORD\}/);
});

test("inventory parser accepts signed finite values while still rejecting invalid numeric input", () => {
  const parserStart = source.indexOf("function parseOptionalFiniteNumber");
  const parserEnd = source.indexOf("function parseEvidenceGeoList", parserStart);
  const parserBody = source.slice(parserStart, parserEnd);

  assert.match(parserBody, /function\s+parseOptionalFiniteNumber\(/);
  assert.doesNotMatch(source, /function\s+parseOptionalNonNegativeNumber\(/);
  assert.doesNotMatch(parserBody, /parsed\s*<\s*0/);
  assert.match(parserBody, /if\s*\(!Number\.isFinite\(parsed\)\)\s*\{/);
  assert.match(parserBody, /if\s*\(!text\)\s*return null;/);
});

test("create and update registros reuse the signed inventory parser for both inventory fields", () => {
  assert.match(source, /const\s+systemInventory\s*=\s*parseOptionalFiniteNumber\(formData\.get\("systemInventory"\)\)/);
  assert.match(source, /const\s+realInventory\s*=\s*parseOptionalFiniteNumber\(formData\.get\("realInventory"\)\)/);
  assert.match(source, /if\s*\(Number\.isNaN\(systemInventory\)\)\s*\{/);
  assert.match(source, /if\s*\(Number\.isNaN\(realInventory\)\)\s*\{/);
});

test("createRegistroAction sends negative inventory values to Supabase inserts", async () => {
  const runtime = await loadActionsRuntime();
  const { state, client } = createSupabaseRuntimeState();
  globalThis.__reporteriaRuntimeState = state;
  globalThis.__reporteriaSupabaseClient = client;

  const result = await runtime.createRegistroAction(null, buildCreateFormData());
  const [{ table, payload }] = state.insertCalls;

  assert.equal(result.success, true);
  assert.equal(result.recordId, state.insertedRecordId);
  assert.equal(table, "check_record");
  assert.equal(payload.system_inventory, -3);
  assert.equal(payload.real_inventory, -1);
  assert.equal(payload.evidence_num, 0);
});

test("createRegistroAction keeps blank inventory values as null in Supabase inserts", async () => {
  const runtime = await loadActionsRuntime();
  const { state, client } = createSupabaseRuntimeState({ insertedRecordId: 902 });
  globalThis.__reporteriaRuntimeState = state;
  globalThis.__reporteriaSupabaseClient = client;

  const result = await runtime.createRegistroAction(
    null,
    buildCreateFormData({ systemInventory: "", realInventory: "" }),
  );
  const [{ payload }] = state.insertCalls;

  assert.equal(result.success, true);
  assert.equal(payload.system_inventory, null);
  assert.equal(payload.real_inventory, null);
  assert.equal(payload.evidence_num, 0);
});

test("updateRegistroAction sends negative inventory values to Supabase updates", async () => {
  const runtime = await loadActionsRuntime();
  const { state, client } = createSupabaseRuntimeState({
    recordRow: {
      record_id: 44,
      user_id: 77,
      product_id: 3,
      establishment_id: 2,
      lapso_id: 88,
      time_date: "2026-07-02T00:00:00.000Z",
    },
  });
  globalThis.__reporteriaRuntimeState = state;
  globalThis.__reporteriaSupabaseClient = client;

  const result = await runtime.updateRegistroAction(null, buildUpdateFormData());
  const recordedUpdate = getRecordedUpdate(state);

  assert.equal(result.success, true);
  assert.equal(result.recordId, 44);
  assert.equal(recordedUpdate.recordId, 44);
  assert.equal(recordedUpdate.payload.system_inventory, -5);
  assert.equal(recordedUpdate.payload.real_inventory, -2);
  assert.equal(recordedUpdate.payload.evidence_num, 0);
});

test("updateRegistroAction keeps blank inventory values as null in Supabase updates", async () => {
  const runtime = await loadActionsRuntime();
  const { state, client } = createSupabaseRuntimeState({
    recordRow: {
      record_id: 45,
      user_id: 77,
      product_id: 3,
      establishment_id: 2,
      lapso_id: 88,
      time_date: "2026-07-02T00:00:00.000Z",
    },
  });
  globalThis.__reporteriaRuntimeState = state;
  globalThis.__reporteriaSupabaseClient = client;

  const result = await runtime.updateRegistroAction(
    null,
    buildUpdateFormData({ recordId: "45", systemInventory: "", realInventory: "" }),
  );
  const recordedUpdate = getRecordedUpdate(state);

  assert.equal(result.success, true);
  assert.equal(result.recordId, 45);
  assert.equal(recordedUpdate.recordId, 45);
  assert.equal(recordedUpdate.payload.system_inventory, null);
  assert.equal(recordedUpdate.payload.real_inventory, null);
  assert.equal(recordedUpdate.payload.evidence_num, 0);
});

test("manual create resolves lapso from the actual record timestamp", () => {
  const createStart = source.indexOf("export async function createRegistroAction");
  const insertStart = source.indexOf('.from("check_record")', createStart);
  const createBody = source.slice(createStart, insertStart);

  assert.match(createBody, /const\s+recordTimeDateIso\s*=/);
  assert.match(createBody, /const\s+lapsoLookupInstantIso\s*=\s*new Date\(\)\.toISOString\(\)/);
  assert.match(createBody, /resolveWritableRouteContext\(auth, routeId, lapsoLookupInstantIso\)/);
  assert.match(source, /\.lte\("start_at",\s*lapsoLookupInstantIso\)/);
  assert.match(source, /\.gt\("end_at",\s*lapsoLookupInstantIso\)/);
});

test("database trigger enforces check_record lapso consistency", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/20260622000000_enforce_check_record_lapso_consistency.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /create or replace function public\.enforce_check_record_lapso_consistency\(\)/);
  assert.match(migration, /new\.time_date at time zone 'America\/Costa_Rica'/);
  assert.match(migration, /start_at <= v_record_instant/);
  assert.match(migration, /end_at > v_record_instant/);
  assert.match(migration, /before insert or update of time_date, lapso_id, user_id, establishment_id/);
  assert.match(migration, /create trigger trg_enforce_check_record_lapso_consistency/);
});

test("inventory constraint migration only keeps evidence_num non-negative", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/20260702120000_allow_negative_check_record_inventory.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /alter table public\.check_record drop constraint if exists check_record_non_negative_inv;/);
  assert.match(migration, /alter table public\.check_record\s+add constraint check_record_non_negative_inv\s+check \(\(evidence_num is null\) or \(evidence_num >= 0\)\);/);
  assert.doesNotMatch(migration, /system_inventory/);
  assert.doesNotMatch(migration, /real_inventory/);
});

test("checked-in schema snapshots mirror the signed inventory constraint change", () => {
  const publicSchema = readFileSync(
    new URL("../../supabase/schema_public_after_inventory.sql", import.meta.url),
    "utf8",
  );
  const rlsAuditSchema = readFileSync(
    new URL("../../supabase/rls_audit_dump.sql", import.meta.url),
    "utf8",
  );

  for (const snapshot of [publicSchema, rlsAuditSchema]) {
    assert.match(snapshot, /CONSTRAINT "check_record_non_negative_inv" CHECK \(.*"evidence_num" IS NULL.*"evidence_num" >= 0.*\)/);
    assert.doesNotMatch(snapshot, /"system_inventory" >= 0/);
    assert.doesNotMatch(snapshot, /"real_inventory" >= 0/);
  }
});

test("normal edit preserves the existing lapso and timestamp", () => {
  const updateStart = source.indexOf("export async function updateRegistroAction");
  const updateBody = source.slice(updateStart);
  const updatePayloadStart = updateBody.indexOf(".update({");
  const updatePayloadEnd = updateBody.indexOf("})", updatePayloadStart);
  const updatePayload = updateBody.slice(updatePayloadStart, updatePayloadEnd);

  assert.match(updateBody, /\.select\("record_id, user_id, product_id, establishment_id, lapso_id, time_date"\)/);
  assert.doesNotMatch(updatePayload, /lapso_id\s*:/);
  assert.doesNotMatch(updatePayload, /time_date\s*:/);
});

test("registro writes no longer use current-week lapso selection", () => {
  assert.doesNotMatch(source, /getRouteLapsoWeekStartAt/);
  assert.doesNotMatch(source, /\.gte\("start_at", currentWeekStartIso\)/);
});
