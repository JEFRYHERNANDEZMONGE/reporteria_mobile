"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createRegistroAction, updateRegistroAction } from "./actions";
import type {
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
  initialRouteId: number | null;
  initialEstablishmentId: number | null;
  initialProductId: number | null;
  initialSystemInventory: number | null;
  initialRealInventory: number | null;
  initialComments: string | null;
  existingEvidences: EvidenceItem[];
  recordId: number | null;
  submitLabel: string;
};

const INITIAL_ACTION_STATE: RegistroActionState = {
  error: null,
  success: false,
  recordId: null,
};

const TOTAL_EVIDENCE_SLOTS = 6;

function toNullableNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getCurrentGeoForEvidence(count: number): Promise<EvidenceGeoInfo[] | null> {
  if (count === 0) return [];
  if (!("geolocation" in navigator)) return null;

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
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

    return Array.from({ length: count }, () => ({ ...entry }));
  } catch {
    return null;
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
  initialRouteId,
  initialEstablishmentId,
  initialProductId,
  initialSystemInventory,
  initialRealInventory,
  initialComments,
  existingEvidences,
  recordId,
  submitLabel,
}: RegistroFormProps) {
  const router = useRouter();
  const action = mode === "create" ? createRegistroAction : updateRegistroAction;
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(initialRouteId);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<number | null>(
    initialEstablishmentId,
  );
  const [selectedProductId, setSelectedProductId] = useState<number | null>(initialProductId);
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [evidenceGeoJson, setEvidenceGeoJson] = useState("[]");
  const [newEvidencePreviewUrls, setNewEvidencePreviewUrls] = useState<string[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);

  const routeById = useMemo(
    () => new Map(routeOptions.map((route) => [route.id, route.name])),
    [routeOptions],
  );

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

  const effectiveProductId =
    selectedProductId !== null &&
    filteredProducts.some((option) => option.id === selectedProductId)
      ? selectedProductId
      : null;

  const existingEvidenceUrls = useMemo(
    () => existingEvidences.map((evidence) => evidence.imageUrl),
    [existingEvidences],
  );

  const evidencePreviewUrls = useMemo(
    () => [...existingEvidenceUrls, ...newEvidencePreviewUrls].slice(0, TOTAL_EVIDENCE_SLOTS),
    [existingEvidenceUrls, newEvidencePreviewUrls],
  );

  const remainingCapacity = TOTAL_EVIDENCE_SLOTS - existingEvidenceUrls.length;
  const remainingEvidenceCount = existingEvidenceUrls.length + selectedFileCount;

  useEffect(() => {
    return () => {
      newEvidencePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newEvidencePreviewUrls]);

  useEffect(() => {
    if (!state.success || !state.recordId) return;
    const params = new URLSearchParams({
      recordId: String(state.recordId),
      backHref,
      source,
    });
    router.push(`/registros/exito?${params.toString()}`);
  }, [backHref, router, source, state.recordId, state.success]);

  async function handleEvidenceFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(event.currentTarget.files ?? []);
    setClientError(null);

    if (fileList.length === 0) {
      setEvidenceGeoJson("[]");
      setSelectedFileCount(0);
      setNewEvidencePreviewUrls([]);
      return;
    }

    if (fileList.length > remainingCapacity) {
      event.currentTarget.value = "";
      setEvidenceGeoJson("[]");
      setSelectedFileCount(0);
      setNewEvidencePreviewUrls([]);
      setClientError(`Solo puedes agregar ${remainingCapacity} evidencias nuevas.`);
      return;
    }

    const geoList = await getCurrentGeoForEvidence(fileList.length);
    if (!geoList) {
      event.currentTarget.value = "";
      setEvidenceGeoJson("[]");
      setSelectedFileCount(0);
      setNewEvidencePreviewUrls([]);
      setClientError("Debes permitir geolocalizacion para adjuntar evidencias.");
      return;
    }

    setSelectedFileCount(fileList.length);
    setEvidenceGeoJson(JSON.stringify(geoList));
    setNewEvidencePreviewUrls(fileList.map((file) => URL.createObjectURL(file)));
  }

  function handleOpenEvidencePicker() {
    if (pending) return;
    if (remainingCapacity <= 0) {
      setClientError("Ya alcanzaste el maximo de 6 evidencias.");
      return;
    }
    evidenceInputRef.current?.click();
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <form action={formAction} className="min-h-0 flex-1 overflow-y-auto pb-4 pt-1">
        {recordId ? <input type="hidden" name="recordId" value={recordId} /> : null}
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="routeId" value={effectiveRouteId ?? ""} />
        <input type="hidden" name="establishmentId" value={effectiveEstablishmentId ?? ""} />
        <input type="hidden" name="productId" value={effectiveProductId ?? ""} />
        <input type="hidden" name="evidenceGeoJson" value={evidenceGeoJson} />
        <input type="hidden" name="removeEvidenceIdsJson" value="[]" />

        <div className="flex w-full flex-col gap-3">
          <label className="flex w-full flex-col gap-[6px]">
            <span className="text-[12px] leading-none font-normal text-[#405C62]">Ubicacion</span>
            <select
              className="h-11 w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[14px] text-[#0D3233] outline-none"
              value={effectiveEstablishmentId ?? ""}
              onChange={(event) => {
                const establishmentId = toNullableNumber(event.target.value);
                const establishment = establishmentOptions.find(
                  (item) => item.id === establishmentId,
                );
                setSelectedEstablishmentId(establishmentId);
                setSelectedRouteId(establishment?.routeId ?? null);
                setSelectedProductId(null);
              }}
              disabled={mode === "edit"}
            >
              <option value="">Seleccionar...</option>
              {establishmentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {buildEstablishmentLabel(option, routeById)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex w-full flex-col gap-[6px]">
            <span className="text-[12px] leading-none font-normal text-[#405C62]">Producto</span>
            <select
              className="h-11 w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[14px] text-[#0D3233] outline-none"
              value={effectiveProductId ?? ""}
              onChange={(event) => setSelectedProductId(toNullableNumber(event.target.value))}
              disabled={mode === "edit"}
            >
              <option value="">Seleccionar...</option>
              {filteredProducts.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.sku})
                </option>
              ))}
            </select>
          </label>

          <label className="flex w-full flex-col gap-[6px]">
            <span className="text-[12px] leading-none font-normal text-[#405C62]">
              Inventario Sistema
            </span>
            <input
              type="number"
              name="systemInventory"
              min={0}
              defaultValue={initialSystemInventory ?? undefined}
              className="h-11 w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[14px] text-[#0D3233] outline-none"
            />
          </label>

          <label className="flex w-full flex-col gap-[6px]">
            <span className="text-[12px] leading-none font-normal text-[#405C62]">
              Inventario Real
            </span>
            <input
              type="number"
              name="realInventory"
              min={0}
              defaultValue={initialRealInventory ?? undefined}
              className="h-11 w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[14px] text-[#0D3233] outline-none"
            />
          </label>

          <p className="m-0 text-[13px] leading-none font-normal text-[#405C62]">
            Evidencias
          </p>

          <div className="grid w-full grid-cols-3 gap-2">
            {Array.from({ length: TOTAL_EVIDENCE_SLOTS }, (_, index) => {
              const previewUrl = evidencePreviewUrls[index] ?? null;
              const isAddSlot =
                index === evidencePreviewUrls.length &&
                evidencePreviewUrls.length < TOTAL_EVIDENCE_SLOTS;

              if (previewUrl) {
                return (
                  <div
                    key={`slot-preview-${index}`}
                    className="relative h-[88px] w-full overflow-hidden rounded-[12px] border border-[#B3B5B3] bg-white"
                  >
                    <Image
                      src={previewUrl}
                      alt={`Evidencia ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 30vw, 120px"
                      className="object-cover"
                    />
                  </div>
                );
              }

              if (isAddSlot && remainingCapacity > 0) {
                return (
                  <button
                    key={`slot-add-${index}`}
                    type="button"
                    onClick={handleOpenEvidencePicker}
                    className="flex h-[88px] w-full items-center justify-center rounded-[12px] border border-[#B3B5B3] bg-white text-[32px] leading-none text-[#8A9BA7]"
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
            required={mode === "create" && existingEvidenceUrls.length === 0}
            onChange={handleEvidenceFilesChange}
            className="hidden"
          />

          <label className="flex w-full flex-col gap-[6px]">
            <span className="text-[12px] leading-none font-normal text-[#405C62]">
              Comentarios adicionales
            </span>
            <textarea
              name="comments"
              rows={4}
              defaultValue={initialComments ?? ""}
              placeholder="Notas..."
              className="h-24 w-full resize-none rounded-[12px] border border-[#B3B5B3] bg-white p-3 text-[14px] text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
            />
          </label>


          {clientError ? (
            <p className="m-0 text-[12px] leading-none font-normal text-[#A43E2A]">{clientError}</p>
          ) : null}
          {state.error ? (
            <p className="m-0 text-[12px] leading-none font-normal text-[#A43E2A]">{state.error}</p>
          ) : null}

          <div className="flex w-full flex-col gap-3 pt-1 pb-2">
            <Link
              href={backHref}
              className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[14px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={
                pending ||
                !!clientError ||
                effectiveRouteId === null ||
                effectiveEstablishmentId === null ||
                effectiveProductId === null
              }
              className="flex h-11 w-full items-center justify-center rounded-[12px] border-0 bg-[#0D3233] text-[14px] leading-none font-normal text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Guardando..." : submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
