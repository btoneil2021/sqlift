import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'

export default function ViewExercise() {
  const { id } = useParams();
  return (
    <Layout title={`EXERCISE DETAIL #${id || 'ID'}`}>
      <div className="dummy-box">
        <p className="data-monospace">[MEDIA: INSTRUCTIONAL VIDEO]</p>
        <p className="data-monospace">[TEXT: MUSCLE GROUP / EQUIPMENT]</p>
      </div>
    </Layout>
  )
}
