"use client";

import Link from "next/link";
import type { DetailSource, ProductRecordItem } from "./detail-types";

type SupermercadoDetalleModalProps = {
  establishmentName: string;
  establishmentDirection: string | null;
  source: DetailSource;
  hasActiveLapso: boolean;
  items: ProductRecordItem[];
  mapsHref?: string | null;
  actionHref: string;
  onClose: () => void;
};

function getActionLabel(source: DetailSource) {
  return source === "completadas" ? "Editar registro" : "Crear registro";
}

export default function SupermercadoDetalleModal({
  establishmentName,
  establishmentDirection,
  source,
  hasActiveLapso,
  items,
  mapsHref,
  actionHref,
  onClose,
}: SupermercadoDetalleModalProps) {
  const emptyMessage = !hasActiveLapso
    ? "No hay lapso activo para esta ruta."
    : source === "completadas"
      ? "No hay productos con registros previos para editar."
      : "No hay productos pendientes para registrar.";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-transparent p-4">
      <div className="w-full rounded-[12px] border border-[#B3B5B3] bg-[#E9EDE9] p-4">
        <div className="rounded-[12px] bg-[#DDE2DD] px-3 py-3">
          <p className="m-0 text-[20px] leading-none font-normal text-[#0D3233]">{establishmentName}</p>
        </div>

        <p className="mt-3 text-[13px] leading-none font-normal text-[#5A7984]">
          Ubicación: {establishmentDirection?.trim() || "Sin dirección registrada"}
        </p>

        <div className="mt-3 max-h-[36svh] overflow-y-auto pr-1">
          <div className="flex flex-col gap-3">
            {items.length === 0 ? (
              <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-4 text-center text-[14px] text-[#405C62]">
                {emptyMessage}
              </div>
            ) : null}

            {items.map((item) => (
              <article
                key={item.productId}
                className="flex h-[72px] w-full flex-col justify-center gap-1 rounded-[12px] bg-[#5A7A84] px-3"
              >
                <p className="m-0 text-[14px] leading-none font-normal text-white">{item.productName}</p>
                <p className="m-0 text-[12px] leading-none font-normal text-[#E9EDE9]">SKU {item.productSku}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Link
            href={actionHref}
            className={`flex h-11 w-full items-center justify-center rounded-[12px] text-[14px] leading-none font-normal ${
              hasActiveLapso
                ? "bg-[#0D3233] text-white"
                : "pointer-events-none bg-[#8A9BA7] text-white"
            }`}
          >
            {getActionLabel(source)}
          </Link>

          {mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 w-full items-center justify-center rounded-[12px] bg-[#7DD3E5] text-[14px] leading-none font-normal text-[#0D3233]"
            >
              ¿Cómo llegar?
            </a>
          ) : (
            <div className="flex h-11 w-full items-center justify-center rounded-[12px] bg-[#B3B5B3] text-[14px] leading-none font-normal text-[#405C62]">
              ¿Cómo llegar?
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-[12px] border border-[#8A9BA7] bg-white text-[14px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
