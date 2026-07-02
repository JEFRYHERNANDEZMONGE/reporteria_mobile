"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import MobileSelectField, {
  type MobileSelectOption,
} from "@/app/_components/mobile-select-field";
import { createRegistroAction, updateRegistroAction } from "./actions";
import { buildEvidenceStampLines, stampEvidenceFile } from "./evidence-stamp.mjs";
import { isRegistroSubmitDisabled } from "./registro-form-state.mjs";
import type {
  ActiveRegistroRelation,
  EstablishmentOption,
  EvidenceGeoInfo,
  EvidenceItem,
  ProductEstablishmentRelation,
  ProductOption,
  RegistroActionState,
  RegistroSource,
  RouteOption,
} from "./types";
type RegistroFormProps = {
  mode: "create" | "edit";
  source: RegistroSource;
  backHref: string;
  routeOptions: RouteOption[];
  establishmentOptions: EstablishmentOption[];
  productOptions: ProductOption[];
  productRelations: ProductEstablishmentRelation[];
  activeRegistroRelations: ActiveRegistroRelation[];
  initialRouteId: number | null;
  initialEstablishmentId: number | null;
  initialProductId: number | null;
  initialSystemInventory: number | null;
  initialRealInventory: number | null;
  initialComments: string | null;
  existingEvidences: EvidenceItem[];
  recordId: number | null;
  submitLabel: string;
  currentUserName: string;
};

const INITIAL_ACTION_STATE: RegistroActionState = {
  error: null,
  success: false,
  recordId: null,
};

const TOTAL_EVIDENCE_SLOTS = 6;
const HIDDEN_DUPLICATE_MESSAGE =
  "Ya existe un registro para este producto en este establecimiento durante el lapso activo. Puedes editar el registro existente.";

function toNullableNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildActiveRegistroKey(establishmentId: number, productId: number) {
  return `${establishmentId}:${productId}`;
}

type GeoFailureReason =
  | "unsupported"
  | "insecure"
  | "denied"
  | "timeout"
  | "unavailable"
  | "unknown";

type GeoEvidenceResult =
  | { ok: true; value: EvidenceGeoInfo[] }
  | { ok: false; reason: GeoFailureReason };

function toGeoFailureReason(error: unknown): GeoFailureReason {
  if (!error || typeof error !== "object") return "unknown";

  const maybe = error as Partial<GeolocationPositionError>;
  switch (maybe.code) {
    case 1:
      return "denied";
    case 2:
      return "unavailable";
    case 3:
      return "timeout";
    default:
      return "unknown";
  }
}

function geoFailureMessage(reason: GeoFailureReason): string {
  switch (reason) {
    case "unsupported":
      return "Tu navegador no soporta geolocalizacion.";
    case "insecure":
      return "La geolocalizacion requiere HTTPS.";
    case "denied":
      return "Debes permitir geolocalizacion para adjuntar evidencias. Si ya la bloqueaste, habilitala en la configuracion del navegador.";
    case "timeout":
    case "unavailable":
      return "No pudimos obtener tu ubicacion. Revisa que el GPS/ubicacion este activado e intenta de nuevo.";
    case "unknown":
    default:
      return "No se pudo obtener tu ubicacion. Intenta de nuevo.";
  }
}

async function getCurrentGeoForEvidence(count: number): Promise<GeoEvidenceResult> {
  if (count === 0) return { ok: true, value: [] };
  if (typeof window === "undefined") return { ok: false, reason: "unknown" };
  if (!window.isSecureContext) return { ok: false, reason: "insecure" };
  if (!("geolocation" in navigator)) return { ok: false, reason: "unsupported" };

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, (error) => reject(error), {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });

    const capturedAt = new Date().toISOString();
    const entry: EvidenceGeoInfo = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy)
        ? position.coords.accuracy
        : null,
      capturedAt,
    };

    return { ok: true, value: Array.from({ length: count }, () => ({ ...entry })) };
  } catch (error) {
    return { ok: false, reason: toGeoFailureReason(error) };
  }
}

function buildEstablishmentLabel(
  establishment: EstablishmentOption,
  routeById: Map<number, string>,
) {
  const routeName = routeById.get(establishment.routeId);
  return routeName ? `${establishment.name} | ${routeName}` : establishment.name;
}

