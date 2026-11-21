import { useState, type FormEvent } from 'react'
import { Package } from 'lucide-react'
import type { ProductFormValue, CatalogView } from '../../modules/merchant/application/MerchantApplication'
import type { Product } from '../../modules/products/domain/Product'
import { priceInput } from '../../modules/merchant/application/money'
import { feedback } from '../../modules/merchant/application/feedback'
import { Button } from '../../shared/ui/Button'
import { Input, Select, Textarea } from '../../shared/ui/FormControls'
import { Card } from '../../shared/ui/Card'

export function ProductForm({ view, product, onSave, onCancel }: { view: CatalogView; product?: Product; onSave(value: ProductFormValue): Promise<void>; onCancel(): void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const categories = view.categories.filter(c => c.status === 'ACTIVE' || c.id === product?.categoryId)
  const blocked = view.store.status !== 'ACTIVE' || (!product && !view.canCreateProduct)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    try { await onSave({ name: String(data.get('name')), description: String(data.get('description')), price: String(data.get('price')),
      categoryId: String(data.get('categoryId')), initialStock: String(data.get('initialStock') ?? '0'), status: String(data.get('status')) as ProductFormValue['status'] }) }
    catch (cause) { setError(feedback(cause)) } finally { setBusy(false) }
  }
  return <form className="product-form" onSubmit={event => { void submit(event) }} aria-busy={busy}>
    <Card><h2>Informações do produto</h2><p className="muted">Dados que ajudam a identificar e organizar seu catálogo.</p>
      <fieldset disabled={busy || blocked} className="merchant-fields"><Input label="Nome" name="name" required maxLength={120} defaultValue={product?.name ?? ''} />
        <Textarea label="Descrição" name="description" maxLength={2000} defaultValue={product?.description ?? ''} rows={4} />
        <div className="form-pair"><Input label="Preço (R$)" name="price" inputMode="decimal" required defaultValue={product ? priceInput(product.priceCents) : '0,00'} hint="Ex.: 59,90" aria-invalid={!!error} aria-describedby={error ? 'product-error' : undefined} />
          <Select label="Categoria" name="categoryId" required defaultValue={product?.categoryId ?? ''}><option value="" disabled>Selecione uma categoria</option>{categories.map(c => <option key={c.id} value={c.id} disabled={c.status !== 'ACTIVE' && c.id !== product?.categoryId}>{c.name}{c.status === 'ARCHIVED' ? ' (arquivada)' : ''}</option>)}</Select></div>
        <div className="form-pair"><Select label="Status" name="status" defaultValue={product?.status ?? 'ACTIVE'}><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option>{product?.status === 'ARCHIVED' && <option value="ARCHIVED">Arquivado</option>}</Select>
          {product ? <Input label="Estoque atual" value={product.stock} readOnly hint="Para registrar entradas ou saídas, use Estoque no menu." /> : <Input label="Quantidade em estoque" name="initialStock" inputMode="numeric" defaultValue="0" required hint="Unidades inteiras. Gera movimento de entrada inicial." aria-invalid={!!error} aria-describedby={error ? 'product-error' : undefined} />}</div>
      </fieldset>
      {error && <p id="product-error" className="form-error" role="alert">{error}</p>}
      {!categories.length && <p role="status">Crie uma categoria antes de cadastrar seu produto.</p>}
      {blocked && <p role="status">Cadastro bloqueado pela situação da loja ou pelo limite de produtos.</p>}
      <div className="form-actions"><Button variant="secondary" onClick={onCancel} disabled={busy}>Voltar</Button><Button type="submit" loading={busy} disabled={blocked || !categories.length} loadingLabel="Salvando…">Salvar produto</Button></div>
    </Card><aside><Card><div className="product-image-placeholder"><Package size={52} strokeWidth={1.4} aria-hidden="true" /><span>Produto sem imagem</span></div><h2>Imagem do produto</h2><p className="muted">O envio de imagens será disponibilizado em uma etapa futura.</p></Card></aside>
  </form>
}
