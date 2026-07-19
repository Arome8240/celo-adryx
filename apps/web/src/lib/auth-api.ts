import { request } from "./api-client";
import type { AuthUser } from "./auth-store";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  nonce: () => request<{ nonce: string }>("/auth/nonce"),

  verify: (message: string, signature: string) =>
    request<{ user: AuthUser } & AuthTokens>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ message, signature }),
    }),

  logout: (refreshToken: string) =>
    request<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  me: () => request<AuthUser>("/auth/me"),

  updateProfile: (input: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  }) =>
    request<AuthUser>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};
