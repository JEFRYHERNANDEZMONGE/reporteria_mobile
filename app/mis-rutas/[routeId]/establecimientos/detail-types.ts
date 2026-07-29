export type DetailSource = "pendientes" | "completadas";

export type ProductRecordItem = {
  productId: number;
  productName: string;
  productSku: string;
  photoUrl: string | null;
  existingRecordId: number | null;
  lastUpdateLabel: string | null;
  systemInventory: number | null;
  realInventory: number | null;
  evidenceNum: number | null;
  comments: string | null;
};

export type EstablishmentDetailData = {
  establishmentId: number;
  establishmentName: string;
  establishmentDirection: string | null;
  hasActiveLapso: boolean;
  totalProducts: number;
  mapsHref: string | null;
  items: ProductRecordItem[];
};
