import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Home from './pages/Home'
import AddPlant from './pages/AddPlant'
import PlantDetail from './pages/PlantDetail'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-logo">🌱</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Home session={session} /> : <Navigate to="/auth" />} />
        <Route path="/add" element={session ? <AddPlant /> : <Navigate to="/auth" />} />
        <Route path="/plant/:id" element={session ? <PlantDetail /> : <Navigate to="/auth" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App