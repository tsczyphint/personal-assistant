import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import Home from '@/pages/Home'
import Voice from '@/pages/Voice'
import Calendar from '@/pages/Calendar'
import Activity from '@/pages/Activity'
import Trip from '@/pages/Trip'
import Notes from '@/pages/Notes'
import Login from '@/pages/Login'
import AuthCallback from '@/pages/AuthCallback'
import Layout from '@/components/Layout'
import '@/styles/global.css'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter basename="/personal-assistant">
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route element={session ? <Layout /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<Home />} />
          <Route path="/voice" element={<Voice />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/trip" element={<Trip />} />
          <Route path="/notes" element={<Notes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
