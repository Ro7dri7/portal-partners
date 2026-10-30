import dotenv from 'dotenv'
import express from 'express'
import { handler as ssrHandler } from './dist/server/entry.mjs'
import { createApi } from './server/app.mjs'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 5173)
const host = process.env.HOST || '0.0.0.0'

// 1. Montar la API de Express PRIMERO (rutas /api)
app.use(createApi())

// 2. Servir los archivos estáticos generados por Astro (CSS, JS del cliente, imágenes)
app.use(express.static('dist/client/'))

// 3. Montar el SSR de Astro para las páginas (el frontend) AL FINAL
app.use(ssrHandler)

app.listen(port, host, () => {
  console.log(`Servidor de produccion (API + SSR) listo en http://${host}:${port}`)
})
