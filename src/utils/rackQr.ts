import QRCode from 'qrcode';
import { RecordRow } from '../types';
import { parseNumberValue } from './currency';

export interface RackGroup {
  rackKey: string;
  rackName: string;
  items: RecordRow[];
  totalStock: number;
  needOrderCount: number;
}

export const UNASSIGNED_RACK_NAME = 'Tanpa Lokasi / Umum';

export function normalizeRackName(rawLocation: unknown): string {
  const cleaned = String(rawLocation ?? '').trim();
  return cleaned || UNASSIGNED_RACK_NAME;
}

export function groupItemsByRack(inventoryItems: RecordRow[]): RackGroup[] {
  const map = new Map<string, RackGroup>();

  for (const item of inventoryItems) {
    const rawLoc = String(item.Location ?? '').trim();
    const displayName = rawLoc || UNASSIGNED_RACK_NAME;
    const key = displayName.toLowerCase();

    let group = map.get(key);
    if (!group) {
      group = {
        rackKey: key,
        rackName: displayName,
        items: [],
        totalStock: 0,
        needOrderCount: 0,
      };
      map.set(key, group);
    }

    const curStock = parseNumberValue(
      item.CurrentStock !== undefined ? item.CurrentStock : item.LastStock
    );
    const minStock = parseNumberValue(item.MinStock);

    group.items.push(item);
    group.totalStock += curStock;
    if (curStock <= minStock || item.Status === 'Need Order') {
      group.needOrderCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.rackName === UNASSIGNED_RACK_NAME) return 1;
    if (b.rackName === UNASSIGNED_RACK_NAME) return -1;
    return a.rackName.localeCompare(b.rackName, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

export function buildRackQrUrl(rackName: string): string {
  const trimmed = rackName.trim();
  if (typeof window !== 'undefined' && window.location) {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?rack=${encodeURIComponent(trimmed)}`;
  }
  return `RACK:${trimmed}`;
}

export function extractRackFromQrText(
  decodedText: string,
  availableRacks: RackGroup[]
): string | null {
  const raw = String(decodedText || '').trim();
  if (!raw) return null;

  let candidate: string | null = null;

  // 1. Check URL query parameter ?rack=...
  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw);
      const param = parsed.searchParams.get('rack');
      if (param && param.trim()) {
        candidate = param.trim();
      }
    } else if (raw.includes('?rack=') || raw.includes('&rack=')) {
      const queryPart = raw.includes('?') ? raw.slice(raw.indexOf('?')) : `?${raw}`;
      const params = new URLSearchParams(queryPart);
      const param = params.get('rack');
      if (param && param.trim()) {
        candidate = param.trim();
      }
    }
  } catch {
    // Ignore malformed URLs and continue fallback checks
  }

  // 2. Check explicit RACK: or LOC: prefix
  if (!candidate) {
    const prefixMatch = raw.match(/^(?:RACK|RAK|LOC|LOCATION)\s*[:=]\s*(.+)$/i);
    if (prefixMatch && prefixMatch[1]) {
      candidate = prefixMatch[1].trim();
    }
  }

  // 3. Match candidate or raw text against known racks (case-insensitive)
  const searchVal = (candidate || raw).toLowerCase();
  const exactMatch = availableRacks.find(
    (g) => g.rackKey === searchVal || g.rackName.toLowerCase() === searchVal
  );
  if (exactMatch) {
    return exactMatch.rackName;
  }

  // If explicit rack URL or RACK: prefix was detected even if no items match yet, return the candidate
  if (candidate) {
    return candidate;
  }

  return null;
}

export async function generateQrDataUrl(text: string, width = 240): Promise<string> {
  return QRCode.toDataURL(text, {
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
