import { cookies } from "next/headers";

import { getDemoRole, getDemoUser } from "./demo-data";

export const mockUserCookieName = "mock-user-id";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const user = getDemoUser(cookieStore.get(mockUserCookieName)?.value);
  const role = getDemoRole(user.roleId);

  return {
    user,
    role,
  };
}
