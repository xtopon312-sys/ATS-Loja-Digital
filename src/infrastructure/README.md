# Infraestrutura

## Fase 3

A única infraestrutura implementada é local: Firebase modular conectado obrigatoriamente aos Emulators de Authentication e Firestore sob `demo-ats-loja-digital`.

`src/infrastructure/firebase` contém configuração fail-closed, FirebaseAuthService, FirebaseUserProfileRepository e FirebaseStoreIdentityRepository. Nenhum repository comercial foi portado. A composição da UI ainda não importa ou inicia Firebase.

Configuração permitida: 127.0.0.1:9099 (Auth), 127.0.0.1:8180 (Firestore) e UI 127.0.0.1:4000. Não há modo remoto, segredo, Admin SDK, Functions, Hosting, Storage ou deploy.

Os adapters pertencem à infraestrutura e implementam ports do módulo auth. O domínio comercial não importa Firebase. Ver docs/01-ARQUITETURA.md e docs/04-SEGURANCA.md.