import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSqlContainsPattern, sanitizeListSearchQuery } from "@/lib/list-search.mjs";
import type { DetailSource, ProductRecordItem } from "./detail-types";

const PRODUCT_SCAN_BATCH = 60;

function formatLastUpdateLabel(timeDate: string) {
  const parsed = new Date(timeDate);
  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return parsed.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type CheckRecordRow = {
  record_id: number;
  product_id: number;
  time_date: string;
  system_inventory: number | null;
  real_inventory: number | null;
  evidence_num: number | null;
  comments: string | null;
};

type Params = {
  supabase: SupabaseClient;
  routeId: number;
  establishmentId: number;
  lapsoUserId: number;
  source: DetailSource;
  offset: number;
  limit: number;
  query?: string;
};

export type EstablishmentProductsPage = {
  establishmentId: number;
  establishmentName: string;
  hasActiveLapso: boolean;
  items: ProductRecordItem[];
  hasMore: boolean;
};

export async function getEstablishmentProductsPage({
  supabase,
  routeId,
  establishmentId,
  lapsoUserId,
  source,
  offset,
  limit,
  query,
}: Params): Promise<EstablishmentProductsPage | null> {
  const searchPattern = buildSqlContainsPattern(sanitizeListSearchQuery(query));
  const { data: establishmentRow } = await supabase
    .from("establishment")
    .select("establishment_id, name")
    .eq("establishment_id", establishmentId)
    .eq("route_id", routeId)
    .eq("is_active", true)
    .maybeSingle();

  if (!establishmentRow) {
    return null;
  }

  const { data: lapso } = await supabase
    .from("route_lapso")
    .select("lapso_id")
    .eq("route_id", routeId)
    .eq("user_id", lapsoUserId)
    .eq("status", "en_curso")
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasActiveLapso = Boolean(lapso?.lapso_id);

  const { data: productRelations } = await supabase
    .from("products_establishment")
    .select("product_id")
    .eq("establishment_id", establishmentId);

  const productIds = (productRelations ?? []).map((item) => item.product_id);

  if (productIds.length === 0) {
    return {
      establishmentId: establishmentRow.establishment_id,
      establishmentName: establishmentRow.name,
      hasActiveLapso,
      items: [],
      hasMore: false,
    };
  }

  if (!hasActiveLapso && source === "completadas") {
    return {
      establishmentId: establishmentRow.establishment_id,
      establishmentName: establishmentRow.name,
      hasActiveLapso,
      items: [],
      hasMore: false,
    };
  }

  const collected: ProductRecordItem[] = [];
  let filteredOffset = 0;
  let scanOffset = 0;
  let reachedEnd = false;

  while (collected.length < limit + 1 && !reachedEnd) {
    let productQuery = supabase
      .from("product")
      .select("product_id, name, sku")
      .in("product_id", productIds)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .range(scanOffset, scanOffset + PRODUCT_SCAN_BATCH - 1);

    if (searchPattern) {
      productQuery = productQuery.or(`name.ilike.${searchPattern},sku.ilike.${searchPattern}`);
    }

    const { data: productRows } = await productQuery;

    const batch = productRows ?? [];
    if (batch.length === 0) {
      reachedEnd = true;
      break;
    }

    scanOffset += batch.length;

    const batchProductIds = batch.map((row) => row.product_id);
    const latestByProduct = new Map<number, CheckRecordRow>();

    if (lapso?.lapso_id && batchProductIds.length > 0) {
      const { data: records } = await supabase
        .from("check_record")
        .select(
          "record_id, product_id, time_date, system_inventory, real_inventory, evidence_num, comments",
        )
        .eq("lapso_id", lapso.lapso_id)
        .eq("user_id", lapsoUserId)
        .eq("establishment_id", establishmentId)
        .in("product_id", batchProductIds)
        .order("time_date", { ascending: false });

      for (const record of (records ?? []) as CheckRecordRow[]) {
        if (!latestByProduct.has(record.product_id)) {
          latestByProduct.set(record.product_id, record);
        }
      }
    }

    for (const product of batch) {
      const existingRecord = latestByProduct.get(product.product_id) ?? null;
      const include = source === "completadas"
        ? existingRecord !== null
        : existingRecord === null;

      if (!include) {
        continue;
      }

      if (filteredOffset < offset) {
        filteredOffset += 1;
        continue;
      }

      collected.push({
        productId: product.product_id,
        productName: product.name,
        productSku: product.sku,
        existingRecordId: existingRecord?.record_id ?? null,
        lastUpdateLabel: existingRecord ? formatLastUpdateLabel(existingRecord.time_date) : null,
        systemInventory: existingRecord?.system_inventory ?? null,
        realInventory: existingRecord?.real_inventory ?? null,
        evidenceNum: existingRecord?.evidence_num ?? null,
        comments: existingRecord?.comments ?? null,
      });

      if (collected.length > limit) {
        break;
      }
    }
  }

  const hasMore = collected.length > limit;

  return {
    establishmentId: establishmentRow.establishment_id,
    establishmentName: establishmentRow.name,
    hasActiveLapso,
    items: hasMore ? collected.slice(0, limit) : collected,
    hasMore,
  };
}
