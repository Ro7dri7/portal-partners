import dotenv from 'dotenv'
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { createApi } from './server/app.mjs'

dotenv.config({ override: true })

export default defineConfig({
  output: 'server',
  server: {
    port: 5173,
  },
  // middleware: exporta `handler` para montarlo en Express (server-entry.mjs).
  // standalone NO sirve para custom server: arranca su propio listen() sin nuestra API.
  adapter: node({
    mode: 'middleware',
  }),
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: 'portal-api',
        configureServer(server) {
          server.middlewares.use(createApi())
        },
        configurePreviewServer(server) {
          server.middlewares.use(createApi())
        },
      },
    ],
  },
})
