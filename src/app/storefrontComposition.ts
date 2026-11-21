import { LocalCommerceGateway } from '../infrastructure/firebase/LocalCommerceGateway'
import { createServicesFromImportMetaEnvironment } from '../infrastructure/firebase/importMetaEnvironment'
import { FirestorePublicCatalogRepository } from '../infrastructure/firebase/catalog/FirestorePublicCatalogRepository'

let repository: Promise<{ repository: FirestorePublicCatalogRepository; checkout: LocalCommerceGateway }> | undefined
export function storefrontComposition() {
  return repository ??= createServicesFromImportMetaEnvironment().then(services => ({ repository: new FirestorePublicCatalogRepository(services.firestore), checkout: new LocalCommerceGateway() }))
    .catch(error => { repository = undefined; throw error })
}
