import { decodeCart, encodeCart, type CartItem } from '../domain/Cart'

export interface CartStorage { read(storeId: string): { items: CartItem[]; failed: boolean }; write(storeId: string, items: CartItem[]): boolean }
export class LocalCartStorage implements CartStorage {
  constructor(private storage: { getItem(key: string): string | null; setItem(key: string, value: string): void }) {}
  read(storeId: string) {
    try { return { items: decodeCart(this.storage.getItem(`ats:cart:v1:${storeId}`), storeId), failed: false } }
    catch { return { items: [], failed: true } }
  }
  write(storeId: string, items: CartItem[]) {
    try { this.storage.setItem(`ats:cart:v1:${storeId}`, encodeCart(storeId, items)); return true } catch { return false }
  }
}
