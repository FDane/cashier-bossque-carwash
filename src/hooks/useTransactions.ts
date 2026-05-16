import { useState, useEffect } from 'react'
import { Transaction, TransactionStatus } from '@/types'
import { listenToTransactions } from '@/lib/firebaseService'

export function useTransactions(status: TransactionStatus) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const unsubscribe = listenToTransactions(status, (data) => {
      setTransactions(data)
      setLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [status])

  return { transactions, loading, error }
}
