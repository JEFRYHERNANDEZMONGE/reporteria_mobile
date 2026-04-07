import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSqlContainsPattern, sanitizeListSearchQuery } from "@/lib/list-search.mjs";
import {
  buildEstablishmentProgressById,
  getEstablishmentRouteStatus,
} from "@/app/mis-rutas/zona-summary-state.mjs";
import type { ZonaListItem, ZonaSource } from "./zona-types";

const ESTABLISHMENT_SCAN_BATCH = 60;

function formatRecordMeta(timeDate: string) {
  const date = new Date(timeDate);
  const dateLabel = Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Costa_Rica",
      });

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

  const latestRecordByEstablishment = new Map<
    number,
    { timeDate: string }
  >();
  let progressById = new Map<number, { totalProducts: number; completedProducts: number }>();

  if (establishmentIds.length > 0) {
    const { data: productRelations } = await supabase
      .from("products_establishment")
      .select("establishment_id, product_id")
      .in("establishment_id", establishmentIds);

    const relatedProductIds = [...new Set((productRelations ?? []).map((item) => item.product_id))];
    const { data: activeProducts } = relatedProductIds.length === 0
      ? { data: [] as { product_id: number }[] }
      : await supabase
          .from("product")
          .select("product_id")
          .in("product_id", relatedProductIds)
          .eq("is_active", true);

    const { data: records } = lapsoId
      ? await supabase
          .from("check_record")
          .select("establishment_id, product_id, time_date")
          .eq("lapso_id", lapsoId)
          .eq("user_id", lapsoUserId)
          .in("establishment_id", establishmentIds)
          .order("time_date", { ascending: false })
      : { data: [] as {
          establishment_id: number;
          product_id: number;
          time_date: string;
        }[] };

    progressById = buildEstablishmentProgressById({
      establishmentIds,
      productRelations: productRelations ?? [],
      activeProductIds: (activeProducts ?? []).map((item) => item.product_id),
      records: (records ?? []).map((record) => ({
        establishment_id: record.establishment_id,
        product_id: record.product_id,
      })),
    });

    for (const record of records ?? []) {
      if (!latestRecordByEstablishment.has(record.establishment_id)) {
        latestRecordByEstablishment.set(record.establishment_id, {
          timeDate: record.time_date,
        });
      }
    }
  }

  const items: ZonaListItem[] = [];

  for (const establishment of establishments) {
    const progress = progressById.get(establishment.establishment_id);
    const totalProducts = progress?.totalProducts ?? 0;
    const completedProducts = progress?.completedProducts ?? 0;
    const establishmentStatus = getEstablishmentRouteStatus({
      totalProducts,
      completedProducts,
      hasRecordedProducts: latestRecordByEstablishment.has(establishment.establishment_id),
    });

    if (source === "pendientes") {
      if (!lapsoId) {
        items.push({
          id: establishment.establishment_id,
          name: establishment.name,
          meta: "Sin lapso activo",
        });
        continue;
      }

      if (establishmentStatus === "completed") {
        continue;
      }

      items.push({
        id: establishment.establishment_id,
        name: establishment.name,
        meta: "",
      });
      continue;
    }

    if (!lapsoId || establishmentStatus !== "completed") {
      continue;
    }

    const latestRecord = latestRecordByEstablishment.get(establishment.establishment_id);

    items.push({
      id: establishment.establishment_id,
      name: establishment.name,
      meta: latestRecord
        ? formatRecordMeta(latestRecord.timeDate)
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
