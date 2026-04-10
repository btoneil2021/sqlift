import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'

export default function LiveSession() {
  const { id } = useParams();
  return (
    <Layout title={`ACTIVE SESSION: WORKOUT #${id || 'XXXX'}`}>
      <div className="dummy-box live-session-box">
        <p className="data-monospace status-text blink">● SECURE LIVE TRACKING</p>
        <p className="data-monospace">[UI: REPS / WEIGHT INPUTS]</p>
        <Link to="/home" className="btn btn--danger">END SESSION</Link>
      </div>
    </Layout>
  )
}