export default function RegistroForm({
  mode,
  source,
  backHref,
  routeOptions,
  establishmentOptions,
  productOptions,
  productRelations,
  activeRegistroRelations,
  initialRouteId,
  initialEstablishmentId,
  initialProductId,
  initialSystemInventory,
  initialRealInventory,
  initialComments,
  existingEvidences,
  recordId,
  submitLabel,
  currentUserName,
}: RegistroFormProps) {
  const router = useRouter();
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(initialRouteId);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<number | null>(
    initialEstablishmentId,
  );
  const [selectedProductId, setSelectedProductId] = useState<number | null>(initialProductId);
  const [newEvidenceFiles, setNewEvidenceFiles] = useState<File[]>([]);
  const [newEvidenceGeos, setNewEvidenceGeos] = useState<EvidenceGeoInfo[]>([]);
  const [newEvidencePreviewUrls, setNewEvidencePreviewUrls] = useState<string[]>([]);
  const [failedEvidenceUrls, setFailedEvidenceUrls] = useState<Set<string>>(() => new Set());
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geoPermissionState, setGeoPermissionState] = useState<PermissionState | "unknown">(
    "unknown",
  );
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef(false);

  const routeById = useMemo(
    () => new Map(routeOptions.map((route) => [route.id, route.name])),
    [routeOptions],
  );
  const activeRegistroKeySet = useMemo(
    () =>
      new Set(
        activeRegistroRelations.map((relation) =>
          buildActiveRegistroKey(relation.establishmentId, relation.productId),
        ),
      ),
    [activeRegistroRelations],
  );
  const productIdsByEstablishment = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const relation of productRelations) {
      const current = map.get(relation.establishmentId) ?? [];
      current.push(relation.productId);
      map.set(relation.establishmentId, current);
    }
    return map;
  }, [productRelations]);

  const effectiveEstablishmentId = selectedEstablishmentId;
  const selectedEstablishment = useMemo(
    () => establishmentOptions.find((item) => item.id === effectiveEstablishmentId) ?? null,
    [effectiveEstablishmentId, establishmentOptions],
  );

  const effectiveRouteId = selectedEstablishment?.routeId ?? selectedRouteId;

  const availableProductIds = useMemo(() => {
    if (!effectiveEstablishmentId) return new Set<number>();
    return new Set(
      productRelations
        .filter((relation) => relation.establishmentId === effectiveEstablishmentId)
        .map((relation) => relation.productId),
    );
  }, [effectiveEstablishmentId, productRelations]);

  const filteredProducts = useMemo(
    () => productOptions.filter((product) => availableProductIds.has(product.id)),
    [availableProductIds, productOptions],
  );
  const lockedProductIdsForEstablishment = useMemo(() => {
    if (!effectiveEstablishmentId) return new Set<number>();

    return new Set(
      activeRegistroRelations
        .filter((relation) => relation.establishmentId === effectiveEstablishmentId)
        .map((relation) => relation.productId),
    );
  }, [activeRegistroRelations, effectiveEstablishmentId]);

  const establishmentFieldOptions = useMemo<MobileSelectOption[]>(
    () =>
      establishmentOptions.map((option) => ({
        value: String(option.id),
        label: buildEstablishmentLabel(option, routeById),
        disabled:
          mode === "create" &&
          (() => {
            const productIds = productIdsByEstablishment.get(option.id) ?? [];
            return (
              productIds.length > 0 &&
              productIds.every((productId) =>
                activeRegistroKeySet.has(buildActiveRegistroKey(option.id, productId)),
              )
            );
          })(),
      })),
    [activeRegistroKeySet, establishmentOptions, mode, productIdsByEstablishment, routeById],
  );

  const productFieldOptions = useMemo<MobileSelectOption[]>(
    () =>
      filteredProducts.map((option) => ({
        value: String(option.id),
        label:
          mode === "create" && lockedProductIdsForEstablishment.has(option.id)
            ? `${option.name} (${option.sku}) | Ya registrado`
            : `${option.name} (${option.sku})`,
        disabled: mode === "create" && lockedProductIdsForEstablishment.has(option.id),
      })),
    [filteredProducts, lockedProductIdsForEstablishment, mode],
  );

  const effectiveProductId =
    selectedProductId !== null &&
    filteredProducts.some((option) => option.id === selectedProductId)
      ? selectedProductId
      : null;

  const existingEvidenceUrls = useMemo(
    () => existingEvidences.map((evidence) => evidence.imageUrl),
    [existingEvidences],
  );
  const hasLockedSelection =
    mode === "create" &&
    effectiveEstablishmentId !== null &&
    effectiveProductId !== null &&
    activeRegistroKeySet.has(buildActiveRegistroKey(effectiveEstablishmentId, effectiveProductId));
  const isEstablishmentFullyRegistered =
    mode === "create" &&
    effectiveEstablishmentId !== null &&
    (() => {
      const productIds = productIdsByEstablishment.get(effectiveEstablishmentId) ?? [];
      return (
        productIds.length > 0 &&
        productIds.every((productId) =>
          activeRegistroKeySet.has(buildActiveRegistroKey(effectiveEstablishmentId, productId)),
        )
      );
    })();
  const selectionLockMessage = hasLockedSelection
    ? null
    : isEstablishmentFullyRegistered
      ? "Todos los productos de esta ubicacion ya fueron registrados en el lapso activo."
      : null;

  const evidencePreviewUrls = useMemo(
    () => [...existingEvidenceUrls, ...newEvidencePreviewUrls].slice(0, TOTAL_EVIDENCE_SLOTS),
    [existingEvidenceUrls, newEvidencePreviewUrls],
  );

  const remainingCapacity = TOTAL_EVIDENCE_SLOTS - existingEvidenceUrls.length - newEvidenceFiles.length;
  const totalEvidenceCount = existingEvidenceUrls.length + newEvidenceFiles.length;

  useEffect(() => {
    return () => {
      newEvidencePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newEvidencePreviewUrls]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) return;
    if (!navigator.permissions?.query) return;

    let status: PermissionStatus | null = null;
    let cancelled = false;

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        setGeoPermissionState(result.state);
        result.onchange = () => setGeoPermissionState(result.state);
      })
      .catch(() => {
        // Some browsers (notably Safari) may throw for geolocation permissions query.
      });

    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  useEffect(() => {
    // Sincronizar los archivos con el input antes del submit
    if (evidenceInputRef.current) {
      const dataTransfer = new DataTransfer();
      newEvidenceFiles.forEach((file) => dataTransfer.items.add(file));
      evidenceInputRef.current.files = dataTransfer.files;
    }
  }, [newEvidenceFiles]);

  async function handleEvidenceFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(event.currentTarget.files ?? []);
    const inputElement = event.currentTarget;
    setClientError(null);

    if (fileList.length === 0) {
      if (inputElement) inputElement.value = "";
      return;
    }

    if (fileList.length > remainingCapacity) {
      if (inputElement) inputElement.value = "";
      setClientError(`Solo puedes agregar ${remainingCapacity} evidencias nuevas.`);
      return;
    }

    try {
      const geoResult = await getCurrentGeoForEvidence(fileList.length);

      if (!geoResult.ok) {
        if (inputElement) inputElement.value = "";
        setClientError(geoFailureMessage(geoResult.reason));
        if (geoResult.reason === "denied") setGeoPermissionState("denied");
        return;
      }

      setGeoPermissionState("granted");

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const stampedFiles = await Promise.all(
        fileList.map(async (file, index) => {
          const geo = geoResult.value[index];
          if (!geo) return file;

          const stampLines = buildEvidenceStampLines({
            establishmentName: selectedEstablishment?.name ?? "",
            userName: currentUserName,
            capturedAt: geo.capturedAt,
            lat: geo.lat,
            lng: geo.lng,
            accuracy: geo.accuracy,
            locale: "es-CO",
            timeZone,
          });

          try {
            return await stampEvidenceFile({
              file,
              lines: stampLines,
            });
          } catch (stampError) {
            console.error("No se pudo estampar una evidencia, se subira original procesada.", stampError);
            return file;
          }
        }),
      );

      // Agregar a las evidencias existentes
      setNewEvidenceFiles((prev) => [...prev, ...stampedFiles]);
      setNewEvidenceGeos((prev) => [...prev, ...geoResult.value]);
      setNewEvidencePreviewUrls((prev) => [
        ...prev,
        ...stampedFiles.map((file) => URL.createObjectURL(file)),
      ]);
    } catch (error) {
      console.error(error);
      setClientError(
        error instanceof Error
          ? `Error procesando archivos: ${error.message}`
          : "Ocurrio un error inesperado al procesar las evidencias.",
      );
    } finally {
      // Limpiar el input para permitir seleccionar los mismos archivos de nuevo
      if (inputElement) inputElement.value = "";
    }
  }

  function handleRemoveNewEvidence(index: number) {
    setNewEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
    setNewEvidenceGeos((prev) => prev.filter((_, i) => i !== index));
    setNewEvidencePreviewUrls((prev) => {
      const url = prev[index];
      if (url) {
        URL.revokeObjectURL(url);
      }
      return prev.filter((_, i) => i !== index);
    });
    setClientError(null);
  }

  function handleOpenEvidencePicker() {
    if (isSubmitting) return;
    if (remainingCapacity <= 0) {
      setClientError("Ya alcanzaste el maximo de 6 evidencias.");
      return;
    }
    if (!selectedEstablishment) {
      setClientError("Selecciona ubicacion antes de agregar evidencias.");
      return;
    }

    setClientError(null);

    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setClientError(geoFailureMessage("insecure"));
      return;
    }
    if (!("geolocation" in navigator)) {
      setClientError(geoFailureMessage("unsupported"));
      return;
    }

    // Request location permission before opening the file picker. Some browsers may block the prompt
    // if geolocation is requested after returning from the file picker.
    if (geoPermissionState === "denied") {
      setClientError(geoFailureMessage("denied"));
      return;
    }

    if (geoPermissionState !== "granted") {
      setClientError(
        "Para adjuntar evidencias necesitamos tu ubicacion. Acepta el permiso y luego toca + de nuevo.",
      );
      void (async () => {
        const probe = await getCurrentGeoForEvidence(1);
        if (probe.ok) {
          setGeoPermissionState("granted");
          setClientError(null);
          return;
        }
        if (probe.reason === "denied") setGeoPermissionState("denied");
        setClientError(geoFailureMessage(probe.reason));
      })();
      return;
    }

    evidenceInputRef.current?.click();
  }

  async function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    setClientError(null);
    setServerError(null);
    setUploadStatus(null);
    setIsSubmitting(true);

    try {
        const formData = new FormData(event.currentTarget);
        // Remove heavy files
        formData.delete("evidenceFiles");
        // Remove geos (we don't need them for record creation if manual mode checks manualEvidenceCount)
        // Actually, if we keep them, parseEvidencePayload might fail because file length is 0.
        // So let's delete them.
        formData.delete("evidenceGeoJson");
        formData.append("manualEvidenceCount", String(newEvidenceFiles.length ?? 0));
        
        // Validation reused logic
        const existingCount = existingEvidenceUrls.length;
        const newCount = newEvidenceFiles.length;
        const totalCount = existingCount + newCount;

        if (totalCount < 0 || totalCount > 6) {
            setClientError("Debes tener entre 0 y 6 evidencias en total.");
            setUploadStatus(null);
            submitLockRef.current = false;
            setIsSubmitting(false);
            return;
        }

        // Step 1: Create/Update Record
        const action = mode === "create" ? createRegistroAction : updateRegistroAction;
        const result = await action(INITIAL_ACTION_STATE, formData);

        if (result.error || !result.success || !result.recordId) {
            setServerError(
              result.error === HIDDEN_DUPLICATE_MESSAGE
                ? null
                : result.error || "Error al guardar el registro.",
            );
            setUploadStatus(null);
            submitLockRef.current = false;
            setIsSubmitting(false);
            return;
        }

        const recordId = result.recordId;

        // Step 2: Upload new images one by one
        let uploadErrors = 0;
        const totalFiles = newEvidenceFiles.length;
        for (let i = 0; i < totalFiles; i++) {
            const file = newEvidenceFiles[i];
            const geo = newEvidenceGeos[i];
            
            const uploadFormData = new FormData();
            uploadFormData.append("recordId", String(recordId));
            uploadFormData.append("file", file);
            if (geo) {
                uploadFormData.append("geoJson", JSON.stringify(geo));
            }
            
            setUploadStatus(`Subiendo imagen ${i + 1} de ${totalFiles}...`);

            try {
                const response = await fetch("/api/registros/evidencias", {
                    method: "POST",
                    body: uploadFormData,
                });
                const uploadResult = (await response.json().catch(() => null)) as {
                    error?: string;
                    success?: boolean;
                } | null;

                if (!response.ok || uploadResult?.error || !uploadResult?.success) {
                    console.error(`Error uploading file ${i}:`, uploadResult?.error);
                    uploadErrors++;
                }
            } catch (e) {
                console.error(e);
                uploadErrors++;
            }
        }

        if (uploadErrors > 0) {
            setUploadStatus(null);
            setClientError(`El registro se creó, pero fallaron ${uploadErrors} imágenes. Intenta editarlo.`);
            // Redirect anyway? Or stay? 
            // The record exists now. If we stay, we might create duplicates if they click submit again.
            // Best to redirect to success but maybe with a warning param.
        }
        
        // Use the same success redirection logic
        const params = new URLSearchParams({
            recordId: String(recordId),
            backHref,
            source,
            routeId: String(effectiveRouteId ?? ""),
            establishmentId: String(effectiveEstablishmentId ?? ""),
        });
        
        if (uploadErrors > 0) {
            params.append("warning", "partial_upload");
        }

        router.push(`/registros/exito?${params.toString()}`);

    } catch (err: unknown) {
        console.error(err);
        setUploadStatus(null);
        setServerError(err instanceof Error ? err.message : "Error inesperado.");
        submitLockRef.current = false;
        setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <form
        onSubmit={onFormSubmit}
        className="min-h-0 flex-1 overflow-y-auto pb-24 pt-1"
      >
        {recordId ? <input type="hidden" name="recordId" value={recordId} /> : null}
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="backHref" value={backHref} />
        <input type="hidden" name="routeId" value={effectiveRouteId ?? ""} />
        <input type="hidden" name="establishmentId" value={effectiveEstablishmentId ?? ""} />
        <input type="hidden" name="productId" value={effectiveProductId ?? ""} />
        <input type="hidden" name="evidenceGeoJson" value={JSON.stringify(newEvidenceGeos)} />
        <input type="hidden" name="removeEvidenceIdsJson" value="[]" />

        <div className="flex w-full flex-col gap-3">
          <MobileSelectField
            label="Ubicacion"
            value={String(effectiveEstablishmentId ?? "")}
            options={establishmentFieldOptions}
            onChange={(value) => {
              if (newEvidenceFiles.length > 0) {
                setClientError("Elimina las evidencias nuevas antes de cambiar la ubicacion.");
                return;
              }
              const establishmentId = toNullableNumber(value);
              const establishment = establishmentOptions.find(
                (item) => item.id === establishmentId,
              );
              setSelectedEstablishmentId(establishmentId);
              setSelectedRouteId(establishment?.routeId ?? null);
              setSelectedProductId(null);
            }}
            disabled={mode === "edit"}
            placeholder="Seleccionar ubicacion..."
            searchPlaceholder="Buscar ubicacion..."
            emptyMessage="No hay ubicaciones disponibles."
            required
          />

          <MobileSelectField
            label="Producto"
            value={String(effectiveProductId ?? "")}
            options={productFieldOptions}
            onChange={(value) => setSelectedProductId(toNullableNumber(value))}
            disabled={mode === "edit"}
            placeholder="Seleccionar producto..."
            searchPlaceholder="Buscar producto..."
            emptyMessage={
              effectiveEstablishmentId
                ? "No hay productos disponibles para esta ubicacion."
                : "Selecciona una ubicacion para ver productos."
            }
            required
          />

          <label className="flex w-full flex-col gap-[6px]">
            <span className="text-[14px] leading-none font-normal text-[#405C62]">
              Inventario Sistema
            </span>
            <input
              type="number"
              name="systemInventory"
              defaultValue={initialSystemInventory ?? undefined}
              className="h-11 w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[18px] text-[#0D3233] outline-none"
            />
          </label>

          <label className="flex w-full flex-col gap-[6px]">
            <span className="text-[14px] leading-none font-normal text-[#405C62]">
              Inventario Real
            </span>
            <input
              type="number"
              name="realInventory"
              defaultValue={initialRealInventory ?? undefined}
              className="h-11 w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[18px] text-[#0D3233] outline-none"
            />
          </label>

          <p className="m-0 text-[15px] leading-none font-normal text-[#405C62]">
            Evidencias
          </p>

          <div className="grid w-full grid-cols-3 gap-2">
            {Array.from({ length: TOTAL_EVIDENCE_SLOTS }, (_, index) => {
              const previewUrl = evidencePreviewUrls[index] ?? null;
              const isExistingEvidence = index < existingEvidenceUrls.length;
              const isNewEvidence = !isExistingEvidence && index < evidencePreviewUrls.length;
              const isAddSlot =
                index === evidencePreviewUrls.length &&
                evidencePreviewUrls.length < TOTAL_EVIDENCE_SLOTS;

              if (previewUrl) {
                const hasLoadFailed = failedEvidenceUrls.has(previewUrl);

                return (
                  <div
                    key={`slot-preview-${index}`}
                    className="relative h-[88px] w-full overflow-hidden rounded-[12px] border border-[#B3B5B3] bg-white"
                  >
                    {hasLoadFailed ? (
                      <div className="flex h-full w-full items-center justify-center px-2 text-center text-[12px] leading-tight text-[#405C62]">
                        No se pudo cargar
                      </div>
                    ) : (
                      <img
                        src={previewUrl}
                        alt={`Evidencia ${index + 1}`}
                        className="h-full w-full object-cover"
                        onError={() =>
                          setFailedEvidenceUrls((prev) => new Set(prev).add(previewUrl))
                        }
                      />
                    )}
                    {isNewEvidence && (
                      <button
                        type="button"
                        onClick={() => handleRemoveNewEvidence(index - existingEvidenceUrls.length)}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#A43E2A] text-white text-[16px] leading-none shadow-md hover:bg-[#8A3322] transition-colors"
                        aria-label="Eliminar evidencia"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              }

              if (isAddSlot && remainingCapacity > 0) {
                return (
                  <button
                    key={`slot-add-${index}`}
                    type="button"
                    onClick={handleOpenEvidencePicker}
                    className="flex h-[88px] w-full items-center justify-center rounded-[12px] border border-[#B3B5B3] bg-white text-[34px] leading-none text-[#8A9BA7]"
                    aria-label="Agregar evidencia"
                  >
                    +
                  </button>
                );
              }

              return (
                <div
                  key={`slot-empty-${index}`}
                  className="h-[88px] w-full rounded-[12px] border border-[#B3B5B3] bg-white"
                  aria-hidden="true"
                />
              );
            })}
          </div>

          <input
            ref={evidenceInputRef}
            type="file"
            name="evidenceFiles"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleEvidenceFilesChange}
            className="hidden"
          />

          <label className="flex w-full flex-col gap-[6px]">
            <span className="text-[14px] leading-none font-normal text-[#405C62]">
              Comentarios adicionales
            </span>
            <textarea
              name="comments"
              rows={4}
              defaultValue={initialComments ?? ""}
              placeholder="Notas..."
              className="h-24 w-full resize-none rounded-[12px] border border-[#B3B5B3] bg-white p-3 text-[18px] text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
            />
          </label>


          {clientError ? (
            <p className="m-0 text-[14px] leading-none font-normal text-[#A43E2A]">{clientError}</p>
          ) : null}
          {uploadStatus ? (
            <p className="m-0 text-[14px] leading-none font-normal text-[#405C62]">{uploadStatus}</p>
          ) : null}
          {!isSubmitting && selectionLockMessage ? (
            <p className="m-0 text-[14px] leading-none font-normal text-[#A43E2A]">
              {selectionLockMessage}
            </p>
          ) : null}
          {serverError ? (
            <p className="m-0 text-[14px] leading-none font-normal text-[#A43E2A]">{serverError}</p>
          ) : null}

          <div className="flex w-full flex-col gap-3 pt-1 pb-2">
            <Link
              href={backHref}
              className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[16px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isRegistroSubmitDisabled({
                pending: isSubmitting,
                hasClientError: !!clientError,
                hasLockedSelection,
                routeId: effectiveRouteId,
                establishmentId: effectiveEstablishmentId,
                productId: effectiveProductId,
                totalEvidenceCount,
              })}
              className="flex h-11 w-full items-center justify-center rounded-[12px] border-0 bg-[#0D3233] text-[16px] leading-none font-normal text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Guardando..." : submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
