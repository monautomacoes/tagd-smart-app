import { trpc } from "@/lib/trpc";
import { COOKIE_NAME } from "@shared/const";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      utils.auth.me.setData(undefined, data as any);
      utils.auth.me.invalidate();
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const login = useCallback(async (password?: string) => {
    const result = await loginMutation.mutateAsync({ password });
    if (result) {
      try {
        if ((result as any).token) {
          sessionStorage.setItem("manus-cookie", `${COOKIE_NAME}=${(result as any).token}`);
        }
      } catch {}
      utils.auth.me.setData(undefined, result as any);
      await utils.auth.me.invalidate();
    }
    return result;
  }, [loginMutation, utils]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      try {
        sessionStorage.removeItem("manus-cookie");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending || loginMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? loginMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    loginMutation.error,
    loginMutation.isPending,
  ]);

  return {
    ...state,
    login,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
