import type { Dictionary } from "../types";

export const it = {
  app: {
    title: "RAG Chat",
    subtitle: "Dialoga con documenti governati da permessi basati su tag.",
  },
  nav: {
    chat: "Chat",
    documents: "Documenti",
    settings: "Impostazioni",
  },
  auth: {
    chooseUser: "Scegli utente",
    currentUser: "Utente corrente",
  },
  chat: {
    title: "Interroga i documenti",
    empty:
      "Fai una domanda. La retrieval viene filtrata dal ruolo dell'utente selezionato.",
    placeholder: "Chiedi qualcosa sui documenti accessibili...",
    send: "Invia",
    sources: "Fonti",
  },
  documents: {
    title: "Documenti",
    description: "Carica, etichetta, cerca e monitora lo stato di ingestion.",
    upload: "Carica documento",
    search: "Cerca documenti",
    status: "Stato",
    tags: "Tag",
  },
  settings: {
    title: "Impostazioni",
    description: "Area admin per tag, ruoli e utenti mock.",
    tags: "Tag",
    roles: "Ruoli",
    users: "Utenti",
  },
} satisfies Dictionary;
