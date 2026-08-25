import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useOutletContext } from '../app-router'
import {
  changePassword,
  fetchProfile,
  saveAccountContact,
  sendEmailVerification,
  updateAvatar,
  verifyEmailCode,
} from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import { PasswordRequirements } from '../components/PasswordRequirements'
import { SearchSelect } from '../components/SearchSelect'
import { AVATAR_URL, saveUser, type PartnerUser } from '../constants'
import { COUNTRY_OPTIONS } from '../data/locations'
import { getPasswordChecks, isPasswordValid } from '../utils/passwordValidation'

type DashboardContext = {
  user: PartnerUser
  setUser: (user: PartnerUser) => void
}

const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-body-md text-on-surface outline-none transition-colors placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary'

async function fileToAvatarDataUrl(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecciona una imagen JPG, PNG o WEBP.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen no puede superar 5 MB.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      img.src = objectUrl
    })
    const max = 400
    const scale = Math.min(1, max / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo procesar la imagen.')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function SettingsPage() {
  const { user, setUser } = useOutletContext<DashboardContext>()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarError, setAvatarError] = useState('')
  const [avatarOk, setAvatarOk] = useState('')
  const [savingAvatar, setSavingAvatar] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordOk, setPasswordOk] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [code, setCode] = useState('')
  const [previewCode, setPreviewCode] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailOk, setEmailOk] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const [documentId, setDocumentId] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [contactError, setContactError] = useState('')
  const [contactOk, setContactOk] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  const checks = useMemo(() => getPasswordChecks(newPassword), [newPassword])
  const passwordReady = isPasswordValid(newPassword)

  useEffect(() => {
    fetchProfile()
      .then((data) => {
        setDocumentId(data.profile.documentId || '')
        setPhone(data.profile.phone || '')
        setCountry(data.profile.country || '')
      })
      .catch(() => {})
  }, [])

  async function handleContactSubmit(event: FormEvent) {
    event.preventDefault()
    setContactError('')
    setContactOk('')
    setSavingContact(true)
    try {
      const result = await saveAccountContact({
        documentId: documentId.trim(),
        phone: phone.trim(),
        country: country.trim(),
      })
      setDocumentId(result.profile.documentId || '')
      setPhone(result.profile.phone || '')
      setCountry(result.profile.country || '')
      setContactOk('Datos de contacto actualizados.')
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'No se pudieron guardar los datos.')
    } finally {
      setSavingContact(false)
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarError('')
    setAvatarOk('')
    setSavingAvatar(true)
    try {
      const image = await fileToAvatarDataUrl(file)
      const result = await updateAvatar(image)
      saveUser(result.user)
      setUser(result.user)
      setAvatarOk('Foto de perfil actualizada.')
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'No se pudo guardar la foto.')
    } finally {
      setSavingAvatar(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault()
    setPasswordError('')
    setPasswordOk('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Completa todos los campos de contraseña.')
      return
    }
    if (!passwordReady) {
      setPasswordError('La nueva contraseña no cumple los requisitos de seguridad.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordOk('Contraseña actualizada.')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleSendCode() {
    setEmailError('')
    setEmailOk('')
    setSendingCode(true)
    try {
      const result = await sendEmailVerification()
      setPreviewCode(result.previewCode || '')
      setEmailOk('Enviamos un código de verificación a tu correo.')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'No se pudo enviar el código.')
    } finally {
      setSendingCode(false)
    }
  }

  async function handleVerifyEmail(event: FormEvent) {
    event.preventDefault()
    setEmailError('')
    setEmailOk('')
    if (!code.trim()) {
      setEmailError('Ingresa el código de 6 dígitos.')
      return
    }
    setVerifying(true)
    try {
      const result = await verifyEmailCode(code.trim())
      saveUser(result.user)
      setUser(result.user)
      setCode('')
      setPreviewCode('')
      setEmailOk('Correo verificado.')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'No se pudo verificar el correo.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="mx-auto max-w-container-max">
      <header className="mb-5">
        <h2 className="text-headline-md font-bold text-primary">Configuración</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Actualiza tu foto, datos de contacto, verifica tu correo y cambia tu contraseña.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-level-1">
          <h3 className="mb-4 text-headline-sm font-semibold text-primary">Foto de perfil</h3>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-outline-variant bg-surface-container-high">
              <img
                alt="Foto de perfil"
                className="h-full w-full object-cover"
                src={user.avatarUrl || AVATAR_URL}
              />
            </div>
            <div>
              <p className="text-body-md font-semibold text-on-surface">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-label-md text-on-surface-variant">{user.email}</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <button
                type="button"
                disabled={savingAvatar}
                onClick={() => fileRef.current?.click()}
                className="mt-3 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {savingAvatar ? 'Guardando...' : 'Cambiar foto'}
              </button>
            </div>
          </div>
          {avatarError && <p className="mt-3 text-label-md text-error">{avatarError}</p>}
          {avatarOk && <p className="mt-3 text-label-md text-success">{avatarOk}</p>}
        </section>

        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-level-1">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-headline-sm font-semibold text-primary">Verificar correo</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-sm font-semibold ${
                user.emailVerified
                  ? 'bg-secondary-container/30 text-secondary'
                  : 'border border-warning-border bg-warning-bg text-warning'
              }`}
            >
              <MaterialIcon
                name={user.emailVerified ? 'verified' : 'mark_email_unread'}
                className="text-[16px]"
              />
              {user.emailVerified ? 'Verificado' : 'Pendiente'}
            </span>
          </div>
          <p className="mb-3 text-body-md text-on-surface-variant">{user.email}</p>
          {user.emailVerified ? (
            <p className="text-body-md text-on-surface-variant">
              Tu correo ya está verificado.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={handleVerifyEmail}>
              <button
                type="button"
                disabled={sendingCode}
                onClick={() => void handleSendCode()}
                className="rounded-lg border border-outline-variant px-4 py-2 text-label-md font-semibold text-primary hover:bg-surface-container-low disabled:opacity-50"
              >
                {sendingCode ? 'Enviando...' : 'Enviar código'}
              </button>
              {previewCode && (
                <p className="rounded-lg bg-warning-bg px-3 py-2 text-label-md text-warning">
                  Entorno local: tu código es <span className="font-bold tracking-widest">{previewCode}</span>
                </p>
              )}
              <div>
                <label className="mb-1 block text-label-md font-semibold text-on-surface" htmlFor="verify-code">
                  Código de 6 dígitos
                </label>
                <input
                  id="verify-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className={inputClass}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {verifying ? 'Verificando...' : 'Verificar correo'}
              </button>
            </form>
          )}
          {emailError && <p className="mt-3 text-label-md text-error">{emailError}</p>}
          {emailOk && <p className="mt-3 text-label-md text-success">{emailOk}</p>}
        </section>

        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-level-1 lg:col-span-2">
          <h3 className="mb-4 text-headline-sm font-semibold text-primary">Datos de contacto</h3>
          <form className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3" onSubmit={handleContactSubmit}>
            <div>
              <label className="mb-1 block text-label-md font-semibold text-on-surface" htmlFor="document-id">
                DNI / Documento
              </label>
              <input
                id="document-id"
                className={inputClass}
                placeholder="Ej. 12345678"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-label-md font-semibold text-on-surface" htmlFor="phone">
                Número de teléfono
              </label>
              <input
                id="phone"
                type="tel"
                className={inputClass}
                placeholder="Ej. +51 999 999 999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-label-md font-semibold text-on-surface" htmlFor="country">
                País de origen
              </label>
              <SearchSelect
                id="country"
                value={country}
                options={COUNTRY_OPTIONS}
                placeholder="Selecciona un país"
                onChange={setCountry}
              />
            </div>
            {contactError && (
              <p className="text-label-md text-error sm:col-span-3">{contactError}</p>
            )}
            {contactOk && (
              <p className="text-label-md text-success sm:col-span-3">{contactOk}</p>
            )}
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={savingContact}
                className="rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {savingContact ? 'Guardando...' : 'Guardar datos'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-level-1 lg:col-span-2">
          <h3 className="mb-4 text-headline-sm font-semibold text-primary">Cambiar contraseña</h3>
          <form className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handlePasswordSubmit}>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-label-md font-semibold text-on-surface" htmlFor="current-password">
                Contraseña actual
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrent ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 text-outline hover:text-on-surface-variant"
                  onClick={() => setShowCurrent((value) => !value)}
                  aria-label={showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <MaterialIcon name={showCurrent ? 'visibility' : 'visibility_off'} className="text-[20px]" />
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-label-md font-semibold text-on-surface" htmlFor="new-password">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 text-outline hover:text-on-surface-variant"
                  onClick={() => setShowNew((value) => !value)}
                  aria-label={showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <MaterialIcon name={showNew ? 'visibility' : 'visibility_off'} className="text-[20px]" />
                </button>
              </div>
              {newPassword.length > 0 && <PasswordRequirements checks={checks} />}
            </div>
            <div>
              <label className="mb-1 block text-label-md font-semibold text-on-surface" htmlFor="confirm-password">
                Confirmar nueva contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {passwordError && (
              <p className="text-label-md text-error sm:col-span-2">{passwordError}</p>
            )}
            {passwordOk && (
              <p className="text-label-md text-success sm:col-span-2">{passwordOk}</p>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {savingPassword ? 'Guardando...' : 'Actualizar contraseña'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
