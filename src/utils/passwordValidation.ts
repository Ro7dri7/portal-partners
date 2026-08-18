export type PasswordChecks = {
  minLength: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  symbol: boolean
}

export const PASSWORD_RULES = [
  { key: 'minLength' as const, label: 'Mínimo 8 caracteres' },
  { key: 'uppercase' as const, label: 'Una letra mayúscula' },
  { key: 'lowercase' as const, label: 'Una letra minúscula' },
  { key: 'number' as const, label: 'Un número' },
  { key: 'symbol' as const, label: 'Un símbolo (!@#$%^&*)' },
]

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*]/.test(password),
  }
}

export function isPasswordValid(password: string): boolean {
  const checks = getPasswordChecks(password)
  return Object.values(checks).every(Boolean)
}
