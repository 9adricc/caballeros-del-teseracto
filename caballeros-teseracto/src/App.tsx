import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import MobileContainer from './components/layout/MobileContainer'
import BottomNavBar from './components/layout/BottomNavBar'
import RegisterForm from './components/auth/RegisterForm'
import ArenaPage from './pages/ArenaPage'
import CollectionPage from './pages/CollectionPage'
import MarketPage from './pages/MarketPage'
import ChatPage from './pages/ChatPage'

type Tab = 'arena' | 'collection' | 'market' | 'chat'

function App() {
  const { usuario, loading, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('arena')

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-950">
        <div className="animate-pulse text-center">
          <div className="text-4xl">🏰</div>
          <p className="mt-2 text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!usuario) {
    return <RegisterForm />
  }

  const navItems = [
    { label: 'Arena', active: activeTab === 'arena', onClick: () => setActiveTab('arena') },
    { label: 'Colección', active: activeTab === 'collection', onClick: () => setActiveTab('collection') },
    { label: 'Mercado', active: activeTab === 'market', onClick: () => setActiveTab('market') },
    { label: 'Chat', active: activeTab === 'chat', onClick: () => setActiveTab('chat') },
  ]

  return (
    <MobileContainer>
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-700">
            {usuario.avatar_url ? (
              <img src={usuario.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm">👤</div>
            )}
          </div>
          <div>
            <p className="text-sm font-bold">{usuario.username}</p>
            <p className="text-xs text-yellow-400">🪙 {usuario.monedas}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="rounded bg-red-600 px-3 py-1 text-xs font-bold transition-colors hover:bg-red-500"
        >
          Salir
        </button>
      </div>

      {/* Page content */}
      <div className="flex flex-1 flex-col overflow-y-auto min-h-0">
        {activeTab === 'arena' && <ArenaPage />}
        {activeTab === 'collection' && <CollectionPage />}
        {activeTab === 'market' && <MarketPage />}
        {activeTab === 'chat' && <ChatPage />}
        {/* Spacer del tamaño de la BottomNavBar para que el contenido no quede detrás */}
        <div className="h-16 flex-shrink-0" />
      </div>

      {/* Bottom navigation */}
      <BottomNavBar items={navItems} />
    </MobileContainer>
  )
}

export default App