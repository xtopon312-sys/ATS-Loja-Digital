import { test, expect, type Page } from '@playwright/test'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
// @ts-expect-error Local fixture scripts execute as Node ESM, outside the browser bundle.
import { seedPublicFixtures, withLocalPublicFixture } from '../scripts/seed-public.mjs'
// @ts-expect-error Public disposable local credentials, not a production secret.
import { demoCredentials } from '../scripts/seed-local.mjs'

test.beforeEach(async () => { await seedPublicFixtures() })
async function login(page: Page) {
  await page.goto('/login'); await page.getByLabel('E-mail', { exact: true }).fill(demoCredentials.email)
  await page.getByLabel('Senha', { exact: true }).fill(demoCredentials.password)
  await page.getByRole('button', { name: 'Entrar no painel' }).click()
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible()
}
async function checkout(page: Page) {
  await page.goto('/loja/store-a-demo')
  await page.getByRole('button', { name: 'Adicionar Produto Essencial DEMO à sacola' }).click()
  await page.getByRole('button', { name: /Abrir sacola/ }).click()
  await page.getByRole('button', { name: 'Aumentar quantidade de Produto Essencial DEMO' }).click()
  await page.getByLabel('Seu nome', { exact: true }).fill('Cliente E2E DEMO')
  await page.getByLabel('Seu telefone com DDI e DDD').fill('15555550102')
  await page.getByLabel('Observação (opcional)').fill('Café & ação DEMO')
  await page.getByRole('button', { name: 'Criar pedido', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pedido enviado para análise da loja' })).toBeVisible()
}
test('pedido público, WhatsApp explícito, confirmação, estoque e estorno reais', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message)); page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  // No external navigation: inspect the explicit URL only; any accidental WhatsApp request fails this test.
  let external = false
  await page.context().route('https://wa.me/**', route => { external = true; return route.abort() })
  await checkout(page)
  const href = await page.getByRole('link', { name: 'Enviar pedido pelo WhatsApp' }).getAttribute('href')
  const message = new URL(href!).searchParams.get('text')!
  expect(message).toContain('2 × Produto Essencial DEMO'); expect(message).toContain('39,80'); expect(message).toContain('Café & ação DEMO')
  const id = await withLocalPublicFixture(async (db: import('firebase/firestore').Firestore) => {
    const orders = await getDocs(collection(db, 'stores/store-demo-a/orders')); expect(orders.size).toBe(1)
    expect(orders.docs[0].data().status).toBe('PENDING'); expect((await getDoc(doc(db, 'stores/store-demo-a/products/essential'))).data()!.stock).toBe(3)
    expect((await getDocs(collection(db, 'stores/store-demo-a/stockMovements'))).size).toBe(2)
    return orders.docs[0].id
  })
  expect(message).toContain(id)
  await page.reload(); await page.getByRole('button', { name: /Abrir sacola/ }).click()
  await expect(page.getByText(id, { exact: true })).toBeVisible()
  await login(page); await page.goto('/painel/pedidos'); await page.getByRole('button', { name: 'Ver pedido' }).click()
  await expect(page.getByRole('heading', { name: 'Detalhes do pedido', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar pedido', exact: true }).click()
  await expect(page.getByText('Confirmado', { exact: true })).toBeVisible()
  await withLocalPublicFixture(async (db: import('firebase/firestore').Firestore) => {
    expect((await getDoc(doc(db, 'stores/store-demo-a/products/essential'))).data()!.stock).toBe(1)
    expect((await getDoc(doc(db, 'publicStores/store-demo-a/products/essential'))).data()!.maxQuantity).toBe(1)
    expect((await getDocs(collection(db, 'stores/store-demo-a/stockMovements'))).size).toBe(3)
  })
  await page.goto('/painel/estoque'); await expect(page.getByRole('heading', { name: 'Estoque atual' })).toBeVisible()
  await expect(page.getByRole('cell', { name: `Pedido confirmado Pedido ${id}`, exact: true })).toBeVisible()
  await page.goto(`/painel/pedidos/${id}`); await page.getByRole('button', { name: 'Estornar pedido' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Estornar pedido' }).click()
  await expect(page.getByText('Estornado', { exact: true })).toBeVisible()
  await withLocalPublicFixture(async (db: import('firebase/firestore').Firestore) => {
    expect((await getDoc(doc(db, 'stores/store-demo-a/products/essential'))).data()!.stock).toBe(3)
    expect((await getDoc(doc(db, 'publicStores/store-demo-a/products/essential'))).data()!.maxQuantity).toBe(2)
    expect((await getDocs(collection(db, 'stores/store-demo-a/orders'))).size).toBe(1)
    expect((await getDocs(collection(db, 'stores/store-demo-a/stockMovements'))).size).toBe(4)
  })
  expect(external).toBe(false); expect(errors).toEqual([])
})

test('checkout e operação em seis viewports, teclado, ajuste e cancelamento', async ({ page }) => {
  test.setTimeout(120000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/loja/store-a-demo'); await page.getByRole('button', { name: 'Adicionar Produto Essencial DEMO à sacola' }).click()
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [320, 720]]) {
    await page.setViewportSize({ width, height }); await page.getByRole('button', { name: /Abrir sacola/ }).click()
    const dialog = page.getByRole('dialog'); await expect(page.getByLabel('Seu nome', { exact: true })).toBeVisible()
    expect(await dialog.locator('.field-label').first().evaluate(el => getComputedStyle(el).color === getComputedStyle(el.closest('.public-checkout')!).color)).toBe(true)
    await page.getByLabel('Seu nome', { exact: true }).focus(); await page.keyboard.press('Tab'); await expect(page.getByLabel('Seu telefone com DDI e DDD')).toBeFocused()
    await page.keyboard.press('Shift+Tab'); await expect(page.getByLabel('Seu nome', { exact: true })).toBeFocused()
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await page.screenshot({ path: `output/playwright/phase7/checkout-${width}.png`, fullPage: true })
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: /Abrir sacola/ })).toBeFocused()
  }
  await login(page); await page.goto('/painel/minha-loja')
  await page.getByLabel('WhatsApp da loja').fill('+1 (555) 555-0103')
  await page.getByRole('button', { name: 'Salvar loja' }).click()
  await expect(page.getByText('Nome da loja atualizado.')).toBeVisible()
  await page.reload(); await expect(page.getByLabel('WhatsApp da loja')).toHaveValue('15555550103')
  await page.getByRole('button', { name: 'Sair', exact: true }).click(); await expect(page).toHaveURL(/\/login$/)
  await page.evaluate(() => localStorage.clear())
  await checkout(page)
  const orderId = await page.getByRole('region', { name: 'Pedido criado' }).locator('.order-code strong').textContent()
  await expect(page.getByRole('link', { name: 'Enviar pedido pelo WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/15555550103\?text=/)
  await login(page)
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844], [320, 720]]) {
    await page.setViewportSize({ width, height })
    for (const path of ['/painel/pedidos', '/painel/estoque', `/painel/pedidos/${orderId}`]) {
      await page.goto(path); await expect(page.getByRole('heading', { name: path.endsWith('estoque') ? 'Estoque atual' : path === '/painel/pedidos' ? 'Pedidos' : 'Detalhes do pedido', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `output/playwright/phase7/${path.includes('/pedidos/') ? 'pedido-detalhe' : path.split('/').at(-1)}-${width}.png`, fullPage: true })
    }
  }
  await page.goto('/painel/estoque')
  await page.getByLabel('Produto para ajuste').selectOption('essential'); await page.getByLabel('Quantidade do ajuste').fill('2'); await page.getByLabel('Motivo do ajuste').fill('Contagem E2E DEMO')
  await page.getByRole('button', { name: 'Registrar ajuste' }).focus(); await page.keyboard.press('Enter')
  await expect(page.getByText('Estoque ajustado e movimento registrado.')).toBeVisible()
  await page.goto('/painel/pedidos'); await page.getByRole('button', { name: 'Ver pedido' }).click()
  await page.getByRole('button', { name: 'Cancelar pedido' }).click()
  const dialog = page.getByRole('alertdialog'); await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused()
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Cancelar pedido' })).toBeFocused()
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancelar pedido' }).focus(); await page.keyboard.press('Space')
  await expect(page.getByText('Cancelado', { exact: true })).toBeVisible()
  await withLocalPublicFixture(async (db: import('firebase/firestore').Firestore) => { expect((await getDoc(doc(db, 'stores/store-demo-a/products/essential'))).data()!.stock).toBe(5) })
})
