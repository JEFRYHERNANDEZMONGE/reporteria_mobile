"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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

type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  label: string;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

function Combobox({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Seleccionar...",
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label ?? "";

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm("");
  }

  return (
    <label className="flex w-full flex-col gap-[6px]">
      <span className="text-[12px] leading-none font-normal text-[#405C62]">{label}</span>
      <div ref={containerRef} className="relative w-full">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : displayValue}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (!disabled) {
                setIsOpen(true);
                setSearchTerm("");
              }
            }}
            onClick={() => {
              if (!disabled) {
                setIsOpen(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="h-11 w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 pr-10 text-[14px] text-[#0D3233] outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <ChevronDown
            size={20}
            className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5A7984] transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>

        {isOpen && !disabled && filteredOptions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-[12px] border border-[#B3B5B3] bg-white shadow-lg">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(option.value);
                }}
                className={`w-full px-3 py-2.5 text-left text-[14px] hover:bg-[#E9EDE9] ${
                  option.value === value ? "bg-[#DDE2DD]" : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {isOpen && !disabled && filteredOptions.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-[12px] border border-[#B3B5B3] bg-white shadow-lg px-3 py-2.5">
            <p className="m-0 text-[14px] text-[#8A9BA7]">No se encontraron resultados</p>
          </div>
        )}
      </div>
    </label>
  );
}

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
  const [newEvidenceFiles, setNewEvidenceFiles] = useState<File[]>([]);
  const [newEvidenceGeos, setNewEvidenceGeos] = useState<EvidenceGeoInfo[]>([]);
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

  const establishmentComboboxOptions = useMemo(
    () => [
      { value: "", label: "Seleccionar..." },
      ...establishmentOptions.map((option) => ({
        value: String(option.id),
        label: buildEstablishmentLabel(option, routeById),
      })),
    ],
    [establishmentOptions, routeById],
  );

  const productComboboxOptions = useMemo(
    () => [
      { value: "", label: "Seleccionar..." },
      ...filteredProducts.map((option) => ({
        value: String(option.id),
        label: `${option.name} (${option.sku})`,
      })),
    ],
    [filteredProducts],
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

  const remainingCapacity = TOTAL_EVIDENCE_SLOTS - existingEvidenceUrls.length - newEvidenceFiles.length;
  const totalEvidenceCount = existingEvidenceUrls.length + newEvidenceFiles.length;

  useEffect(() => {
    return () => {
      newEvidencePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newEvidencePreviewUrls]);

  useEffect(() => {
    // Sincronizar los archivos con el input antes del submit
    if (evidenceInputRef.current && newEvidenceFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      newEvidenceFiles.forEach((file) => dataTransfer.items.add(file));
      evidenceInputRef.current.files = dataTransfer.files;
    }
  }, [newEvidenceFiles]);

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
      event.currentTarget.value = "";
      return;
    }

    if (fileList.length > remainingCapacity) {
      event.currentTarget.value = "";
      setClientError(`Solo puedes agregar ${remainingCapacity} evidencias nuevas.`);
      return;
    }

    const geoList = await getCurrentGeoForEvidence(fileList.length);
    if (!geoList) {
      event.currentTarget.value = "";
      setClientError("Debes permitir geolocalizacion para adjuntar evidencias.");
      return;
    }

    // Agregar a las evidencias existentes
    setNewEvidenceFiles((prev) => [...prev, ...fileList]);
    setNewEvidenceGeos((prev) => [...prev, ...geoList]);
    setNewEvidencePreviewUrls((prev) => [
      ...prev,
      ...fileList.map((file) => URL.createObjectURL(file)),
    ]);

    // Limpiar el input para permitir seleccionar los mismos archivos de nuevo
    event.currentTarget.value = "";
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
        <input type="hidden" name="evidenceGeoJson" value={JSON.stringify(newEvidenceGeos)} />
        <input type="hidden" name="removeEvidenceIdsJson" value="[]" />

        <div className="flex w-full flex-col gap-3">
          <Combobox
            label="Ubicacion"
            value={String(effectiveEstablishmentId ?? "")}
            options={establishmentComboboxOptions}
            onChange={(value) => {
              const establishmentId = toNullableNumber(value);
              const establishment = establishmentOptions.find(
                (item) => item.id === establishmentId,
              );
              setSelectedEstablishmentId(establishmentId);
              setSelectedRouteId(establishment?.routeId ?? null);
              setSelectedProductId(null);
            }}
            disabled={mode === "edit"}
            placeholder="Buscar o seleccionar ubicación..."
          />

          <Combobox
            label="Producto"
            value={String(effectiveProductId ?? "")}
            options={productComboboxOptions}
            onChange={(value) => setSelectedProductId(toNullableNumber(value))}
            disabled={mode === "edit"}
            placeholder="Buscar o seleccionar producto..."
          />

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
              const isExistingEvidence = index < existingEvidenceUrls.length;
              const isNewEvidence = !isExistingEvidence && index < evidencePreviewUrls.length;
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
                    {isNewEvidence && (
                      <button
                        type="button"
                        onClick={() => handleRemoveNewEvidence(index - existingEvidenceUrls.length)}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#A43E2A] text-white text-[14px] leading-none shadow-md hover:bg-[#8A3322] transition-colors"
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
            required={mode === "create" && totalEvidenceCount === 0}
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
