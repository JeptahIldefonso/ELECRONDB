import { createClient } from '@/lib/supabase/server';
import { getHopeDb, type HopeDatabase } from '@/lib/hope-db';

export interface ProductItem {
  prodCode: string;
  description: string;
  unit: string;
  currentPrice: number | null;
  currentPriceEffDate: string | null;
  priceCount: number;
  isDeleted: boolean;
  status: 'Active' | 'Inactive';
  stamp: string | null;
}

export interface PriceRecordItem {
  effDate: string;
  prodCode: string;
  unitPrice: number;
  isDeleted: boolean;
  status: 'Active' | 'Inactive';
  stamp: string | null;
}

export interface ProductsMetrics {
  totalProducts: number;
  activeCount: number;
  inactiveCount: number;
  totalPriceRecords: number;
  unitCounts: Record<string, number>;
  nextSuggestedProdCode: string;
}

export interface ProductAuditLogItem {
  auditId: number;
  tableName: 'PRODUCT' | 'PRICEHIST' | string;
  action: 'ADD' | 'EDIT' | 'DELETE' | 'RESTORE';
  recordKey: string;
  oldValues: string | null;
  newValues: string | null;
  actionBy: string;
  actionAt: string;
}

// Backwards compatibility interfaces
export type ProductOverviewItem = any;
export type PriceHistoryItem = any;
export type ProductsSummaryMetrics = any;
export type ProductDetailItem = any;

function getSqliteDb(): HopeDatabase {
  return getHopeDb();
}

function isSupabaseLive(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project') &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-anon')
  );
}

/**
 * Fetch products list with derived current price, price history records, and audit log.
 */
export async function getProductsPageData(): Promise<{
  products: ProductItem[];
  priceHistory: PriceRecordItem[];
  metrics: ProductsMetrics;
  recentAudits: ProductAuditLogItem[];
}> {
  const db = getSqliteDb();

  const prodRows = await db.query(`
    SELECT 
      p.prodCode, 
      p.description, 
      p.unit, 
      p.is_deleted, 
      p.stamp,
      (
        SELECT ph.unitPrice 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = p.prodCode 
          AND ph.effDate <= CURRENT_DATE
          AND ph.is_deleted = 0
        ORDER BY ph.effDate DESC 
        LIMIT 1
      ) AS currentPrice,
      (
        SELECT ph.effDate 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = p.prodCode 
          AND ph.effDate <= CURRENT_DATE
          AND ph.is_deleted = 0
        ORDER BY ph.effDate DESC 
        LIMIT 1
      ) AS currentPriceEffDate,
      (
        SELECT count(*) 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = p.prodCode
      ) AS priceCount
    FROM PRODUCT p
    ORDER BY p.prodCode ASC
  `);

  const priceRows = await db.query(`
    SELECT effDate, prodCode, unitPrice, is_deleted, stamp
    FROM PRICEHIST
    ORDER BY effDate DESC, prodCode ASC
  `);

  const priceHistory: PriceRecordItem[] = priceRows.map((r: any) => {
    const isDeleted = Boolean(r.is_deleted === 1 || r.is_deleted === true || r.is_deleted === '1');
    const rawEff = r.effDate ?? r.effdate;
    const effDateStr = rawEff instanceof Date ? rawEff.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) : String(rawEff || '');
    return {
      effDate: effDateStr,
      prodCode: String(r.prodCode ?? r.prodcode ?? ''),
      unitPrice: Number(r.unitPrice ?? r.unitprice ?? 0),
      isDeleted,
      status: isDeleted ? 'Inactive' : 'Active',
      stamp: r.stamp ? String(r.stamp) : null,
    };
  });

  const products: ProductItem[] = prodRows.map((r: any) => {
    const isDeleted = Boolean(r.is_deleted === 1 || r.is_deleted === true || r.is_deleted === '1');
    const rawEff = r.currentPriceEffDate ?? r.currentpriceeffdate;
    const effDateStr = rawEff ? (rawEff instanceof Date ? rawEff.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) : String(rawEff)) : null;
    const rawPrice = r.currentPrice ?? r.currentprice;
    const currentPrice = rawPrice != null && rawPrice !== '' ? Number(rawPrice) : null;

    return {
      prodCode: String(r.prodCode ?? r.prodcode ?? ''),
      description: String(r.description || ''),
      unit: String(r.unit || 'pc'),
      currentPrice: isDeleted ? null : currentPrice,
      currentPriceEffDate: isDeleted ? null : effDateStr,
      priceCount: Number(r.priceCount ?? r.pricecount ?? 0),
      isDeleted,
      status: isDeleted ? 'Inactive' : 'Active',
      stamp: r.stamp ? String(r.stamp) : null,
    };
  });

  const activeCount = products.filter((p) => !p.isDeleted).length;
  const inactiveCount = products.filter((p) => p.isDeleted).length;

  const unitCounts: Record<string, number> = {};
  for (const p of products) {
    unitCounts[p.unit] = (unitCounts[p.unit] || 0) + 1;
  }

  let maxPNum = 0;
  for (const p of products) {
    const m = p.prodCode.match(/^P-?(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxPNum) maxPNum = n;
    }
  }
  const nextSuggestedProdCode = maxPNum > 0 
    ? `P-${String(maxPNum + 1).padStart(3, '0')}`
    : `P-${String(products.length + 1).padStart(3, '0')}`;

  let recentAudits: ProductAuditLogItem[] = [];
  try {
    const auditRows = await db.query(`
      SELECT audit_id, table_name, action, record_key, old_values, new_values, action_by, action_at
      FROM audit_log
      WHERE table_name IN ('PRODUCT', 'PRICEHIST')
      ORDER BY audit_id DESC
      LIMIT 30
    `);
    recentAudits = auditRows.map((r: any) => ({
      auditId: Number(r.audit_id ?? r.auditid ?? 0),
      tableName: String(r.table_name ?? r.tablename ?? 'PRODUCT'),
      action: (r.action || 'EDIT') as any,
      recordKey: String(r.record_key ?? r.recordkey ?? ''),
      oldValues: r.old_values ?? r.oldvalues ?? null,
      newValues: r.new_values ?? r.newvalues ?? null,
      actionBy: String(r.action_by ?? r.actionby ?? 'system'),
      actionAt: String(r.action_at ?? r.actionat ?? ''),
    }));
  } catch {}

  return {
    products,
    priceHistory,
    metrics: {
      totalProducts: products.length,
      activeCount,
      inactiveCount,
      totalPriceRecords: priceHistory.length,
      unitCounts,
      nextSuggestedProdCode,
    },
    recentAudits,
  };
}


