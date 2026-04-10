import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Home from './pages/Home'
import NewWorkout from './pages/NewWorkout'
import ViewWorkout from './pages/ViewWorkout'
import LiveSession from './pages/LiveSession'
import Profile from './pages/Profile'
import ViewExercise from './pages/ViewExercise'
import Stats from './pages/Stats'
import Leaderboard from './pages/Leaderboard'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null // still loading session
  if (user === null) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/workout/new" element={<ProtectedRoute><NewWorkout /></ProtectedRoute>} />
        <Route path="/workout/:id" element={<ProtectedRoute><ViewWorkout /></ProtectedRoute>} />
        <Route path="/session/:id" element={<ProtectedRoute><LiveSession /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/exercise/:id" element={<ProtectedRoute><ViewExercise /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      </Routes>
    </Router>
  )
}
