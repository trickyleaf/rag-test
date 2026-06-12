import { cookies } from "next/headers";

import { getDefaultUserAndRole, getUserById } from "./queries";

export const mockUserCookieName = "mock-user-id";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(mockUserCookieName)?.value;

  if (userId) {
    const result = await getUserById(userId);
    if (result) return result;
  }

  return getDefaultUserAndRole();
}
