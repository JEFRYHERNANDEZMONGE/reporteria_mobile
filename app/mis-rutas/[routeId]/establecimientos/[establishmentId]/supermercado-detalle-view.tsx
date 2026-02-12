"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type DetailSource = "pendientes" | "completadas";

export type ProductRecordItem = {
  productId: number;
  productName: string;
  productSku: string;
  existingRecordId: number | null;
  lastUpdateLabel: string | null;
  systemInventory: number | null;
  realInventory: number | null;
  evidenceNum: number | null;
  comments: string | null;
};

type ProductPageResponse = {
  items: ProductRecordItem[];
  hasMore: boolean;
};

type SupermercadoDetalleViewProps = {
  routeId: number;
  establishmentId: number;
  establishmentName: string;
  source: DetailSource;
  hasActiveLapso: boolean;
  initialItems: ProductRecordItem[];
  initialHasMore: boolean;
  pageSize: number;
  backHref: string;
};

type ProductRecordCardProps = {
  routeId: number;
  establishmentId: number;
  source: DetailSource;
  hasActiveLapso: boolean;
  item: ProductRecordItem;
};

function ProductRecordCard({
  routeId,
  establishmentId,
  source,
  hasActiveLapso,
  item,
}: ProductRecordCardProps) {
  const actionLabel = source === "completadas" ? "Editar registro" : "Crear registro";
  const actionHref =
    source === "completadas" && item.existingRecordId
      ? `/registros/${item.existingRecordId}/editar?source=completadas`
      : `/registros/nuevo?source=pendientes&routeId=${routeId}&establishmentId=${establishmentId}&productId=${item.productId}`;
  const metadataText = item.lastUpdateLabel
    ? `Ultimo registro: ${item.lastUpdateLabel}`
    : "Sin registro previo.";

  return (
    <article className="rounded-[12px] border border-[#B3B5B3] bg-white p-3">
      <p className="m-0 text-[14px] leading-none font-normal text-[#0D3233]">{item.productName}</p>
      <p className="mt-1 text-[12px] leading-none font-normal text-[#5A7984]">SKU: {item.productSku}</p>
      <p className="mt-1 text-[12px] leading-none font-normal text-[#405C62]">{metadataText}</p>

      {source === "completadas" ? (
        <p className="mt-1 text-[12px] leading-none font-normal text-[#5A7984]">
          Inventario sistema: {item.systemInventory ?? "-"} | Inventario real:{" "}
          {item.realInventory ?? "-"}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        <Link
          href={actionHref}
          className={`flex h-10 items-center justify-center rounded-[10px] text-[13px] leading-none font-normal ${
            hasActiveLapso
              ? "bg-[#0D3233] text-white"
              : "pointer-events-none bg-[#8A9BA7] text-white"
          }`}
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}

export default function SupermercadoDetalleView({
  routeId,
  establishmentId,
  establishmentName,
  source,
  hasActiveLapso,
  initialItems,
  initialHasMore,
  pageSize,
  backHref,
}: SupermercadoDetalleViewProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const emptyMessage = !hasActiveLapso
    ? "No hay lapso activo para esta ruta."
    : source === "completadas"
      ? "No hay productos con registros previos para editar."
      : "No hay productos para este establecimiento.";

  useEffect(() => {
    setItems(initialItems);
    setHasMore(initialHasMore);
    setLoadError(null);
  }, [initialHasMore, initialItems]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({
        source,
        offset: String(items.length),
        limit: String(pageSize),
      });

      const response = await fetch(
        `/api/mis-rutas/${routeId}/establecimientos/${establishmentId}/productos?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("No se pudieron cargar mas productos.");
      }

      const payload = (await response.json()) as ProductPageResponse;
      setItems((current) => {
        const seen = new Set(current.map((item) => item.productId));
        const next = payload.items.filter((item) => !seen.has(item.productId));
        return current.concat(next);
      });
      setHasMore(payload.hasMore);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Error cargando productos.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [establishmentId, hasMore, isLoadingMore, items.length, pageSize, routeId, source]);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "180px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <section className="min-h-0 flex-1 overflow-y-auto pb-20 pt-1">
        <div className="rounded-[12px] border border-[#B3B5B3] bg-[#E9EDE9] p-3">
          <p className="m-0 text-[12px] leading-none font-normal text-[#5A7984]">Supermercado</p>
          <p className="mt-1 text-[16px] leading-none font-normal text-[#0D3233]">{establishmentName}</p>
        </div>

        <div className="mt-3 flex w-full flex-col gap-3">
          {items.length === 0 ? (
            <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-4 text-center text-[14px] text-[#405C62]">
              {emptyMessage}
            </div>
          ) : null}

          {items.map((item) => (
            <ProductRecordCard
              key={item.productId}
              routeId={routeId}
              establishmentId={establishmentId}
              source={source}
              hasActiveLapso={hasActiveLapso}
              item={item}
            />
          ))}

          <div ref={sentinelRef} className="h-6 w-full" aria-hidden="true" />

          {isLoadingMore ? (
            <p className="m-0 pb-2 text-center text-[12px] text-[#405C62]">Cargando productos...</p>
          ) : null}

          {loadError ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="h-10 w-full rounded-[10px] border border-[#B3B5B3] bg-white text-[13px] text-[#0D3233]"
            >
              {loadError} Reintentar
            </button>
          ) : null}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 w-full bg-[#E9EDE9] px-4 pb-4 pt-2">
        <Link
          href={backHref}
          className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[14px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
        >
          Volver
        </Link>
      </div>
    </div>
  );
}

