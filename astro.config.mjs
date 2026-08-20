import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'

// Tailwind v4 se integra vía @tailwindcss/vite (oficial).
// @astrojs/tailwind queda fuera: solo soporta Tailwind v3 y rompería nuestros tokens MD3.
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
})
