"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getScrollableListClassName } from "@/app/_components/scrollable-list-state.mjs";
import SupermercadoDetalleModal from "./establecimientos/supermercado-detalle-modal";
import type { DetailSource, EstablishmentDetailData } from "./establecimientos/detail-types";

type ZonaListItem = {
  id: number;
  name: string;
  meta: string;
};

type ZonaListWithModalViewProps = {
  routeId: number;
  source: DetailSource;
  items: ZonaListItem[];
  details: EstablishmentDetailData[];
  emptyMessage: string;
  backHref: string;
};

export default function ZonaListWithModalView({
  routeId,
  source,
  items,
  details,
  emptyMessage,
  backHref,
}: ZonaListWithModalViewProps) {
  const [activeEstablishmentId, setActiveEstablishmentId] = useState<number | null>(null);

  const detailById = useMemo(
    () => new Map(details.map((detail) => [detail.establishmentId, detail])),
    [details],
  );

  const activeDetail = activeEstablishmentId !== null ? (detailById.get(activeEstablishmentId) ?? null) : null;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <section className={getScrollableListClassName({ topPadding: true })}>
        <div className="flex w-full flex-col gap-3">
          {items.length === 0 ? (
            <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-4 text-center text-[16px] text-[#405C62]">
              {emptyMessage}
            </div>
          ) : null}

          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveEstablishmentId(item.id)}
              className="flex h-[72px] w-full flex-col justify-center gap-1 rounded-[12px] bg-[#5A7A84] px-3 text-left"
            >
              <p className="m-0 text-[16px] leading-none font-normal text-white">{item.name}</p>
              <p className="m-0 text-[14px] leading-none font-normal text-[#E9EDE9]">{item.meta}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 w-full bg-[#E9EDE9] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
        <Link
          href={backHref}
          className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[16px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
        >
          Volver
        </Link>
      </div>

      {activeDetail ? (
        <SupermercadoDetalleModal
          establishmentName={activeDetail.establishmentName}
          establishmentDirection={activeDetail.establishmentDirection}
          source={source}
          hasActiveLapso={activeDetail.hasActiveLapso}
          mapsHref={activeDetail.mapsHref}
          items={activeDetail.items}
          actionHref={`/mis-rutas/${routeId}/establecimientos/${activeDetail.establishmentId}?from=${source}`}
          onClose={() => setActiveEstablishmentId(null)}
        />
      ) : null}
    </div>
  );
}


