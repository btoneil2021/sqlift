import Layout from '../components/Layout'

export default function Leaderboard() {
  return (
    <Layout title="GLOBAL LEADERBOARD">
      <div className="dummy-box">
        <ul className="dummy-list">
          <li>1. O'NeilBShettyS - <span className="text-success">Level 99</span></li>
          <li>2. Sudaiv - <span className="text-accent">Level 50</span></li>
          <li>3. Shaad - <span className="text-muted">Level 20</span></li>
        </ul>
      </div>
    </Layout>
  )
}
