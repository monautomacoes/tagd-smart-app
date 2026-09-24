import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@shared/appRouter.types";

export const trpc = createTRPCReact<AppRouter>();
