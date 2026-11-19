import { DeepSpaceAuthProvider, useAuth, useAuthUser, signOut } from 'deepspace'
import { Outlet } from 'react-router-dom'
import { Wordmark } from '../../mergecourt/brand'
import { useRoomAction } from '../../mergecourt/client'

export default function AppLayout() {
  return (
    <DeepSpaceAuthProvider>
      <title>MergeCourt</title>
      <meta name="robots" content="noindex" />
      <div className="mc-page">
        <header className="mc-header">
          <div className="mc-container mc-header-inner">
            <Wordmark />
            <Account />
          </div>
        </header>
        <main className="mc-container">
          <Outlet />
        </main>
      </div>
    </DeepSpaceAuthProvider>
  )
}

function Account() {
  const { isSignedIn } = useAuth()
  const { user } = useAuthUser()
  const { pending, error, run } = useRoomAction()

  if (!isSignedIn) return null
  return (
    <div className="mc-account">
      <span>{user?.fullName}</span>
      <button className="mc-button mc-small" disabled={pending} onClick={() => void run(() => signOut())}>Sign out</button>
      {error && <p className="mc-error" role="alert">{error}</p>}
    </div>
  )
}
