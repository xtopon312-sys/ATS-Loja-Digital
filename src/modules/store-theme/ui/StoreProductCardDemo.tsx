import { Package } from 'lucide-react'

export function StoreProductCardDemo({ index }: { index: number }) {
  return (
    <article className="product-card">
      <div className="product-card__visual"><Package size={38} strokeWidth={1.5} aria-hidden="true" /></div>
      <div className="product-card__body">
        <h4>Item demonstrativo {index}</h4>
        <p className="product-card__price">R$ —</p>
        <button type="button" className="store-action">Ação demonstrativa</button>
      </div>
    </article>
  )
}
