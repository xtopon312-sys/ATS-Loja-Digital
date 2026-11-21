export interface Plan {
  id: string
  name: string
  priceCents: number
  currency: 'BRL'
  interval: 'MONTH'
  limits: { maxProducts: number; maxCategories: number }
  capabilities: readonly string[]
}

export const INITIAL_PLAN: Readonly<Plan> = Object.freeze({
  id: 'ats-loja-digital', name: 'ATS Loja Digital', priceCents: 10000,
  currency: 'BRL', interval: 'MONTH',
  limits: Object.freeze({ maxProducts: 50, maxCategories: 5 }),
  capabilities: Object.freeze(['products', 'categories', 'orders', 'inventory', 'whatsappCheckout', 'branding']),
})
