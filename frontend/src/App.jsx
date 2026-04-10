import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'
import Landing from './pages/Landing'
import Home from './pages/Home'
import NewWorkout from './pages/NewWorkout'
import ViewWorkout from './pages/ViewWorkout'
import LiveSession from './pages/LiveSession'
import Profile from './pages/Profile'
import ViewExercise from './pages/ViewExercise'
import Stats from './pages/Stats'
import Leaderboard from './pages/Leaderboard'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={<Home />} />
        <Route path="/workout/new" element={<NewWorkout />} />
        <Route path="/workout/:id" element={<ViewWorkout />} />
        <Route path="/session/:id" element={<LiveSession />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/exercise/:id" element={<ViewExercise />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </Router>
  )
}

