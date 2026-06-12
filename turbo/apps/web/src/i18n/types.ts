export type Locale = "en" | "it";

export type Dictionary = {
  app: {
    title: string;
    subtitle: string;
  };
  nav: {
    chat: string;
    documents: string;
    settings: string;
  };
  auth: {
    chooseUser: string;
    currentUser: string;
  };
  chat: {
    title: string;
    empty: string;
    placeholder: string;
    send: string;
    sources: string;
  };
  documents: {
    title: string;
    description: string;
    upload: string;
    search: string;
    status: string;
    tags: string;
  };
  settings: {
    title: string;
    description: string;
    tags: string;
    roles: string;
    users: string;
  };
};
