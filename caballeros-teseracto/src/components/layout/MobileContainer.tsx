import type { ReactNode } from 'react'

export default function MobileContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-screen max-w-md flex-col bg-gray-950 text-white shadow-2xl">
      {children}
    </div>
  )
}