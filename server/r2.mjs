import crypto from 'node:crypto'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

let client

export function r2Config() {
  return {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET_NAME || '',
    endpoint: process.env.R2_ENDPOINT_URL || '',
    maxFileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024),
    allowedExtensions: String(process.env.ALLOWED_EXTENSIONS || 'pdf,jpg,jpeg,png')
      .split(',')
      .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean),
  }
}

export function isR2Configured() {
  const cfg = r2Config()
  return Boolean(cfg.accessKeyId && cfg.secretAccessKey && cfg.bucket && cfg.endpoint)
}

export function getR2() {
  if (!isR2Configured()) {
    throw new Error('R2 no está configurado. Revisa las variables R2_* en el .env.')
  }
  if (!client) {
    const cfg = r2Config()
    client = new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    })
  }
  return client
}

export function fileExtension(fileName) {
  const ext = String(fileName || '').split('.').pop() || ''
  return ext.toLowerCase()
}

export function isAllowedExtension(fileName) {
  return r2Config().allowedExtensions.includes(fileExtension(fileName))
}

export function sanitizeFileName(name) {
  const cleaned = String(name || 'archivo')
    .replace(/[/\\]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
  return cleaned.slice(0, 180) || 'archivo'
}

export function documentObjectKey(partnerId, category, fileName) {
  const id = crypto.randomUUID()
  return `partners/${partnerId}/${category}/${id}-${sanitizeFileName(fileName)}`
}

export async function uploadToR2({ key, body, contentType, contentLength }) {
  const cfg = r2Config()
  await getR2().send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
      ContentLength: contentLength,
    }),
  )
  return { bucket: cfg.bucket, key }
}

export async function getObjectFromR2(key) {
  if (!key) throw new Error('storage_key vacío')
  const cfg = r2Config()
  const out = await getR2().send(
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
    }),
  )
  const bytes = await out.Body?.transformToByteArray()
  return {
    body: Buffer.from(bytes || []),
    contentType: out.ContentType || 'application/octet-stream',
    contentLength: out.ContentLength || undefined,
  }
}

export async function deleteFromR2(key) {
  if (!key) return
  const cfg = r2Config()
  await getR2().send(
    new DeleteObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
    }),
  )
}
