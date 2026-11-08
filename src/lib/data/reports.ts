import { getHopeDb, type HopeDatabase } from '@/lib/hope-db';

function getDb(): HopeDatabase {
  return getHopeDb();
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const salaryFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatDateString(val: any): string {
  if (!val) return '—';
  if (val instanceof Date) {
    return val.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  }
  const s = String(val).trim();
  if (!s || s === 'null') return '—';
  if (s.includes('T')) return s.split('T')[0];
  return s;
}

// ========================================================================
// 1. TOP CUSTOMERS BY SALES (Figure 28)
// ========================================================================
export interface TopCustomerRow {
  rank: number;
  custNo: string;
  custName: string;
  totalSales: number;
  totalSalesFormatted: string;
}

export async function getTopCustomers(fromDate = '2010-01-01', toDate = '2026-12-31', topN = 10): Promise<TopCustomerRow[]> {
  const db = getDb();
  const effectiveFrom = fromDate || '2000-01-01';
  const effectiveTo = toDate || '2099-12-31';
  const effectiveTopN = Math.max(1, Number(topN) || 10);

  const query = `
    SELECT 
      c.custNo,
      c.custName,
      SUM(sd.quantity * (
        SELECT ph.unitPrice 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = sd.prodCode 
          AND ph.effDate <= s.salesDate 
          AND ph.is_deleted = 0
        ORDER BY ph.effDate DESC 
        LIMIT 1
      )) AS totalSales
    FROM SALES s
    JOIN CUSTOMER c ON c.custNo = s.custNo
    JOIN SALESDETAIL sd ON sd.transNo = s.transNo
    WHERE s.is_deleted = 0 
      AND sd.is_deleted = 0
      AND s.salesDate BETWEEN ? AND ?
    GROUP BY c.custNo, c.custName
    HAVING SUM(sd.quantity * (
        SELECT ph.unitPrice 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = sd.prodCode 
          AND ph.effDate <= s.salesDate 
          AND ph.is_deleted = 0
        ORDER BY ph.effDate DESC 
        LIMIT 1
      )) > 0
    ORDER BY totalSales DESC
    LIMIT ?
  `;

  try {
    const rows = await db.query(query, [effectiveFrom, effectiveTo, effectiveTopN]);
    return rows.map((r: any, idx: number) => {
      const custNo = r.custNo ?? r.custno ?? '';
      const custName = r.custName ?? r.custname ?? '';
      const totalSales = Number(r.totalSales ?? r.totalsales ?? 0);
      return {
        rank: idx + 1,
        custNo: String(custNo),
        custName: String(custName),
        totalSales,
        totalSalesFormatted: currencyFormatter.format(totalSales),
      };
    });
  } catch (err: any) {
    console.error('[reports] getTopCustomers error:', err?.message);
    return [];
  }
}

// ========================================================================
// 2. PRODUCT MASTER LIST (CURRENT PRICE) (Figure 29)
// "Only active products appear."
// ========================================================================
export interface ProductMasterRow {
  prodCode: string;
  description: string;
  unit: string;
  currentPrice: number | null;
  currentPriceFormatted: string;
}

export async function getProductMasterList(): Promise<ProductMasterRow[]> {
  const db = getDb();
  const query = `
    SELECT 
      p.prodCode,
      p.description,
      p.unit,
      (
        SELECT ph.unitPrice 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = p.prodCode 
          AND ph.effDate <= CURRENT_DATE
          AND ph.is_deleted = 0
        ORDER BY ph.effDate DESC 
        LIMIT 1
      ) as currentPrice
    FROM PRODUCT p
    WHERE p.is_deleted = 0
    ORDER BY p.prodCode ASC
  `;

  try {
    const rows = await db.query(query);
    return rows.map((r: any) => {
      const prodCode = r.prodCode ?? r.prodcode ?? '';
      const description = r.description ?? '';
      const unit = r.unit ?? 'pcs';
      const rawPrice = r.currentPrice ?? r.currentprice;
      const price = rawPrice !== null && rawPrice !== undefined && rawPrice !== '' ? Number(rawPrice) : null;
      return {
        prodCode: String(prodCode),
        description: String(description),
        unit: String(unit),
        currentPrice: price,
        currentPriceFormatted: price !== null ? currencyFormatter.format(price) : '—',
      };
    });
  } catch (err: any) {
    console.error('[reports] getProductMasterList error:', err?.message);
    return [];
  }
}

// ========================================================================
// 3. TOP PRODUCTS BY SALES AMOUNT (Figure 30)
// ========================================================================
export interface TopProductRow {
  rank: number;
  prodCode: string;
  description: string;
  qtySold: number;
  salesAmount: number;
  salesAmountFormatted: string;
}

export async function getTopProducts(fromDate = '2010-01-01', toDate = '2026-12-31', topN = 10): Promise<TopProductRow[]> {
  const db = getDb();
  const effectiveFrom = fromDate || '2000-01-01';
  const effectiveTo = toDate || '2099-12-31';
  const effectiveTopN = Math.max(1, Number(topN) || 10);

  const query = `
    SELECT 
      sd.prodCode,
      p.description,
      SUM(sd.quantity) as qtySold,
      SUM(sd.quantity * (
        SELECT ph.unitPrice 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = sd.prodCode 
          AND ph.effDate <= s.salesDate 
          AND ph.is_deleted = 0
        ORDER BY ph.effDate DESC 
        LIMIT 1
      )) as salesAmount
    FROM SALESDETAIL sd
    JOIN SALES s ON s.transNo = sd.transNo
    JOIN PRODUCT p ON p.prodCode = sd.prodCode
    WHERE s.is_deleted = 0 
      AND sd.is_deleted = 0
      AND s.salesDate BETWEEN ? AND ?
    GROUP BY sd.prodCode, p.description
    HAVING SUM(sd.quantity * (
        SELECT ph.unitPrice 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = sd.prodCode 
          AND ph.effDate <= s.salesDate 
          AND ph.is_deleted = 0
        ORDER BY ph.effDate DESC 
        LIMIT 1
      )) > 0
    ORDER BY salesAmount DESC
    LIMIT ?
  `;

  try {
    const rows = await db.query(query, [effectiveFrom, effectiveTo, effectiveTopN]);
    return rows.map((r: any, idx: number) => {
      const prodCode = r.prodCode ?? r.prodcode ?? '';
      const description = r.description ?? '';
      const qtySold = Number(r.qtySold ?? r.qtysold ?? 0);
      const salesAmount = Number(r.salesAmount ?? r.salesamount ?? 0);
      return {
        rank: idx + 1,
        prodCode: String(prodCode),
        description: String(description),
        qtySold,
        salesAmount,
        salesAmountFormatted: currencyFormatter.format(salesAmount),
      };
    });
  } catch (err: any) {
    console.error('[reports] getTopProducts error:', err?.message);
    return [];
  }
}

// ========================================================================
// 4. ACTIVE EMPLOYEES (NOT SEPARATED) (Figure 31)
// "Employees with no separation date."
// ========================================================================
export interface ActiveEmployeeRow {
  empNo: string;
  lastName: string;
  firstName: string;
  gender: string;
  birthDate: string;
  hireDate: string;
}

export async function getActiveEmployees(): Promise<ActiveEmployeeRow[]> {
  const db = getDb();
  const query = `
    SELECT empNo, lastName, firstName, gender, birthDate, hireDate
    FROM EMPLOYEE
    WHERE sepDate IS NULL
      AND is_deleted = 0
    ORDER BY empNo ASC
  `;

  try {
    const rows = await db.query(query);
    return rows.map((r: any) => ({
      empNo: String(r.empNo ?? r.empno ?? ''),
      lastName: String(r.lastName ?? r.lastname ?? ''),
      firstName: String(r.firstName ?? r.firstname ?? ''),
      gender: String(r.gender ?? '—'),
      birthDate: formatDateString(r.birthDate ?? r.birthdate),
      hireDate: formatDateString(r.hireDate ?? r.hiredate),
    }));
  } catch (err: any) {
    console.error('[reports] getActiveEmployees error:', err?.message);
    return [];
  }
}

// ========================================================================
// 5. ALL EMPLOYEES (INCLUDING SEPARATED) (Figure 32)
// ========================================================================
export interface AllEmployeeRow {
  empNo: string;
  lastName: string;
  firstName: string;
  gender: string;
  birthDate: string;
  hireDate: string;
  sepDate: string | null;
  status: 'Active' | 'Inactive';
}

export async function getAllEmployeesReport(): Promise<AllEmployeeRow[]> {
  const db = getDb();
  const query = `
    SELECT empNo, lastName, firstName, gender, birthDate, hireDate, sepDate, is_deleted
    FROM EMPLOYEE
    ORDER BY empNo ASC
  `;

  try {
    const rows = await db.query(query);
    return rows.map((r: any) => {
      const sepDateRaw = r.sepDate ?? r.sepdate;
      const isSep = Boolean(sepDateRaw && String(sepDateRaw).trim() !== '' && String(sepDateRaw) !== 'null');
      const isDeleted = Boolean(r.is_deleted === 1 || r.is_deleted === true || r.is_deleted === '1');
      const isInactive = isSep || isDeleted;
      return {
        empNo: String(r.empNo ?? r.empno ?? ''),
        lastName: String(r.lastName ?? r.lastname ?? ''),
        firstName: String(r.firstName ?? r.firstname ?? ''),
        gender: String(r.gender ?? '—'),
        birthDate: formatDateString(r.birthDate ?? r.birthdate),
        hireDate: formatDateString(r.hireDate ?? r.hiredate),
        sepDate: isSep ? formatDateString(sepDateRaw) : null,
        status: isInactive ? 'Inactive' : 'Active',
      };
    });
  } catch (err: any) {
    console.error('[reports] getAllEmployeesReport error:', err?.message);
    return [];
  }
}

// ========================================================================
// 6. EMPLOYEE JOB HISTORY (Figure 33)
// ========================================================================
export interface EmployeeJobHistoryRow {
  effDate: string;
  job: string;
  department: string;
  salary: number;
  salaryFormatted: string;
}

export async function getEmployeeJobHistoryReport(empNo: string | number): Promise<EmployeeJobHistoryRow[]> {
  const db = getDb();
  const cleanEmpNo = String(empNo || '').trim();
  if (!cleanEmpNo || cleanEmpNo === 'undefined') return [];

  const query = `
    SELECT 
      jh.effDate,
      jh.jobCode || ' — ' || j.jobDesc as job,
      jh.deptCode || ' — ' || d.deptName as department,
      jh.salary
    FROM JOBHISTORY jh
    JOIN JOB j ON j.jobCode = jh.jobCode
    JOIN DEPARTMENT d ON d.deptCode = jh.deptCode
    WHERE jh.empNo = ? AND jh.is_deleted = 0
    ORDER BY jh.effDate DESC
  `;

  try {
    const rows = await db.query(query, [cleanEmpNo]);
    return rows.map((r: any) => {
      const salary = Number(r.salary ?? 0);
      return {
        effDate: formatDateString(r.effDate ?? r.effdate),
        job: String(r.job ?? ''),
        department: String(r.department ?? ''),
        salary,
        salaryFormatted: salaryFormatter.format(salary),
      };
    });
  } catch (err: any) {
    console.error('[reports] getEmployeeJobHistoryReport error:', err?.message);
    return [];
  }
}

// ========================================================================
// 7. TOP SALES (Figure 34)
// ========================================================================
export interface TopSaleRow {
  rank: number;
  transNo: string;
  date: string;
  customer: string;
  employee: string;
  total: number;
  totalFormatted: string;
}

export async function getTopSales(fromDate = '2010-01-01', toDate = '2026-12-31', topN = 10): Promise<TopSaleRow[]> {
  const db = getDb();
  const effectiveFrom = fromDate || '2000-01-01';
  const effectiveTo = toDate || '2099-12-31';
  const effectiveTopN = Math.max(1, Number(topN) || 10);

  const query = `
    SELECT 
      s.transNo,
      s.salesDate as date,
      c.custName as customer,
      e.firstName || ' ' || e.lastName as employee,
      SUM(sd.quantity * (
        SELECT ph.unitPrice 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = sd.prodCode 
          AND ph.effDate <= s.salesDate 
          AND ph.is_deleted = 0
        ORDER BY ph.effDate DESC 
        LIMIT 1
      )) as total
    FROM SALES s
    JOIN CUSTOMER c ON c.custNo = s.custNo
    JOIN EMPLOYEE e ON e.empNo = s.empNo
    JOIN SALESDETAIL sd ON sd.transNo = s.transNo
    WHERE s.is_deleted = 0 
      AND sd.is_deleted = 0
      AND s.salesDate BETWEEN ? AND ?
    GROUP BY s.transNo, s.salesDate, c.custName, e.firstName, e.lastName
    HAVING SUM(sd.quantity * (
        SELECT ph.unitPrice 
        FROM PRICEHIST ph 
        WHERE ph.prodCode = sd.prodCode 
          AND ph.effDate <= s.salesDate 
          AND ph.is_deleted = 0
        ORDER BY ph.effDate DESC 
        LIMIT 1
      )) > 0
    ORDER BY total DESC
    LIMIT ?
  `;

  try {
    const rows = await db.query(query, [effectiveFrom, effectiveTo, effectiveTopN]);
    return rows.map((r: any, idx: number) => {
      const transNo = r.transNo ?? r.transno ?? '';
      const date = formatDateString(r.date ?? r.salesDate ?? r.salesdate);
      const customer = r.customer ?? r.custName ?? r.custname ?? '';
      const employee = r.employee ?? '';
      const total = Number(r.total ?? 0);
      return {
        rank: idx + 1,
        transNo: String(transNo),
        date,
        customer: String(customer),
        employee: String(employee),
        total,
        totalFormatted: currencyFormatter.format(total),
      };
    });
  } catch (err: any) {
    console.error('[reports] getTopSales error:', err?.message);
    return [];
  }
}

export async function getEmployeesListForDropdown(): Promise<Array<{ empNo: string; fullName: string }>> {
  const db = getDb();
  try {
    const rows = await db.query(`
      SELECT empNo, empNo || ' — ' || firstName || ' ' || lastName as fullName 
      FROM EMPLOYEE 
      WHERE is_deleted = 0
      ORDER BY empNo ASC
    `);
    return rows.map((r: any) => ({
      empNo: String(r.empNo ?? r.empno ?? ''),
      fullName: String(r.fullName ?? r.fullname ?? `${r.empNo ?? r.empno} — ${r.firstName ?? r.firstname} ${r.lastName ?? r.lastname}`),
    }));
  } catch (err: any) {
    console.error('[reports] getEmployeesListForDropdown error:', err?.message);
    return [];
  }
}
