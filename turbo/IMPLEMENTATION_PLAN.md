# Piano di implementazione RAG Chat

## 1. Obiettivo

Costruire un'applicazione RAG ChatGPT-like dentro `/turbo`, basata su Turborepo e Next.js full-stack, in cui gli utenti possono:

- selezionare un utente mock da una schermata di login;
- caricare documenti, inizialmente PDF ma con predisposizione ai formati supportati da LlamaParse;
- assegnare tag ai documenti;
- dialogare con tutti i documenti accessibili al proprio ruolo;
- ricevere risposte con references, citazioni e documenti sorgente;
- amministrare utenti, ruoli e tag da una sezione settings.

Il sistema deve partire bene su Vercel, ma restare progettato per un futuro deployment on-prem.

## 2. Decisioni gia prese

| Area | Decisione |
| --- | --- |
| Monorepo | Turborepo sotto `/turbo` |
| App principale | Next.js App Router, frontend e backend nella stessa app |
| Linguaggio | TypeScript strict |
| UI | shadcn/ui + Tailwind CSS |
| Stile UI | ChatGPT-like, layout pulito, componenti piccoli |
| Lingue | Bilingue IT/EN, default dalla lingua del browser |
| Auth iniziale | Mock auth: scelta utente da schermata |
| DB | Neon PostgreSQL |
| Vector DB | Qdrant |
| Parsing documenti | LlamaParse cloud |
| LLM | Vercel AI SDK / AI Gateway, modello configurabile |
| Ingestion | Job asincrono via Vercel Workflows (`workflow` SDK) |
| ACL | Tag-based access control derivato dal ruolo |
| Admin | Vede tutto |
| Logging | Minimo audit log, senza appesantire la v1 |

## 3. Stato attuale dello scaffold

E' stato iniziato lo scaffold di `/turbo` con:

```txt
/turbo
  apps/
    web/
  packages/
    config/
    db/
    rag/
    ui/
```

Sono gia stati introdotti:

- `pnpm-workspace.yaml`;
- `turbo.json`;
- package root con script `dev`, `build`, `lint`, `typecheck`, `format`;
- app Next.js in `apps/web`;
- pacchetti workspace `@repo/config`, `@repo/db`, `@repo/rag`, `@repo/ui`;
- prime dipendenze per Next, Workflow SDK, AI SDK, Qdrant, LlamaParse, Drizzle/Neon, shadcn/Radix.

Prima di proseguire l'implementazione, va stabilizzato lo scaffold:

- completare configurazione shadcn senza dipendere dalla CLI se crea problemi con workspace pnpm;
- uniformare ESLint/TypeScript a livello monorepo;
- rimuovere residui generati automaticamente non utili;
- verificare `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## 4. Principi tecnici

1. **File piccoli e responsabilita singola**
   - Componenti UI separati per sezione.
   - Funzioni pure per ACL.
   - Provider RAG separati da route/API.

2. **Domain logic fuori dai componenti**
   - ACL, retrieval, ingestion e provider nel package `@repo/rag`.
   - Schema DB e seed nel package `@repo/db`.
   - Componenti generici nel package `@repo/ui`.

3. **Astrazioni utili per on-prem**
   - Non legare direttamente la logica a Vercel Blob, AI Gateway, Qdrant cloud o LlamaParse cloud.
   - Usare interfacce sostituibili per storage, parser, LLM, embeddings, vector store.

4. **Sicurezza prima della UX**
   - L'ACL deve essere applicata lato server.
   - La UI non deve essere considerata affidabile.
   - La retrieval RAG deve filtrare i chunk prima di chiamare il modello.

5. **V1 funzionante ma non finta**
   - Mock auth va bene.
   - ACL, tagging, ingestion status e references devono essere modellati correttamente fin dall'inizio.

## 5. Architettura monorepo

### 5.1 `apps/web`

Responsabilita:

- UI Next.js;
- route handlers API;
- server actions se utili;
- workflow entrypoint;
- mock auth/session;
- composizione dei package domain.

Struttura prevista:

```txt
apps/web/src
  app/
    page.tsx
    layout.tsx
    globals.css
    api/
      auth/
      chat/
      documents/
      ingestion/
      settings/
    workflows/
      ingest-document.ts
  components/
    app-shell/
    chat/
    documents/
    settings/
    auth/
    layout/
    ui/
  config/
    env.ts
    navigation.ts
  i18n/
    dictionaries/
      en.ts
      it.ts
    locale.ts
  lib/
    auth.ts
    api-client.ts
    errors.ts
    utils.ts
