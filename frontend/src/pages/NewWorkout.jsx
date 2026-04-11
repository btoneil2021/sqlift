import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

export default function NewWorkout() {
  return (
    <Layout title="CREATE WORKOUT">
      <div className="dummy-box">
        <p className="data-monospace">[FORM: NEW WORKOUT DEFINITION]</p>
        <Link to="/home" className="btn btn--primary">SAVE WORKOUT</Link>
      </div>
    </Layout>
  )
}
