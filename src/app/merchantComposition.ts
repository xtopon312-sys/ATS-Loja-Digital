import { LocalCommerceGateway } from '../infrastructure/firebase/LocalCommerceGateway'
import { FirebaseAuthService } from '../infrastructure/firebase/FirebaseAuthService'
import { FirebaseUserProfileRepository } from '../infrastructure/firebase/FirebaseUserProfileRepository'
import { FirebaseStoreIdentityRepository } from '../infrastructure/firebase/FirebaseStoreIdentityRepository'
import { createServicesFromImportMetaEnvironment } from '../infrastructure/firebase/importMetaEnvironment'
import { FirestoreCatalogUnitOfWork } from '../infrastructure/firebase/catalog/FirestoreCatalogUnitOfWork'
import { ResolveActorContext } from '../modules/auth/application/ResolveActorContext'
import { MerchantApplication } from '../modules/merchant/application/MerchantApplication'

async function compose() {
  const services = await createServicesFromImportMetaEnvironment()
  const actors = new ResolveActorContext(new FirebaseUserProfileRepository(services.firestore), new FirebaseStoreIdentityRepository(services.firestore))
  return {
    operations: new LocalCommerceGateway(services.auth),
    auth: new FirebaseAuthService(services.auth, actors),
    merchant: new MerchantApplication(id => new FirestoreCatalogUnitOfWork(services.firestore, id), { now: () => new Date().toISOString(), nextId: () => crypto.randomUUID() }),
  }
}
let composition: ReturnType<typeof compose> | undefined
export function merchantComposition() { return composition ??= compose().catch(error => { composition = undefined; throw error }) }
