export const DEFAULT_EXCHANGE_RATE = 16000; // Kurs standar: 1 USD = Rp 16.000

export const parseNumberValue = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined || val === '') return 0;
  // Clean string from currency symbols like $, Rp, commas, whitespace
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const processPriceUpdates = (
  updates: Record<string, any>,
  currentRecord: Record<string, any>,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE
): Record<string, any> => {
  const result = { ...currentRecord, ...updates };

  // If UnitPriceUSD explicitly passed in updates or modified
  if ('UnitPriceUSD' in updates) {
    const usd = parseNumberValue(updates.UnitPriceUSD);
    result.UnitPriceUSD = usd;
    result.UnitPriceIDR = Math.round(usd * exchangeRate);
  } else if ('UnitPriceIDR' in updates) {
    const idr = parseNumberValue(updates.UnitPriceIDR);
    result.UnitPriceIDR = idr;
    result.UnitPriceUSD = parseFloat((idr / exchangeRate).toFixed(2));
  } else {
    // Auto-conversion if one side is missing or 0
    const usd = parseNumberValue(result.UnitPriceUSD);
    const idr = parseNumberValue(result.UnitPriceIDR);
    if (usd > 0 && (!idr || idr === 0)) {
      result.UnitPriceIDR = Math.round(usd * exchangeRate);
    } else if (idr > 0 && (!usd || usd === 0)) {
      result.UnitPriceUSD = parseFloat((idr / exchangeRate).toFixed(2));
    }
  }

  // Recalculate totals based on Qty
  const qty = parseNumberValue(result.Qty);
  if (result.UnitPriceUSD !== undefined) {
    const uUsd = parseNumberValue(result.UnitPriceUSD);
    result.TotalPriceUSD = (qty * uUsd).toFixed(2);
  }
  if (result.UnitPriceIDR !== undefined) {
    const uIdr = parseNumberValue(result.UnitPriceIDR);
    result.TotalPriceIDR = (qty * uIdr).toFixed(0);
  }

  return result;
};
