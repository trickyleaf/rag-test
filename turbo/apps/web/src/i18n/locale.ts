import { cookies, headers } from "next/headers";

import { en } from "./dictionaries/en";
import { it } from "./dictionaries/it";
import type { Dictionary, Locale } from "./types";

const dictionaries = {
  en,
  it,
} satisfies Record<Locale, Dictionary>;

export const supportedLocales = ["en", "it"] as const;

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = parseLocale(cookieStore.get("locale")?.value);

  if (cookieLocale) {
    return cookieLocale;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");

  return parseLocale(acceptLanguage) ?? "en";
}

export async function getDictionary() {
  return dictionaries[await getLocale()];
}

function parseLocale(value: string | null | undefined): Locale | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();

  if (normalized.startsWith("it")) {
    return "it";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  return null;
}
