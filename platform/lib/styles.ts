// Viewing styles. Keep the ids in sync with extension/common.js.
export const STYLES = [
  { id: 'hasidic', label: 'חסידי' },
  { id: 'litvak', label: 'ליטאי' },
  { id: 'dati_leumi', label: 'דתי לאומי' },
  { id: 'masorti', label: 'מסורתי' },
] as const;

export type StyleId = (typeof STYLES)[number]['id'];

export function styleLabel(id: string): string {
  return STYLES.find((s) => s.id === id)?.label ?? id;
}

export function isStyleId(id: unknown): id is StyleId {
  return typeof id === 'string' && STYLES.some((s) => s.id === id);
}
