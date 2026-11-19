import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { AuthGate, AuthOverlay, RecordProvider, RecordScope } from 'deepspace'
import { SCOPE_ID } from '../../../constants'
import { schemas } from '../../../schemas'

export default function ProtectedLayout() {
  return (
    <AuthGate fallback={<SignedOutPanel />}>
      <RecordProvider>
        <RecordScope roomId={SCOPE_ID} schemas={schemas}>
          <Outlet />
        </RecordScope>
      </RecordProvider>
    </AuthGate>
  )
}

function SignedOutPanel() {
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <section className="mc-narrow mc-centered">
      <h1>Sign in to continue</h1>
      <p>Sign in to create or join a code review.</p>
      <div className="mc-actions mc-center-actions">
        <button className="mc-button mc-primary" onClick={() => setShowAuthModal(true)}>Sign in</button>
        <Link className="mc-button" to="/">Back to home</Link>
      </div>
      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </section>
  )
}
