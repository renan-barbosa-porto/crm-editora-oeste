import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

import Index from '@/pages/Index'
import Leads from '@/pages/Leads'
import LeadDetail from '@/pages/LeadDetail'
import Contacts from '@/pages/Contacts'
import ContactDetail from '@/pages/ContactDetail'
import Quotes from '@/pages/Quotes'
import QuoteDetail from '@/pages/QuoteDetail'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />

          {/* Rotas Protegidas envolvidas por ProtectedRoute e Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/leads/:id" element={<LeadDetail />} />
              <Route path="/contatos" element={<Contacts />} />
              <Route path="/contatos/:id" element={<ContactDetail />} />
              <Route path="/orcamentos" element={<Quotes />} />
              <Route path="/orcamentos/:id" element={<QuoteDetail />} />
            </Route>
          </Route>

          {/* Rota 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
