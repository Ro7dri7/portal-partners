import { MaterialIcon } from './MaterialIcon'
import { PASSWORD_RULES, type PasswordChecks } from '../utils/passwordValidation'

type PasswordRequirementsProps = {
  checks: PasswordChecks
}

export function PasswordRequirements({ checks }: PasswordRequirementsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 bg-white rounded-lg border border-outline-variant">
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
