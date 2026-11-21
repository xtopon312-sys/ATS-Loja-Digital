const messages: Record<string, string> = {
  INVALID_QUANTITY: 'Informe uma quantidade inteira positiva dentro do limite disponível.',
  INSUFFICIENT_STOCK: 'Estoque insuficiente. Nenhum item deste pedido foi baixado.',
  ORDER_NOT_FOUND: 'Pedido não encontrado nesta loja.',
  INVALID_ORDER_STATE: 'A situação atual do pedido não permite esta operação.',
  IDEMPOTENCY_CONFLICT: 'Esta tentativa já foi usada com outros dados. Confira o pedido antes de continuar.',
  PRODUCT_UNAVAILABLE: 'Um produto não está mais disponível. Atualize o catálogo.',
  INVALID_INPUT: 'Confira os campos informados, os limites de texto e o telefone com código do país.',
  PRODUCT_LIMIT_REACHED: 'Sua loja já utiliza os 50 produtos. Arquive um produto para liberar espaço.',
  CATEGORY_LIMIT_REACHED: 'Sua loja já utiliza as 5 categorias. Arquive uma categoria sem produtos para liberar espaço.',
  CATEGORY_IN_USE: 'Esta categoria possui produtos não arquivados. Mova ou arquive esses produtos primeiro.',
  CATEGORY_NOT_FOUND: 'Selecione uma categoria ativa da sua loja.', PRODUCT_NOT_FOUND: 'Produto não encontrado nesta loja.',
  INVALID_PRICE: 'Informe um preço válido, como 19,90 ou 1.299,90, sem sinal e com duas casas decimais.',
  INVALID_STOCK: 'Informe uma quantidade inteira de estoque, igual ou maior que zero.',
  STORE_SUSPENDED: 'Sua loja está suspensa. A consulta está disponível, mas as alterações estão bloqueadas.',
  ACCESS_DENIED: 'Seu perfil não possui acesso a esta operação.', CROSS_STORE_ACCESS: 'Você não pode acessar outra loja.',
  'permission-denied': 'Acesso negado. Seu perfil, a loja ou esta operação não permite a alteração.',
  'auth/invalid-credential': 'E-mail ou senha inválidos.', 'auth/user-not-found': 'E-mail ou senha inválidos.',
  'auth/wrong-password': 'E-mail ou senha inválidos.', 'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
}
export function feedback(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  return messages[code] ?? 'Não foi possível concluir. Confira se os Emulators estão ativos e tente novamente.'
}
