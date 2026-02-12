"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
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
  const [removeEvidenceIds, setRemoveEvidenceIds] = useState<number[]>([]);
  const [evidenceGeoJson, setEvidenceGeoJson] = useState("[]");
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);

  const effectiveRouteId = selectedRouteId;
  const filteredEstablishments = useMemo(
    () =>
      establishmentOptions.filter(
        (establishment) => establishment.routeId === effectiveRouteId,
      ),
    [effectiveRouteId, establishmentOptions],
  );
  const effectiveEstablishmentId =
    selectedEstablishmentId !== null &&
    filteredEstablishments.some((option) => option.id === selectedEstablishmentId)
      ? selectedEstablishmentId
      : null;

  const availableProductIds = useMemo(() => {
    if (!effectiveEstablishmentId) return new Set<number>();
    return new Set(
      productRelations
        .filter((relation) => relation.establishmentId === effectiveEstablishmentId)
        .map((relation) => relation.productId),
    );
  }, [effectiveEstablishmentId, productRelations]);

  const filteredProducts = useMemo(
    () =>
      productOptions.filter((product) => availableProductIds.has(product.id)),
    [availableProductIds, productOptions],
  );
  const effectiveProductId =
    selectedProductId !== null &&
    filteredProducts.some((option) => option.id === selectedProductId)
      ? selectedProductId
      : null;

  const remainingEvidenceCount =
    existingEvidences.length -
    removeEvidenceIds.length +
    selectedFileCount;

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
      return;
    }

    if (fileList.length > 6) {
      event.currentTarget.value = "";
      setEvidenceGeoJson("[]");
      setSelectedFileCount(0);
      setClientError("Solo puedes adjuntar hasta 6 evidencias.");
      return;
    }

    const geoList = await getCurrentGeoForEvidence(fileList.length);
    if (!geoList) {
      event.currentTarget.value = "";
      setEvidenceGeoJson("[]");
      setSelectedFileCount(0);
      setClientError("Debes permitir geolocalizacion para adjuntar evidencias.");
      return;
    }

    setSelectedFileCount(fileList.length);
    setEvidenceGeoJson(JSON.stringify(geoList));
  }

  function toggleRemoveEvidence(evidenceId: number) {
    setRemoveEvidenceIds((current) =>
      current.includes(evidenceId)
        ? current.filter((value) => value !== evidenceId)
        : [...current, evidenceId],
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <form action={formAction} className="min-h-0 flex-1 overflow-y-auto pb-20 pt-1">
        {recordId ? <input type="hidden" name="recordId" value={recordId} /> : null}
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="routeId" value={effectiveRouteId ?? ""} />
        <input
          type="hidden"
          name="establishmentId"
          value={effectiveEstablishmentId ?? ""}
        />
        <input type="hidden" name="productId" value={effectiveProductId ?? ""} />
        <input type="hidden" name="evidenceGeoJson" value={evidenceGeoJson} />
        <input
          type="hidden"
          name="removeEvidenceIdsJson"
          value={JSON.stringify(removeEvidenceIds)}
        />

        <div className="flex w-full flex-col gap-3">
          <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-3">
            <p className="m-0 text-[12px] leading-none font-normal text-[#405C62]">Ruta</p>
            <select
              className="mt-2 h-11 w-full rounded-[10px] border border-[#B3B5B3] bg-white px-3 text-[14px] text-[#0D3233] outline-none"
              value={effectiveRouteId ?? ""}
              onChange={(event) => {
                setSelectedRouteId(toNullableNumber(event.target.value));
                setSelectedEstablishmentId(null);
                setSelectedProductId(null);
              }}
              disabled={mode === "edit"}
            >
              <option value="">Seleccionar ruta</option>
              {routeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-3">
            <p className="m-0 text-[12px] leading-none font-normal text-[#405C62]">
              Establecimiento
            </p>
            <select
              className="mt-2 h-11 w-full rounded-[10px] border border-[#B3B5B3] bg-white px-3 text-[14px] text-[#0D3233] outline-none"
              value={effectiveEstablishmentId ?? ""}
              onChange={(event) => {
                setSelectedEstablishmentId(toNullableNumber(event.target.value));
                setSelectedProductId(null);
              }}
              disabled={mode === "edit"}
            >
              <option value="">Seleccionar establecimiento</option>
              {filteredEstablishments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-3">
            <p className="m-0 text-[12px] leading-none font-normal text-[#405C62]">Producto</p>
            <select
              className="mt-2 h-11 w-full rounded-[10px] border border-[#B3B5B3] bg-white px-3 text-[14px] text-[#0D3233] outline-none"
              value={effectiveProductId ?? ""}
              onChange={(event) => setSelectedProductId(toNullableNumber(event.target.value))}
              disabled={mode === "edit"}
            >
              <option value="">Seleccionar producto</option>
              {filteredProducts.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.sku})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex w-full flex-col gap-[6px] rounded-[12px] border border-[#B3B5B3] bg-white p-3">
              <span className="text-[12px] leading-none text-[#405C62]">Inventario sistema</span>
              <input
                type="number"
                name="systemInventory"
                min={0}
                defaultValue={initialSystemInventory ?? undefined}
                className="h-10 rounded-[10px] border border-[#B3B5B3] px-2 text-[14px] text-[#0D3233] outline-none"
              />
            </label>

            <label className="flex w-full flex-col gap-[6px] rounded-[12px] border border-[#B3B5B3] bg-white p-3">
              <span className="text-[12px] leading-none text-[#405C62]">Inventario real</span>
              <input
                type="number"
                name="realInventory"
                min={0}
                defaultValue={initialRealInventory ?? undefined}
                className="h-10 rounded-[10px] border border-[#B3B5B3] px-2 text-[14px] text-[#0D3233] outline-none"
              />
            </label>
          </div>

          <label className="flex w-full flex-col gap-[6px] rounded-[12px] border border-[#B3B5B3] bg-white p-3">
            <span className="text-[12px] leading-none text-[#405C62]">Comentarios adicionales</span>
            <textarea
              name="comments"
              rows={3}
              defaultValue={initialComments ?? ""}
              placeholder="Notas..."
              className="w-full resize-none rounded-[10px] border border-[#B3B5B3] p-2 text-[14px] text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
            />
          </label>

          {existingEvidences.length > 0 ? (
            <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-3">
              <p className="m-0 text-[12px] leading-none font-normal text-[#405C62]">
                Evidencias actuales
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {existingEvidences.map((evidence) => {
                  const marked = removeEvidenceIds.includes(evidence.evidenceId);
                  return (
                    <article
                      key={evidence.evidenceId}
                      className={`rounded-[10px] border p-2 ${
                        marked ? "border-[#D4A64A] bg-[#F5EED6]" : "border-[#B3B5B3] bg-[#E9EDE9]"
                      }`}
                    >
                      <div className="relative h-[84px] w-full overflow-hidden rounded-[8px] bg-white">
                        <Image
                          src={evidence.imageUrl}
                          alt={`Evidencia ${evidence.evidenceId}`}
                          fill
                          sizes="(max-width: 390px) 44vw, 120px"
                          className="object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRemoveEvidence(evidence.evidenceId)}
                        className="mt-2 h-8 w-full rounded-[8px] border border-[#8A9BA7] bg-white text-[12px] text-[#0D3233]"
                      >
                        {marked ? "Conservar" : "Quitar"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          <label className="flex w-full flex-col gap-[6px] rounded-[12px] border border-[#B3B5B3] bg-white p-3">
            <span className="text-[12px] leading-none text-[#405C62]">
              Evidencias (min 1, max 6)
            </span>
            <input
              type="file"
              name="evidenceFiles"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleEvidenceFilesChange}
              required={mode === "create" && existingEvidences.length === 0}
              className="block w-full text-[12px] text-[#405C62] file:mr-3 file:rounded-[8px] file:border file:border-[#8A9BA7] file:bg-white file:px-3 file:py-2 file:text-[12px] file:text-[#0D3233]"
            />
            <p className="m-0 text-[12px] leading-none text-[#5A7984]">
              Cada evidencia nueva requiere geolocalizacion.
            </p>
          </label>

          <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-3 text-[12px] text-[#405C62]">
            Evidencias resultantes: {remainingEvidenceCount}
          </div>

          {clientError ? (
            <p className="m-0 text-[12px] leading-none text-[#A43E2A]">{clientError}</p>
          ) : null}
          {state.error ? (
            <p className="m-0 text-[12px] leading-none text-[#A43E2A]">{state.error}</p>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10 w-full bg-[#E9EDE9] px-4 pb-4 pt-2">
          <div className="flex w-full flex-col gap-2">
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
            <Link
              href={backHref}
              className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[14px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
            >
              Volver
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

