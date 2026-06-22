import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { initAchievements } from './lib/achievements'
import Auth from './pages/Auth'
import Home from './pages/Home'
import AddPlant from './pages/AddPlant'
import PlantDetail from './pages/PlantDetail'
import CareHistory from './pages/CareHistory'
import Wins from './pages/Wins'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) initAchievements(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) initAchievements(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="splash"><div className="splash-logo">🌱</div></div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth"              element={!session ? <Auth />                           : <Navigate to="/" />}     />
        <Route path="/"                  element={session  ? <Home session={session} />          : <Navigate to="/auth" />} />
        <Route path="/add"               element={session  ? <AddPlant />                        : <Navigate to="/auth" />} />
        <Route path="/plant/:id"         element={session  ? <PlantDetail />                     : <Navigate to="/auth" />} />
        <Route path="/plant/:id/history" element={session  ? <CareHistory />                     : <Navigate to="/auth" />} />
        <Route path="/wins"              element={session  ? <Wins />                            : <Navigate to="/auth" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App