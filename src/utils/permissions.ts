import {
  AccessMode,
  EDITABLE_MODULES,
  EditableModule,
  RecordRow,
  TabName,
  UserPermissions,
  UserSession,
} from '../types';

export const SUPER_ADMIN_USERNAME = 'yudit061200';

export const OPERATIONAL_MODULES: EditableModule[] = [
  'ItemList',
  'MaterialRequest',
  'PurchaseOrder',
  'MaterialReceive',
  'MaterialIssued',
];

export const ALL_EDITABLE_MODULES: EditableModule[] = EDITABLE_MODULES.map((m) => m.key);

export function isSuperAdmin(username?: string | null): boolean {
  return String(username || '').trim().toLowerCase() === SUPER_ADMIN_USERNAME;
}

function normalizeEditableTabs(raw: unknown): EditableModule[] {
  const validSet = new Set<string>(ALL_EDITABLE_MODULES);
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map(String).filter((t) => validSet.has(t)))) as EditableModule[];
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter((t) => validSet.has(t))
      )
    ) as EditableModule[];
  }
  return [];
}

export function resolveUserPermissions(
  userRecord?: RecordRow | null,
  session?: UserSession | null
): UserPermissions {
  const username = String(userRecord?.Username ?? userRecord?.username ?? session?.username ?? '').trim();
  if (isSuperAdmin(username)) {
    return {
      mode: 'full_edit',
      editableTabs: [...ALL_EDITABLE_MODULES],
    };
  }

  const rawMode = String(userRecord?.AccessMode || '').trim().toLowerCase();
  if (rawMode === 'view_only') {
    return { mode: 'view_only', editableTabs: [] };
  }
  if (rawMode === 'full_edit') {
    return { mode: 'full_edit', editableTabs: [...ALL_EDITABLE_MODULES] };
  }
  if (rawMode === 'custom') {
    const tabs = normalizeEditableTabs(userRecord?.EditableTabs);
    return {
      mode: 'custom',
      editableTabs: tabs,
    };
  }

  // Fallback for legacy accounts without explicit AccessMode
  const roleLower = String(userRecord?.Role ?? userRecord?.role ?? session?.role ?? '').trim().toLowerCase();
  if (roleLower === 'viewer' || roleLower.includes('view')) {
    return { mode: 'view_only', editableTabs: [] };
  }
  if (roleLower === 'admin' || username.toLowerCase() === 'admin') {
    return { mode: 'full_edit', editableTabs: [...ALL_EDITABLE_MODULES] };
  }

  return {
    mode: 'custom',
    editableTabs: [...OPERATIONAL_MODULES],
  };
}

export function canEditTab(
  tab: TabName,
  permissions: UserPermissions,
  username?: string | null
): boolean {
  if (tab === 'Dashboard' || tab === 'Inventory') return false;
  if (isSuperAdmin(username)) return true;

  if (permissions.mode === 'view_only') return false;
  if (permissions.mode === 'full_edit') return true;
  return permissions.editableTabs.includes(tab as EditableModule);
}

export function canManageUsers(
  permissions: UserPermissions,
  username?: string | null
): boolean {
  if (isSuperAdmin(username)) return true;
  if (permissions.mode === 'full_edit') return true;
  if (permissions.mode === 'custom') {
    return permissions.editableTabs.includes('Users');
  }
  return false;
}

export function isViewOnlyAccount(
  permissions: UserPermissions,
  username?: string | null
): boolean {
  if (isSuperAdmin(username)) return false;
  if (permissions.mode === 'view_only') return true;
  if (permissions.mode === 'custom' && permissions.editableTabs.length === 0) return true;
  return false;
}

export interface PermissionSummaryBadge {
  label: string;
  detail: string;
  colorClass: string;
  icon: string;
}

export function getPermissionSummary(
  permissions: UserPermissions,
  username?: string | null
): PermissionSummaryBadge {
  if (isSuperAdmin(username)) {
    return {
      label: 'Super Admin',
      detail: 'Akses penuh seluruh modul & izin akun',
      colorClass:
        'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
      icon: 'fa-crown',
    };
  }

  if (permissions.mode === 'view_only' || (permissions.mode === 'custom' && permissions.editableTabs.length === 0)) {
    return {
      label: 'Hanya Lihat',
      detail: 'View Only (tidak bisa mengedit data)',
      colorClass:
        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600',
      icon: 'fa-eye',
    };
  }

  if (permissions.mode === 'full_edit') {
    return {
      label: 'Edit Semua',
      detail: 'Dapat mengedit seluruh modul',
      colorClass:
        'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      icon: 'fa-shield-halved',
    };
  }

  const shortNames = permissions.editableTabs.map((key) => {
    const meta = EDITABLE_MODULES.find((m) => m.key === key);
    return meta ? meta.shortLabel : key;
  });

  return {
    label: `Edit: ${shortNames.join(', ')}`,
    detail: `Bisa edit ${shortNames.join(', ')}; lainnya hanya lihat`,
    colorClass:
      'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
    icon: 'fa-sliders',
  };
}

export function buildPermissionFields(mode: AccessMode, editableTabs: EditableModule[]) {
  if (mode === 'view_only') {
    return { AccessMode: 'view_only' as AccessMode, EditableTabs: [] as EditableModule[] };
  }
  if (mode === 'full_edit') {
    return { AccessMode: 'full_edit' as AccessMode, EditableTabs: [...ALL_EDITABLE_MODULES] };
  }
  return {
    AccessMode: 'custom' as AccessMode,
    EditableTabs: Array.from(new Set(editableTabs)),
  };
}

export function getLatestSheetEditInfo(rows: RecordRow[]): {
  updatedBy: string;
  updatedAt?: string;
} | null {
  if (!rows || rows.length === 0) return null;

  let bestRow: RecordRow | null = null;
  let bestTs = -1;

  for (const r of rows) {
    if (!r) continue;
    const iso = r.UpdatedAtISO ? Date.parse(String(r.UpdatedAtISO)) : NaN;
    if (!Number.isNaN(iso) && iso > bestTs) {
      bestTs = iso;
      bestRow = r;
    }
  }

  if (bestRow && bestRow.UpdatedBy) {
    return {
      updatedBy: String(bestRow.UpdatedBy),
      updatedAt: bestRow.UpdatedAt ? String(bestRow.UpdatedAt) : undefined,
    };
  }

  const fallback = rows.find((r) => r && r.UpdatedBy && String(r.UpdatedBy).trim() !== '');
  if (fallback) {
    return {
      updatedBy: String(fallback.UpdatedBy),
      updatedAt: fallback.UpdatedAt ? String(fallback.UpdatedAt) : undefined,
    };
  }

  return null;
}
