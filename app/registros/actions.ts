"use server";

import { revalidatePath } from "next/cache";
import { isAllowedAppRole, type AllowedAppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EvidenceGeoInfo, RegistroActionState } from "./types";

const EVIDENCE_BUCKET = "check-evidences";
const MAX_EVIDENCE_PER_RECORD = 6;
const MAX_EVIDENCE_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_EVIDENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const INITIAL_REGISTRO_STATE: RegistroActionState = {
  error: null,
  success: false,
  recordId: null,
};

type AuthContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  authUserId: string;
  profileUserId: number;
  role: AllowedAppRole;
};

type WritableRouteContext = {
  routeId: number;
  lapsoId: number;
  lapsoUserId: number;
};

type EvidencePayload = {
  files: File[];
  geos: EvidenceGeoInfo[];
  removeEvidenceIds: number[];
};

type ExistingEvidenceRow = {
  evidence_id: number;
  url: string;
};

function parseIntegerField(formData: FormData, fieldName: string) {
  return Number(String(formData.get(fieldName) ?? "").trim());
}

function parseOptionalNonNegativeNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.NaN;
  }

  return parsed;
}

function parseEvidenceGeoList(rawJson: string): EvidenceGeoInfo[] | null {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return null;

    const normalized: EvidenceGeoInfo[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") return null;
      const lat = Number((item as { lat?: unknown }).lat);
      const lng = Number((item as { lng?: unknown }).lng);
      const accuracyRaw = (item as { accuracy?: unknown }).accuracy;
      const accuracy =
        typeof accuracyRaw === "number" && Number.isFinite(accuracyRaw)
          ? accuracyRaw
          : null;
      const capturedAtRaw = String((item as { capturedAt?: unknown }).capturedAt ?? "");

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !capturedAtRaw.trim()) {
        return null;
      }

      normalized.push({
        lat,
        lng,
        accuracy,
        capturedAt: capturedAtRaw,
      });
    }

    return normalized;
  } catch {
    return null;
  }
}

function parseRemoveEvidenceIds(rawJson: string): number[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];

    return [...new Set(parsed.map((value) => Number(value)).filter(Number.isFinite))];
  } catch {
    return [];
  }
}

function getFileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function toStoragePath(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return null;
  return value;
}

function parseEvidencePayload(formData: FormData): EvidencePayload | null {
  const files = formData
    .getAll("evidenceFiles")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const geos = parseEvidenceGeoList(String(formData.get("evidenceGeoJson") ?? "[]"));
  const removeEvidenceIds = parseRemoveEvidenceIds(
    String(formData.get("removeEvidenceIdsJson") ?? "[]"),
  );

  if (!geos) return null;
  if (files.length > 0 && geos.length !== files.length) return null;
  if (files.length === 0 && geos.length > 0) return null;

  const hasInvalidFile = files.some((file) => {
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type)) return true;
    if (file.size > MAX_EVIDENCE_FILE_BYTES) return true;
    return false;
  });

  if (hasInvalidFile) return null;

  return { files, geos, removeEvidenceIds };
}

async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profile")
    .select("user_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.user_id || !isAllowedAppRole(profile.role)) {
    return null;
  }

  return {
    supabase,
    authUserId: user.id,
    profileUserId: profile.user_id,
    role: profile.role,
  };
}