```

### 5.2 `packages/db`

Responsabilita:

- Drizzle schema;
- database client;
- seed iniziali;
- tipi condivisi derivati dallo schema.

Struttura prevista:

```txt
packages/db/src
  client.ts
  schema/
    users.ts
    roles.ts
    tags.ts
    documents.ts
    chunks.ts
    audit.ts
  schema.ts
  seed.ts
  queries/
    documents.ts
    roles.ts
    users.ts
```

### 5.3 `packages/rag`

Responsabilita:

- ACL e filtri;
- ingestion pipeline;
- parser abstraction;
- Qdrant abstraction;
- LLM abstraction;
- retrieval;
- citazioni/references.

Struttura prevista:

```txt
packages/rag/src
  acl/
    policy.ts
    filters.ts
    types.ts
  ingestion/
    ingest-document.ts
    parse-document.ts
    chunk-document.ts
    embed-chunks.ts
  providers/
    llama-parse.ts
    qdrant.ts
    ai-gateway.ts
    storage.ts
  retrieval/
    retrieve.ts
    citations.ts
    prompt.ts
  logging/
    audit.ts
  index.ts
```

### 5.4 `packages/ui`

Responsabilita:

- utility `cn`;
- componenti UI generici eventualmente condivisi;
- wrapper leggeri su shadcn se diventano riutilizzati da piu app.

Per la v1, i componenti molto specifici della web app possono restare in `apps/web/src/components`.

## 6. Modello dati

### 6.1 Tabelle principali

```txt
users
  id
  name
  email
  role_id
  created_at

roles
  id
  name
  is_admin
  created_at

tags
  id
  key
  label
  description
  is_system
  created_at

role_allowed_tags
  role_id
  tag_id

role_denied_tags
  role_id
  tag_id

documents
  id
  title
  original_filename
  mime_type
  size_bytes
  storage_provider
  storage_key
  uploaded_by_user_id
  status
  error_message
  created_at
  updated_at

document_tags
  document_id
  tag_id

document_chunks
  id
  document_id
  chunk_index
  content
  metadata_json
  qdrant_point_id
  created_at

chat_sessions
  id
  user_id
  title
  created_at
  updated_at

chat_messages
  id
  session_id
  role
  content
  references_json
  created_at

audit_events
  id
  user_id
  event_type
  entity_type
  entity_id
  metadata_json
  created_at
```

### 6.2 System tags

Prevederei due tag di sistema:

- `any`: tag pubblico/di default, usabile se un documento non ha una categoria piu specifica;
- `super`: tag riservato/admin, utile per uniformita concettuale ma non necessario per il bypass admin.

Regola upload:

- un documento deve avere almeno un tag;
- se la UI non ne invia nessuno, il backend assegna `any`;
- un utente normale vede `any` solo se il suo ruolo include `any` tra gli allowed tags;
- admin vede tutto tramite `is_admin = true`.

## 7. ACL/RBAC

### 7.1 Regola base

Un documento e visibile a un utente se:

```txt
role.is_admin = true
OR
(
  document.tags INTERSECT role.allowedTags non e vuoto
  AND
  document.tags INTERSECT role.deniedTags e vuoto
)
```

### 7.2 Dove va applicata

La regola va applicata obbligatoriamente in:

1. lista documenti;
2. ricerca documenti;
3. retrieval vettoriale;
4. references/citations restituite in chat;
5. endpoint download/preview file;
6. eventuali API future.

### 7.3 Implementazione tecnica

Nel package `@repo/rag`:

```ts
type RoleAccessPolicy = {
  isAdmin: boolean;
  allowedTagKeys: string[];
  deniedTagKeys: string[];
};

type DocumentAccessMetadata = {
  tagKeys: string[];
};
```

Funzioni pure:

- `canAccessDocument(policy, documentMetadata)`;
- `buildQdrantAclFilter(policy)`;
- `buildDocumentSqlAclFilter(policy)`;

Qdrant payload minimo per ogni point:

```json
{
  "documentId": "...",
  "tagKeys": ["legal", "any"],
  "uploadedByUserId": "...",
  "mimeType": "application/pdf"
}
```

Il filtro Qdrant deve garantire:

- almeno un tag consentito;
- nessun tag vietato;
- bypass solo per admin lato server.

## 8. RAG pipeline

### 8.1 Upload

1. Utente mock autenticato invia file + tag.
2. Backend valida:
   - utente valido;
   - file supportato;
   - tag esistenti;
   - almeno un tag o fallback a `any`;
   - limiti dimensione.
3. File salvato su storage provider.
4. Documento creato in DB con status `uploaded`.
5. Vercel Workflow asincrono avviato.

### 8.2 Ingestion asincrona

Workflow Vercel previsto:

```txt
ingestDocument(documentId)
  step 1: load document metadata
  step 2: fetch file from storage
  step 3: parse with LlamaParse cloud
  step 4: chunk normalized text
  step 5: create embeddings through configured provider
  step 6: upsert vectors into Qdrant
  step 7: persist chunks and Qdrant point IDs
  step 8: mark document ready
