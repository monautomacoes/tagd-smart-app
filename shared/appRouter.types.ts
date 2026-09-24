// Este arquivo declara apenas o tipo do roteador do servidor (AppRouter),
// sem importar nenhum código de servidor, para que o Vite possa compilar
// o cliente sem precisar resolver dependências server-side (express, mysql2, etc.)
//
// O tipo real é `typeof appRouter` definido em server/routers.ts
// Aqui usamos `any` como placeholder — o tRPC infere os tipos corretos
// automaticamente em tempo de desenvolvimento via Language Server.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRouter = any;
