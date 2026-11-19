import { GitPullRequest } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Wordmark() {
  return (
    <Link to="/" className="mc-wordmark" aria-label="MergeCourt home">
      <span className="mc-brand-icon"><GitPullRequest size={19} aria-hidden="true" /></span>
      <span>MergeCourt</span>
    </Link>
  )
}
