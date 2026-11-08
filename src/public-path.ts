/// <reference types="vite/client" />

export function publicPath(path: string, base = import.meta.env.BASE_URL): string {
  return path.startsWith('/') ? base + path.slice(1) : path;
}