async function resolveWritableRouteContext(
  auth: AuthContext,
  routeId: number,
): Promise<{ context: WritableRouteContext | null; error: string | null }> {
  const { supabase, profileUserId, role } = auth;

  const { data: routeRow } = await supabase
    .from("route")
    .select("route_id, assigned_user")
    .eq("route_id", routeId)
    .maybeSingle();

  if (!routeRow) {
    return { context: null, error: "Ruta invalida." };
  }

  if (role === "rutero" && routeRow.assigned_user !== profileUserId) {
    return { context: null, error: "No tienes acceso a esta ruta." };
  }

  let lapsoQuery = supabase
    .from("route_lapso")
    .select("lapso_id, user_id")
    .eq("route_id", routeId)
    .eq("status", "en_curso")
    .order("start_at", { ascending: false })
    .limit(1);

  if (role === "rutero") {
    lapsoQuery = lapsoQuery.eq("user_id", profileUserId);
  } else if (typeof routeRow.assigned_user === "number") {
    lapsoQuery = lapsoQuery.eq("user_id", routeRow.assigned_user);
  }

  let { data: lapso } = await lapsoQuery.maybeSingle();

  if (!lapso && role === "admin") {
    const { data: fallbackLapso } = await supabase
      .from("route_lapso")
      .select("lapso_id, user_id")
      .eq("route_id", routeId)
      .eq("status", "en_curso")
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lapso = fallbackLapso ?? null;
  }

  if (!lapso) {
    return { context: null, error: "No hay lapso activo para registrar datos." };
  }

  return {
    context: {
      routeId,
      lapsoId: lapso.lapso_id,
      lapsoUserId: lapso.user_id,
    },
    error: null,
  };
}

async function validateProductInEstablishment(
  auth: AuthContext,
  routeId: number,
  establishmentId: number,
  productId: number,
): Promise<string | null> {
  const { supabase } = auth;

  const { data: establishment } = await supabase
    .from("establishment")
    .select("establishment_id, route_id, is_active")
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (!establishment || establishment.route_id !== routeId || !establishment.is_active) {
    return "El establecimiento no pertenece a la ruta activa.";
  }

  const { data: relation } = await supabase
    .from("products_establishment")
    .select("product_id")
    .eq("establishment_id", establishmentId)
    .eq("product_id", productId)
    .maybeSingle();

  if (!relation) {
    return "El producto no pertenece al establecimiento seleccionado.";
  }

  return null;
}