```

In caso di errore:

- status `failed`;
- `error_message` valorizzato;
- audit event;
- UI mostra retry.

### 8.3 Vercel Workflows

La v1 deve usare esplicitamente **Vercel Workflows** per l'ingestion asincrona e per le operazioni lunghe/retry collegate ai documenti. L'implementazione usa il package `workflow`, che e il Workflow SDK supportato da Vercel:

- `withWorkflow(nextConfig)` in Next config;
- funzioni con `"use workflow"`;
- step con `"use step"`;
- trigger via route handler o server action usando `start`.
- workflow principale: `ingestDocument(documentId)`;
- step idempotenti per parsing, chunking, embedding, upsert Qdrant e update DB;
- retry/error handling gestiti a livello di workflow e riflessi su `documents.status`.

Pattern previsto nell'app Next:

```txt
apps/web/src/app/workflows/ingest-document.ts
apps/web/src/app/api/documents/route.ts
apps/web/src/app/api/documents/[documentId]/retry-ingestion/route.ts
```

I route handler non devono fare ingestion direttamente: devono validare input, salvare lo stato iniziale e avviare il workflow.

Nota on-prem:

- Workflow SDK gira localmente in sviluppo;
- per produzione non-Vercel va verificato il runtime supportato al momento dell'implementazione;
- la v1 resta comunque progettata intorno a Vercel Workflows;
- la logica di ingestion resta incapsulata, cosi un domani puo essere spostata su BullMQ/Temporal/queue custom senza riscrivere RAG.

## 9. Chat e retrieval

### 9.1 Chat flow

1. UI invia messaggi a `/api/chat`.
2. Server identifica utente mock da cookie/sessione.
3. Server carica policy ruolo.
4. Server esegue retrieval su Qdrant con ACL filter.
5. Server costruisce prompt con contesto e regole di citazione.
6. Server chiama Vercel AI Gateway tramite AI SDK.
7. Risposta streammata al client.
8. References salvate in `chat_messages.references_json`.
9. Audit event opzionale.

### 9.2 Scope di ricerca

La ricerca e concettualmente su tutti i documenti caricati, ma il backend filtra sempre per ACL.

L'utente non deve necessariamente selezionare documenti manualmente nella v1.

### 9.3 References

Ogni risposta dovrebbe includere:

```txt
references:
  - documentId
  - title
  - chunkId
  - quote
  - score
  - pageNumber, se disponibile da LlamaParse
```

La UI deve mostrare:

- citazioni inline o footnotes;
- pannello sources;
- link al documento se l'utente ha accesso.

## 10. UI/UX

### 10.1 Layout principale

Tre sezioni principali:

1. **Chat**
   - stile ChatGPT-like;
   - sidebar conversazioni;
   - area messaggi centrale;
   - composer sticky;
   - streaming;
   - references in risposta.

2. **Documenti**
   - upload documenti;
   - lista documenti;
   - search bar;
   - filtro per tag/status;
   - editor tag;
   - stato ingestion.

3. **Impostazioni**
   - solo admin;
   - gestione tag;
   - gestione ruoli;
   - allowed/denied tags per ruolo;
   - gestione utenti mock.

### 10.2 Componenti previsti

```txt
components/app-shell
  app-shell.tsx
  sidebar.tsx
  topbar.tsx
  nav-item.tsx

components/auth
  user-picker.tsx
  current-user-menu.tsx

components/chat
  chat-panel.tsx
  message-list.tsx
  message-bubble.tsx
  message-composer.tsx
  citation-list.tsx
  source-card.tsx

components/documents
  document-panel.tsx
  document-upload-card.tsx
  document-table.tsx
  document-search.tsx
  document-status-badge.tsx
  tag-picker.tsx

components/settings
  settings-panel.tsx
  tag-settings.tsx
  role-settings.tsx
  user-settings.tsx
  role-tag-matrix.tsx
