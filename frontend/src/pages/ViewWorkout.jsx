import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'

export default function ViewWorkout() {
  const { id } = useParams();
  return (
    <Layout title={`WORKOUT #${id || 'PREVIEW'}`}>
      <div className="dummy-box">
        <p className="data-monospace">[DATA: WORKOUT EXERCISES LIST]</p>
        <Link to={`/session/${id || 'active'}`} className="btn btn--accent">START SESSION</Link>
      </div>
    </Layout>
  )
}
