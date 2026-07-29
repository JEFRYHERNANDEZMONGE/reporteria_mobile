import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DetailSource,
  EstablishmentDetailData,
  ProductRecordItem,
} from "./detail-types";

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
    timeZone: "America/Costa_Rica",
  });
}

type ProductRow = {
  product_id: number;
  name: string;
  sku: string;
  photo_url: string | null;
};

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
};

export async function getEstablishmentDetailData({
  supabase,
  routeId,
  establishmentId,
  lapsoUserId,
  source,
}: Params): Promise<EstablishmentDetailData | null> {
  const { data: establishmentRow, error: establishmentError } = await supabase
    .from("establishment")
    .select("establishment_id, name, direction, route_id, lat, long")
    .eq("establishment_id", establishmentId)
    .eq("route_id", routeId)
    .eq("is_active", true)
    .maybeSingle();

  if (establishmentError) {
    console.error(`Error cargando establishment ${establishmentId}:`, establishmentError);
    return null;
  }

  if (!establishmentRow) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const { data: lapso } = await supabase
    .from("route_lapso")
    .select("lapso_id")
    .eq("route_id", routeId)
    .eq("user_id", lapsoUserId)
    .eq("status", "en_curso")
    .lte("start_at", nowIso)
    .gt("end_at", nowIso)
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: productRelations, error: productRelationsError } = await supabase
    .from("products_establishment")
    .select("product_id")
    .eq("establishment_id", establishmentId);

  if (productRelationsError) {
    console.error(
      `Error cargando products_establishment para ${establishmentId}:`,
      productRelationsError,
    );
  }

  const productIds = (productRelations ?? []).map((item) => item.product_id);
  let productRows: ProductRow[] = [];

  if (productIds.length > 0) {
    const { data, error: productsError } = await supabase
      .from("product")
      .select("product_id, name, sku, photo_url")
      .in("product_id", productIds)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (productsError) {
      console.error(`Error cargando products para ${establishmentId}:`, productsError);
    }

    productRows = (data ?? []) as ProductRow[];
  }

  const latestByProduct = new Map<number, CheckRecordRow>();

  if (lapso?.lapso_id && productRows.length > 0) {
    const { data, error: recordsError } = await supabase
      .from("check_record")
      .select("record_id, product_id, time_date, system_inventory, real_inventory, evidence_num, comments")
      .eq("lapso_id", lapso.lapso_id)
      .eq("user_id", lapsoUserId)
      .eq("establishment_id", establishmentId)
      .in(
        "product_id",
        productRows.map((row) => row.product_id),
      )
      .order("time_date", { ascending: false });

    if (recordsError) {
      console.error(`Error cargando check_records para ${establishmentId}:`, recordsError);
    }

    for (const record of (data ?? []) as CheckRecordRow[]) {
      if (!latestByProduct.has(record.product_id)) {
        latestByProduct.set(record.product_id, record);
      }
    }
  }

  let items: ProductRecordItem[] = productRows.map((product) => {
    const existingRecord = latestByProduct.get(product.product_id) ?? null;
    return {
      productId: product.product_id,
      productName: product.name,
      productSku: product.sku,
      photoUrl: product.photo_url ?? null,
      existingRecordId: existingRecord?.record_id ?? null,
      lastUpdateLabel: existingRecord ? formatLastUpdateLabel(existingRecord.time_date) : null,
      systemInventory: existingRecord?.system_inventory ?? null,
      realInventory: existingRecord?.real_inventory ?? null,
      evidenceNum: existingRecord?.evidence_num ?? null,
      comments: existingRecord?.comments ?? null,
    };
  });

  if (source === "completadas") {
    items = items.filter((item) => item.existingRecordId !== null);
  } else {
    items = items.filter((item) => item.existingRecordId === null);
  }

  const lat = Number(establishmentRow.lat);
  const lng = Number(establishmentRow.long);
  const mapsHref = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : null;

  return {
    establishmentId: establishmentRow.establishment_id,
    establishmentName: establishmentRow.name,
    establishmentDirection: establishmentRow.direction ?? null,
    hasActiveLapso: Boolean(lapso?.lapso_id),
    totalProducts: productRows.length,
    mapsHref,
    items,
  };
}
