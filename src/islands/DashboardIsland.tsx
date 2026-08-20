import { DashboardLayout } from '../layouts/DashboardLayout'
import { ApplicationStatusPage } from '../views/ApplicationStatusPage'
import { DashboardHome } from '../views/DashboardHome'
import { DocumentsPage } from '../views/DocumentsPage'
import { ProfilePage } from '../views/ProfilePage'
import { SettingsPage } from '../views/SettingsPage'
import { TrainingPage } from '../views/TrainingPage'

const PAGES = {
  home: DashboardHome,
  perfil: ProfilePage,
  documentos: DocumentsPage,
  estado: ApplicationStatusPage,
  capacitacion: TrainingPage,
  configuracion: SettingsPage,
} as const

type DashboardPage = keyof typeof PAGES

export function DashboardIsland({ page }: { page: DashboardPage }) {
  const Page = PAGES[page]
  return (
    <DashboardLayout>
      <Page />
    </DashboardLayout>
  )
}
