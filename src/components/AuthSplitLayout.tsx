import type { ReactNode } from 'react'
import { LOGO_URL, REGISTER_HERO_URL } from '../constants'
import { MaterialIcon } from './MaterialIcon'

type AuthSplitLayoutProps = {
  children: ReactNode
}

export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface antialiased">
      <div
        className="relative hidden h-full overflow-hidden bg-surface-container bg-cover bg-center lg:flex lg:w-1/2"
        style={{ backgroundImage: `url('${REGISTER_HERO_URL}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary-container/40 mix-blend-multiply" />
        <div className="relative z-10 flex h-full flex-col justify-end p-8 text-on-primary xl:p-12">
          <div className="mb-4 max-w-lg xl:mb-8">
            <MaterialIcon name="verified_user" className="mb-3 text-4xl text-secondary-container" />
            <h2 className="mb-3 text-headline-lg font-bold tracking-tight xl:text-display-lg">
              Excelencia en Certificación
            </h2>
            <p className="text-body-lg opacity-90">
              Únete a la red de partners de Intercert Latam y gestiona tus procesos de auditoría con
              la máxima eficiencia y seguridad.
            </p>
          </div>
        </div>
      </div>

      <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden bg-surface-container-lowest p-4 sm:p-8 lg:w-1/2">
        <div className="w-full max-w-[520px] animate-fade-in">
          <div className="mb-6 flex justify-center">
            <img alt="Intercert Latam Logo" className="h-10 w-auto object-contain" src={LOGO_URL} />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
