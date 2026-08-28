import dotenv from 'dotenv'
import pg from 'pg'
import { deleteFromR2, isR2Configured } from '../server/r2.mjs'

dotenv.config()

const EMAIL = String(process.argv[2] || 'support@intercertlatam.com').trim().toLowerCase()

const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  connectionTimeoutMillis: 8000,
})

async function main() {
  const { rows: partners } = await pool.query(
    `SELECT id, email, first_name, last_name FROM partners WHERE lower(email) = $1`,
    [EMAIL],
  )
  if (!partners[0]) {
    console.log(`No hay partner con correo ${EMAIL}`)
    return
  }
  const partnerId = partners[0].id
  console.log(`Reiniciando partner ${partners[0].email} (${partnerId})`)

  const { rows: docs } = await pool.query(
    `SELECT id, storage_key FROM documents WHERE partner_id = $1`,
    [partnerId],
  )
  if (isR2Configured()) {
    for (const doc of docs) {
      if (doc.storage_key) {
        await deleteFromR2(doc.storage_key).catch((err) => {
          console.warn('No se pudo borrar de R2', doc.storage_key, err?.message || err)
        })
      }
    }
  }
  await pool.query(`DELETE FROM documents WHERE partner_id = $1`, [partnerId])
  await pool.query(`DELETE FROM auditor_audits WHERE partner_id = $1`, [partnerId])
  await pool.query(`DELETE FROM partner_notifications WHERE partner_id = $1`, [partnerId])
  await pool.query(`DELETE FROM auditor_requests WHERE partner_id = $1`, [partnerId])
  await pool.query(`DELETE FROM applications WHERE partner_id = $1`, [partnerId])
  await pool.query(
    `UPDATE partner_profiles SET
       submitted_at = NULL,
       review1_status = 'pending',
       review1_submitted_at = NULL,
       review2_status = 'locked',
       review2_submitted_at = NULL,
       contract_downloaded_at = NULL,
       training_completed_at = NULL,
       icf12_downloaded_at = NULL,
       commercial_contract_status = 'pending',
       commercial_contract_submitted_at = NULL,
       whatsapp_group_url = NULL,
       whatsapp_confirmed_at = NULL,
       audit_report_training_at = NULL,
       casa_matriz_downloaded_at = NULL,
       commercial_training_at = NULL,
       current_step = 1,
       data_treatment_accepted = false,
       updated_at = now()
     WHERE partner_id = $1`,
    [partnerId],
  )
  console.log(`Listo: ${docs.length} documento(s) eliminados y progreso reiniciado.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
