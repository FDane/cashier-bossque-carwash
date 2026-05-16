import { useState, useEffect } from 'react'
import { listenToPriceBooks } from '@/lib/firebaseService'

export function usePriceBooks() {
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = listenToPriceBooks((data) => {
      setBrands(data)
      setLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return { brands, loading }
}