```

### 10.3 shadcn/ui

Componenti base da includere:

- `button`;
- `card`;
- `input`;
- `textarea`;
- `badge`;
- `separator`;
- `scroll-area`;
- `tabs`;
- `select`;
- `sheet`;
- `table`;
- `dropdown-menu`;
- `avatar`;
- `label`;
- `skeleton`;
- `sonner`.

Se la CLI shadcn continua ad avere problemi con pnpm workspace, creare i componenti manualmente seguendo i template ufficiali e mantenendo la stessa struttura:

```txt
apps/web/src/components/ui/*.tsx
```

## 11. Internazionalizzazione

### 11.1 Requisiti

- UI bilingue IT/EN.
- Default dalla lingua del browser.
- Possibilita di cambiare lingua manualmente in UI.
- Persistenza preferenza in cookie.

### 11.2 Implementazione consigliata

Per la v1 si puo evitare un framework i18n pesante:

```txt
i18n/
  dictionaries/
    en.ts
    it.ts
  locale.ts
  types.ts
```

Se il routing localizzato diventa importante, introdurre `next-intl`.

### 11.3 Lingua fallback

```txt
browser language -> cookie override -> fallback en
```

## 12. API route handlers

Endpoint iniziali:

```txt
POST /api/auth/select-user
GET  /api/auth/me

POST /api/chat
GET  /api/chat/sessions
GET  /api/chat/sessions/:id

GET  /api/documents
POST /api/documents
GET  /api/documents/:id
PATCH /api/documents/:id
POST /api/documents/:id/retry-ingestion

GET  /api/tags
POST /api/tags
PATCH /api/tags/:id

GET  /api/roles
POST /api/roles
PATCH /api/roles/:id

GET  /api/users
POST /api/users
PATCH /api/users/:id
```

Per evitare route enormi:

- route handlers sottili;
- validazione Zod in file separati;
- business logic in `lib/server` o package domain.

## 13. Configurazione ambiente

Variabili previste:

```txt
DATABASE_URL=

QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=documents

LLAMA_CLOUD_API_KEY=

AI_GATEWAY_API_KEY=
AI_GATEWAY_MODEL=

BLOB_READ_WRITE_TOKEN=

APP_DEFAULT_LOCALE=en
APP_ENABLE_MOCK_AUTH=true
```

Provider futura on-prem:

```txt
STORAGE_PROVIDER=vercel-blob|minio|filesystem
LLM_PROVIDER=vercel-gateway|openai-compatible|ollama|vllm
PARSER_PROVIDER=llamaparse-cloud|local
VECTOR_PROVIDER=qdrant
```

## 14. Deployment Vercel

### 14.1 Servizi

- Vercel app per `apps/web`;
- Neon PostgreSQL;
- Qdrant Cloud;
- LlamaParse cloud;
- Vercel Blob;
- Vercel AI Gateway;
- Vercel Workflows tramite `workflow` SDK.

### 14.2 Build settings

Root directory:

```txt
turbo
```

Build command:

```txt
pnpm build
```

Install command:

```txt
pnpm install
```

Output:

```txt
apps/web/.next
```

## 15. Percorso on-prem futuro

Sostituzioni previste:

| Vercel/cloud v1 | On-prem futuro |
| --- | --- |
| Vercel Blob | MinIO o filesystem |
| Vercel AI Gateway | Ollama, vLLM, TGI, provider OpenAI-compatible |
| LlamaParse cloud | LlamaParse self-hosted o parser locale |
| Qdrant Cloud | Qdrant self-hosted |
| Neon | PostgreSQL self-hosted |
| Vercel Workflows via `workflow` SDK | Workflow local runtime, BullMQ, Temporal o queue custom |

La logica deve restare incapsulata in provider sostituibili.

## 16. Test e qualita

### 16.1 Minimo indispensabile

- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm build`;
- test unitari ACL;
- test unitari builder filtro Qdrant;
- test schema/seed dove utile.

### 16.2 Test prioritari

ACL:

- admin vede tutto;
- ruolo con allowed tag vede documento con almeno un tag allowed;
- ruolo con denied tag non vede documento anche se contiene anche allowed tag;
- documento `any` visibile solo a ruoli con `any` allowed;
- documento senza tag non deve esistere dopo validazione.

RAG:

- retrieval passa sempre un filtro ACL;
- references non includono documenti fuori ACL;
- errori ingestion impostano status `failed`.

UI:

- selezione utente mock;
- switching lingua;
- upload con tag obbligatorio/fallback `any`;
- visualizzazione status documento.

## 17. Sequenza di implementazione proposta

### Fase A - Stabilizzazione scaffold

1. Pulire workspace e lockfile.
2. Completare shadcn component base.
3. Allineare ESLint/TS config.
4. Aggiungere README tecnico per `/turbo`.
5. Verificare lint/typecheck/build.

### Fase B - Domain model

1. Implementare schema Drizzle.
2. Implementare seed mock:
   - admin;
   - utenti demo;
   - ruoli demo;
   - tag demo `any`, `super`, `legal`, `finance`, `hr`.
3. Implementare funzioni ACL pure.
4. Aggiungere test ACL.

### Fase C - UI shell

1. App shell ChatGPT-like.
2. Mock user picker.
3. Navigazione Chat/Documenti/Impostazioni.
4. Dizionari IT/EN.
5. Componenti shadcn piccoli.

### Fase D - Documenti

1. API lista documenti con ACL.
2. Upload documenti.
3. Storage abstraction.
4. Tag picker.
5. Stato ingestion.
6. Retry ingestion.

### Fase E - Ingestion

1. Vercel Workflow entrypoint con `workflow` SDK.
2. LlamaParse provider.
3. Chunking.
4. Embedding provider.
5. Qdrant upsert.
6. Persistenza chunks.
7. Error handling e logging.

### Fase F - Chat RAG

1. API `/api/chat` streaming con AI SDK.
2. Retrieval Qdrant con ACL.
3. Prompt con contesto.
4. References/citations.
5. Persistenza conversazioni.
6. UI chat streaming.

### Fase G - Settings admin

1. CRUD tag.
2. CRUD ruoli.
3. Matrice allowed/denied tags.
4. Gestione utenti mock.
5. Guard admin lato server.

## 18. Task delegabili a subagenti

Quando il piano e approvato, si possono delegare task piccoli e paralleli:

1. **UI shadcn**
   - generare componenti UI base mancanti;
   - verificare compatibilita Tailwind v4;
   - mantenere file piccoli.

2. **DB schema**
   - implementare schema Drizzle e seed;
   - validare relazioni many-to-many.

3. **ACL tests**
   - scrivere test unitari completi per policy tag.

4. **Vercel Workflows docs check**
   - verificare API corrente del package `workflow`;
   - confermare modalita local e limiti per runtime non-Vercel;
   - documentare pattern `"use workflow"`, `"use step"` e `start`.

5. **Qdrant filter check**
   - validare struttura payload/filter con SDK attuale.

6. **i18n pass**
   - estrarre stringhe UI;
   - completare dizionari IT/EN.

## 19. Rischi e punti da verificare

1. **Vercel Workflows fuori Vercel**
   - Da verificare bene per produzione on-prem.
   - Mitigazione: ingestion isolata e portabile.

2. **shadcn CLI con pnpm workspace**
   - La CLI puo tentare install locali non compatibili con `workspace:*`.
   - Mitigazione: install dal root e componenti generati/manuali.

3. **LlamaParse output**
   - Va normalizzato bene per citazioni/pagine.
   - Mitigazione: metadata parser standardizzati.

4. **ACL in Qdrant**
   - Il filtro deve essere testato contro array payload.
   - Mitigazione: test unitari e, appena possibile, integration test.

5. **AI Gateway model choice**
   - Modello configurabile via env.
   - Default da scegliere in base a disponibilita e costo.

## 20. Domande residue

1. Vuoi che la lingua di default fallback sia `it` o `en` quando il browser non e riconosciuto?
2. Per i documenti con tag `any`, vuoi che siano visibili a tutti i ruoli standard o solo ai ruoli a cui assegniamo esplicitamente `any`?
3. I tag sono solo ACL o vuoi anche tag descrittivi non-permissioning?
4. La modifica dei tag su un documento gia indicizzato deve reindicizzare Qdrant o basta aggiornare payload/filter metadata?
5. Vuoi conservare il testo estratto completo dei documenti, o solo chunk?
6. Per audit log: basta tracciare upload/chat/retrieval, o vuoi anche settings changes?

## 21. Criteri di accettazione v1

La prima versione e accettabile quando:

- `/turbo` installa con `pnpm install`;
- `pnpm lint`, `pnpm typecheck`, `pnpm build` passano;
- l'utente puo selezionare un utente mock;
- admin vede sezione settings;
- utente normale non vede settings;
- si possono caricare documenti con tag;
- l'ingestion parte asincrona;
- documenti ready vengono indicizzati in Qdrant;
- chat risponde in streaming;
- retrieval rispetta ACL;
- risposte includono references;
- UI e navigabile in IT/EN;
- il codice resta modulare, TypeScript strict, con componenti piccoli.

