import { Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ApplicationStatusPage } from './pages/ApplicationStatusPage'
import { DashboardHome } from './pages/DashboardHome'
import { DocumentsPage } from './pages/DocumentsPage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage, ProfilePage } from './pages/PlaceholderPages'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="documentos" element={<DocumentsPage />} />
        <Route path="estado" element={<ApplicationStatusPage />} />
        <Route
          path="configuracion"
          element={
            <PlaceholderPage
              title="Configuración"
              description="Ajusta las preferencias de tu cuenta de partner."
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
