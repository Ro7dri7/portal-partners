import { MaterialIcon } from './MaterialIcon'
import { PASSWORD_RULES, type PasswordChecks } from '../utils/passwordValidation'

type PasswordRequirementsProps = {
  checks: PasswordChecks
}

export function PasswordRequirements({ checks }: PasswordRequirementsProps) {
  return (
    <div className="animate-password-hints grid grid-cols-2 gap-1.5 rounded-lg border border-outline-variant bg-white p-3">
      {PASSWORD_RULES.map((rule) => {
        const ok = checks[rule.key]
        return (
          <div
            key={rule.key}
            className={`flex items-center gap-1.5 text-[11px] leading-4 ${
              ok ? 'text-success' : 'text-outline'
            }`}
          >
            <MaterialIcon
              name={ok ? 'check_circle' : 'radio_button_unchecked'}
              filled={ok}
              className="text-[14px]"
            />
            <span>{rule.label}</span>
          </div>
        )
      })}
    </div>
  )
}
