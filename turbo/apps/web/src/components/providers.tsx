"use client";

import NiceModal from "@ebay/nice-modal-react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <NiceModal.Provider>{children}</NiceModal.Provider>;
}
