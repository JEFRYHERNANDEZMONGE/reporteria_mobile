import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSqlContainsPattern, sanitizeListSearchQuery } from "@/lib/list-search.mjs";
import type { ZonaListItem, ZonaSource } from "./zona-types";

const ESTABLISHMENT_SCAN_BATCH = 60;

function formatRecordMeta(timeDate: string, status: string | null) {
  const date = new Date(timeDate);
  const dateLabel = Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

  if (status === "issue") return `Con incidencia | ${dateLabel}`;
  if (status === "not_applicable") return `No aplica | ${dateLabel}`;
  return `Completada | ${dateLabel}`;
}

type EstablishmentRow = {
  establishment_id: number;
  name: string;
};

type Params = {
  supabase: SupabaseClient;
  routeId: number;
  lapsoUserId: number;
  lapsoId: number | null;
  source: ZonaSource;
  offset: number;
  limit: number;
  query?: string;
};

async function buildSummariesForBatch({
  supabase,
  establishments,
  lapsoId,
  lapsoUserId,
  source,
}: {
  supabase: SupabaseClient;
  establishments: EstablishmentRow[];
  lapsoId: number | null;
  lapsoUserId: number;
  source: ZonaSource;
}) {
  const establishmentIds = establishments.map((item) => item.establishment_id);

  const totalProductsByEstablishment = new Map<number, number>();
  const completedProductsByEstablishment = new Map<number, number>();
  const latestRecordByEstablishment = new Map<
    number,
    { timeDate: string; status: string | null }
  >();

  if (establishmentIds.length > 0) {
    const { data: productRelations } = await supabase
      .from("products_establishment")
      .select("establishment_id, product_id")
      .in("establishment_id", establishmentIds);

    for (const relation of productRelations ?? []) {
      totalProductsByEstablishment.set(
        relation.establishment_id,
        (totalProductsByEstablishment.get(relation.establishment_id) ?? 0) + 1,
      );
    }
  }

  if (lapsoId && establishmentIds.length > 0) {
    const { data: records } = await supabase
      .from("check_record")
      .select("establishment_id, product_id, time_date, status")
      .eq("lapso_id", lapsoId)
      .eq("user_id", lapsoUserId)
      .in("establishment_id", establishmentIds)
      .order("time_date", { ascending: false });

    const distinctProductByEstablishment = new Set<string>();
    for (const record of records ?? []) {
      const productId = typeof record.product_id === "number" ? record.product_id : null;
      if (productId !== null) {
        const key = `${record.establishment_id}:${productId}`;
        if (!distinctProductByEstablishment.has(key)) {
          distinctProductByEstablishment.add(key);
          completedProductsByEstablishment.set(
            record.establishment_id,
            (completedProductsByEstablishment.get(record.establishment_id) ?? 0) + 1,
          );
        }
      }

      if (!latestRecordByEstablishment.has(record.establishment_id)) {
        latestRecordByEstablishment.set(record.establishment_id, {
          timeDate: record.time_date,
          status: record.status,
        });
      }
    }
  }

  const items: ZonaListItem[] = [];

  for (const establishment of establishments) {
    const totalProducts = totalProductsByEstablishment.get(establishment.establishment_id) ?? 0;
    const completedProducts =
      completedProductsByEstablishment.get(establishment.establishment_id) ?? 0;

    if (source === "pendientes") {
      if (!lapsoId) {
        items.push({
          id: establishment.establishment_id,
          name: establishment.name,
          meta: "Sin lapso activo",
        });
        continue;
      }

      const isPending = totalProducts === 0 || completedProducts < totalProducts;
      if (!isPending) {
        continue;
      }

      items.push({
        id: establishment.establishment_id,
        name: establishment.name,
        meta: "",
      });
      continue;
    }

    if (!lapsoId || totalProducts === 0 || completedProducts < totalProducts) {
      continue;
    }

    const latestRecord = latestRecordByEstablishment.get(establishment.establishment_id);

    items.push({
      id: establishment.establishment_id,
      name: establishment.name,
      meta: latestRecord
        ? formatRecordMeta(latestRecord.timeDate, latestRecord.status)
        : "Completada",
    });
  }

  return items;
}

export async function getZonaItemsPage({
  supabase,
  routeId,
  lapsoUserId,
  lapsoId,
  source,
  offset,
  limit,
  query,
}: Params): Promise<{ items: ZonaListItem[]; hasMore: boolean }> {
  const searchPattern = buildSqlContainsPattern(sanitizeListSearchQuery(query));
  const collected: ZonaListItem[] = [];
  let filteredOffset = 0;
  let scanOffset = 0;
  let reachedEnd = false;

  while (collected.length < limit + 1 && !reachedEnd) {
    const { data: establishments } = await supabase
      .from("establishment")
      .select("establishment_id, name")
      .eq("route_id", routeId)
      .eq("is_active", true)
      .ilike("name", searchPattern ?? "%")
      .order("name", { ascending: true })
      .range(scanOffset, scanOffset + ESTABLISHMENT_SCAN_BATCH - 1);

    const batch = (establishments ?? []) as EstablishmentRow[];
    if (batch.length === 0) {
      reachedEnd = true;
      break;
    }

    scanOffset += batch.length;

    const filteredBatch = await buildSummariesForBatch({
      supabase,
      establishments: batch,
      lapsoId,
      lapsoUserId,
      source,
    });

    for (const item of filteredBatch) {
      if (filteredOffset < offset) {
        filteredOffset += 1;
        continue;
      }

      collected.push(item);
      if (collected.length > limit) {
        break;
      }
    }
  }

  const hasMore = collected.length > limit;
  const items = hasMore ? collected.slice(0, limit) : collected;

  return { items, hasMore };
}