async function uploadEvidenceRows(params: {
  auth: AuthContext;
  recordId: number;
  files: File[];
  geos: EvidenceGeoInfo[];
}): Promise<{ error: string | null }> {
  const { auth, recordId, files, geos } = params;
  const uploadedPaths: string[] = [];

  for (const file of files) {
    const extension = getFileExtension(file);
    const objectPath = `${auth.authUserId}/${recordId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await auth.supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(objectPath, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      if (uploadedPaths.length > 0) {
        await auth.supabase.storage.from(EVIDENCE_BUCKET).remove(uploadedPaths);
      }
      return { error: "No se pudieron subir las evidencias." };
    }

    uploadedPaths.push(objectPath);
  }

  if (uploadedPaths.length === 0) return { error: null };

  const rows = uploadedPaths.map((path, index) => ({
    record_id: recordId,
    url: path,
    geo_info: JSON.stringify(geos[index]),
  }));

  const { error: insertError } = await auth.supabase.from("evidence").insert(rows);
  if (insertError) {
    await auth.supabase.storage.from(EVIDENCE_BUCKET).remove(uploadedPaths);
    return { error: "No se pudieron asociar las evidencias al registro." };
  }

  return { error: null };
}

async function deleteEvidenceRows(
  auth: AuthContext,
  recordId: number,
  evidenceIds: number[],
  existingEvidenceRows: ExistingEvidenceRow[],
) {
  if (evidenceIds.length === 0) return;

  const removable = existingEvidenceRows.filter((row) => evidenceIds.includes(row.evidence_id));
  if (removable.length === 0) return;

  await auth.supabase
    .from("evidence")
    .delete()
    .eq("record_id", recordId)
    .in(
      "evidence_id",
      removable.map((row) => row.evidence_id),
    );

  const storagePaths = removable
    .map((row) => toStoragePath(row.url))
    .filter((value): value is string => value !== null);

  if (storagePaths.length > 0) {
    await auth.supabase.storage.from(EVIDENCE_BUCKET).remove(storagePaths);
  }
}

function revalidateRegistroRelatedPaths(routeId: number, establishmentId: number) {
  revalidatePath("/registros");
  revalidatePath("/registros/nuevo");
  revalidatePath(`/mis-rutas/${routeId}`);
  revalidatePath(`/mis-rutas/${routeId}/pendientes`);
  revalidatePath(`/mis-rutas/${routeId}/completadas`);
  revalidatePath(`/mis-rutas/${routeId}/establecimientos/${establishmentId}`);
}


export async function uploadSingleEvidenceAction(
  _prevState: any,
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return { error: "No autorizado", success: false };
    }

    const recordId = Number(formData.get("recordId"));
    if (!Number.isFinite(recordId)) {
      return { error: "ID de registro inválido", success: false };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Archivo inválido", success: false };
    }

    // Double check size limit server side
    if (file.size > MAX_EVIDENCE_FILE_BYTES) {
      return { error: "El archivo excede el límite de 8MB", success: false };
    }

    const geoJson = String(formData.get("geoJson") ?? "{}");
    let geoInfo: EvidenceGeoInfo | null = null;
    try {
        geoInfo = JSON.parse(geoJson);
    } catch {
        // ignore
    }

    const extension = getFileExtension(file);
    const objectPath = `${auth.authUserId}/${recordId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await auth.supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(objectPath, file, {
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      return { error: "Error al subir a storage", success: false };
    }

    const { error: insertError } = await auth.supabase.from("evidence").insert({
      record_id: recordId,
      url: objectPath,
      geo_info: geoInfo ? JSON.stringify(geoInfo) : null,
    });

    if (insertError) {
      await auth.supabase.storage.from(EVIDENCE_BUCKET).remove([objectPath]);
      return { error: "Error guardando referencia", success: false };
    }

    return { error: null, success: true };
  } catch (err: any) {
    return { error: err.message || "Error desconocido", success: false };
  }
}


export async function createRegistroAction(
  _prevState: RegistroActionState,
  formData: FormData,
): Promise<RegistroActionState> {
  const routeId = parseIntegerField(formData, "routeId");
  const establishmentId = parseIntegerField(formData, "establishmentId");
  const productId = parseIntegerField(formData, "productId");
  const systemInventory = parseOptionalNonNegativeNumber(formData.get("systemInventory"));
  const realInventory = parseOptionalNonNegativeNumber(formData.get("realInventory"));
  const comments = String(formData.get("comments") ?? "").trim();
  const manualEvidenceCount = parseOptionalNonNegativeNumber(formData.get("manualEvidenceCount"));
  const evidencePayload = parseEvidencePayload(formData);

  if (!Number.isFinite(routeId) || !Number.isFinite(establishmentId) || !Number.isFinite(productId)) {
    return { ...INITIAL_REGISTRO_STATE, error: "Debes seleccionar ruta, establecimiento y producto." };
  }

  if (Number.isNaN(systemInventory)) {
    return { ...INITIAL_REGISTRO_STATE, error: "El inventario sistema no es válido." };
  }

  if (Number.isNaN(realInventory)) {
    return { ...INITIAL_REGISTRO_STATE, error: "El inventario real no es válido." };
  }

  const isManualMode = manualEvidenceCount !== null && manualEvidenceCount > 0;

  if (!isManualMode && evidencePayload === null) {
    return {
      ...INITIAL_REGISTRO_STATE,
      error: "Error en las evidencias o geolocalización.",
    };
  }

  // Count files: if manual, we trust the param, otherwise we take the payload count
  const finalEvidenceCount = isManualMode 
     ? manualEvidenceCount 
     : evidencePayload!.files.length;

  if (finalEvidenceCount < 1 || finalEvidenceCount > MAX_EVIDENCE_PER_RECORD) {
    return {
      ...INITIAL_REGISTRO_STATE,
      error: `Debes adjuntar entre 1 y ${MAX_EVIDENCE_PER_RECORD} evidencias.`,
    };
  }

  const auth = await getAuthContext();
  if (!auth) {
    return { ...INITIAL_REGISTRO_STATE, error: "Sesion no valida." };
  }

  const routeContextResult = await resolveWritableRouteContext(auth, routeId);
  if (!routeContextResult.context) {
    return { ...INITIAL_REGISTRO_STATE, error: routeContextResult.error };
  }

  const relationError = await validateProductInEstablishment(
    auth,
    routeId,
    establishmentId,
    productId,
  );
  if (relationError) {
    return { ...INITIAL_REGISTRO_STATE, error: relationError };
  }

  const { data: insertedRecord, error: insertError } = await auth.supabase
    .from("check_record")
    .insert({
      lapso_id: routeContextResult.context.lapsoId,
      user_id: routeContextResult.context.lapsoUserId,
      establishment_id: establishmentId,
      product_id: productId,
      system_inventory: systemInventory,
      real_inventory: realInventory,
      evidence_num: finalEvidenceCount,
      comments: comments || null,
      time_date: new Date().toISOString(),
    })
    .select("record_id")
    .single();

  if (insertError || !insertedRecord) {
    return { ...INITIAL_REGISTRO_STATE, error: "No se pudo crear el registro." };
  }

  // Only upload here if NOT manual mode
  if (!isManualMode && evidencePayload && evidencePayload.files.length > 0) {
    const uploadResult = await uploadEvidenceRows({
        auth,
        recordId: insertedRecord.record_id,
        files: evidencePayload.files,
        geos: evidencePayload.geos,
    });

    if (uploadResult.error) {
        await auth.supabase
        .from("check_record")
        .delete()
        .eq("record_id", insertedRecord.record_id);

        return { ...INITIAL_REGISTRO_STATE, error: uploadResult.error };
    }
  }

  revalidateRegistroRelatedPaths(routeId, establishmentId);
  revalidatePath(`/registros/${insertedRecord.record_id}/editar`);

  return {
    error: null,
    success: true,
    recordId: insertedRecord.record_id,
  };
}


export async function updateRegistroAction(
  _prevState: RegistroActionState,
  formData: FormData,
): Promise<RegistroActionState> {
  const recordId = parseIntegerField(formData, "recordId");
  const systemInventory = parseOptionalNonNegativeNumber(formData.get("systemInventory"));
  const realInventory = parseOptionalNonNegativeNumber(formData.get("realInventory"));
  const comments = String(formData.get("comments") ?? "").trim();
  const manualEvidenceCount = parseOptionalNonNegativeNumber(formData.get("manualEvidenceCount"));
  const evidencePayload = parseEvidencePayload(formData);

  if (!Number.isFinite(recordId)) {
    return { ...INITIAL_REGISTRO_STATE, error: "Registro invalido." };
  }

  if (Number.isNaN(systemInventory)) {
    return { ...INITIAL_REGISTRO_STATE, error: "El inventario sistema no es válido." };
  }

  if (Number.isNaN(realInventory)) {
    return { ...INITIAL_REGISTRO_STATE, error: "El inventario real no es válido." };
  }

  const isManualMode = manualEvidenceCount !== null && manualEvidenceCount >= 0;

  if (!isManualMode && evidencePayload === null) {
    return {
      ...INITIAL_REGISTRO_STATE,
      error: "Error en las evidencias o geolocalización.",
    };
  }

  const auth = await getAuthContext();
  if (!auth) {
    return { ...INITIAL_REGISTRO_STATE, error: "Sesion no valida." };
  }

  const { data: recordRow } = await auth.supabase
    .from("check_record")
    .select("record_id, user_id, product_id, establishment_id")
    .eq("record_id", recordId)
    .maybeSingle();

  if (!recordRow) {
    return { ...INITIAL_REGISTRO_STATE, error: "No se encontro el registro." };
  }

  if (auth.role === "rutero" && recordRow.user_id !== auth.profileUserId) {
    return { ...INITIAL_REGISTRO_STATE, error: "No tienes acceso a este registro." };
  }

  const { data: establishment } = await auth.supabase
    .from("establishment")
    .select("route_id, is_active")
    .eq("establishment_id", recordRow.establishment_id)
    .maybeSingle();

  if (!establishment?.is_active || !Number.isFinite(establishment.route_id)) {
    return { ...INITIAL_REGISTRO_STATE, error: "El establecimiento ya no esta disponible." };
  }

  if (auth.role === "rutero") {
    const { data: routeRow } = await auth.supabase
      .from("route")
      .select("assigned_user")
      .eq("route_id", establishment.route_id)
      .maybeSingle();

    if (!routeRow || routeRow.assigned_user !== auth.profileUserId) {
      return { ...INITIAL_REGISTRO_STATE, error: "No tienes acceso a la ruta de este registro." };
    }
  }

  const { data: lapso } = await auth.supabase
    .from("route_lapso")
    .select("lapso_id")
    .eq("route_id", establishment.route_id)
    .eq("user_id", recordRow.user_id)
    .eq("status", "en_curso")
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lapso?.lapso_id) {
    return { ...INITIAL_REGISTRO_STATE, error: "No hay lapso activo para editar este registro." };
  }

  const { data: existingEvidenceRows } = await auth.supabase
    .from("evidence")
    .select("evidence_id, url")
    .eq("record_id", recordId);

  const evidenceRows = (existingEvidenceRows ?? []) as ExistingEvidenceRow[];
  
  const removableIds = evidencePayload 
    ? evidencePayload.removeEvidenceIds.filter((id) =>
        evidenceRows.some((row) => row.evidence_id === id))
    : parseRemoveEvidenceIds(String(formData.get("removeEvidenceIdsJson") ?? "[]"));

  const newFilesCount = isManualMode 
      ? manualEvidenceCount! // if isManualMode, manualEvidenceCount is checked >= 0
      : evidencePayload!.files.length;

  if (newFilesCount > MAX_EVIDENCE_PER_RECORD) {
    return {
      ...INITIAL_REGISTRO_STATE,
      error: "No puedes subir mas de 6 evidencias nuevas.",
    };
  }

  const resultingEvidenceCount =
    evidenceRows.length - removableIds.length + newFilesCount;

  if (
    resultingEvidenceCount < 1 ||
    resultingEvidenceCount > MAX_EVIDENCE_PER_RECORD
  ) {
    return {
      ...INITIAL_REGISTRO_STATE,
      error: `El registro debe conservar entre 1 y ${MAX_EVIDENCE_PER_RECORD} evidencias.`,
    };
  }

  const { error: updateError } = await auth.supabase
    .from("check_record")
    .update({
      lapso_id: lapso.lapso_id,
      system_inventory: systemInventory,
      real_inventory: realInventory,
      evidence_num: resultingEvidenceCount,
      comments: comments || null,
      time_date: new Date().toISOString(),
    })
    .eq("record_id", recordId);

  if (updateError) {
    return { ...INITIAL_REGISTRO_STATE, error: "No se pudo actualizar el registro." };
  }

  // Handle deletions first
  await deleteEvidenceRows(auth, recordId, removableIds, evidenceRows);

  // Upload new files if NOT manual mode
  if (!isManualMode && evidencePayload && evidencePayload.files.length > 0) {
    const uploadResult = await uploadEvidenceRows({
        auth,
        recordId,
        files: evidencePayload.files,
        geos: evidencePayload.geos,
    });

    if (uploadResult.error) {
        return { ...INITIAL_REGISTRO_STATE, error: uploadResult.error };
    }
  }

  revalidateRegistroRelatedPaths(establishment.route_id, recordRow.establishment_id);
  revalidatePath(`/registros/${recordId}/editar`);

  return {
    error: null,
    success: true,
    recordId,
  };
}
