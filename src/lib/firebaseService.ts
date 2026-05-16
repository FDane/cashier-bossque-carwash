import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  increment,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  Transaction,
  TransactionStatus,
  PaymentMethod,
  DailyStats,
  CarService,
} from '@/types'

const TRANSACTIONS_COLLECTION = 'transactions'
const DAILY_STATS_COLLECTION = 'daily_stats'
const PRICE_BOOK_COLLECTION = 'price_book'

/**
 * Add a new transaction (car entry)
 */
export async function createTransaction(
  plateNumber: string,
  brand: string,
  model: string,
  color: string,
  services: CarService,
  computedPrice: number
): Promise<string> {
  const transactionData = {
    plateNumber: plateNumber.toUpperCase(),
    brand,
    model,
    color,
    services,
    computedPrice,
    status: 'PENDING' as TransactionStatus,
    paymentMethod: null as PaymentMethod,
    cashReceived: 0,
    balance: 0,
    checkInTime: serverTimestamp(),
    paidTime: null,
    notes: '',
  }

  const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), transactionData)
  return docRef.id
}

/**
 * Update transaction to completed (checkout)
 */
export async function completeTransaction(
  transactionId: string,
  paymentMethod: PaymentMethod,
  cashReceived: number,
  computedPrice: number
): Promise<void> {
  const balance = cashReceived - computedPrice
  const transactionRef = doc(db, TRANSACTIONS_COLLECTION, transactionId)

  await updateDoc(transactionRef, {
    status: 'COMPLETED' as TransactionStatus,
    paymentMethod,
    cashReceived,
    balance,
    paidTime: serverTimestamp(),
  })
}

/**
 * Listen to real-time transactions filtered by status
 */
export function listenToTransactions(
  status: TransactionStatus,
  callback: (transactions: Transaction[]) => void
): Unsubscribe {
  const q = query(
    collection(db, TRANSACTIONS_COLLECTION),
    where('status', '==', status)
  )

  return onSnapshot(q, (snapshot) => {
    const transactions: Transaction[] = []
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data()
      transactions.push({
        id: docSnapshot.id,
        plateNumber: data.plateNumber,
        brand: data.brand,
        model: data.model,
        color: data.color,
        services: data.services,
        computedPrice: data.computedPrice,
        status: data.status,
        paymentMethod: data.paymentMethod,
        cashReceived: data.cashReceived,
        balance: data.balance,
        checkInTime: data.checkInTime?.toDate?.() || data.checkInTime,
        paidTime: data.paidTime?.toDate?.() || data.paidTime,
        notes: data.notes || '',
      })
    })
    callback(transactions)
  })
}

/**
 * Update daily stats with revenue and car level
 */
export async function updateDailyStats(
  paymentMethod: PaymentMethod,
  revenue: number,
  totalCars: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const statsRef = doc(db, DAILY_STATS_COLLECTION, today)

  // Determine car level
  let juniorCars = 0,
    midCars = 0,
    seniorCars = 0

  if (totalCars <= 19) juniorCars = 1
  else if (totalCars <= 29) midCars = 1
  else seniorCars = 1

  // Check if document exists
  const docSnapshot = await getDoc(statsRef)

  if (docSnapshot.exists()) {
    // Update existing document
    const revenueField = paymentMethod === 'CASH' ? 'totalCashRevenue' : 'totalOnlineRevenue'
    await updateDoc(statsRef, {
      totalCars: increment(1),
      juniorCars: increment(juniorCars),
      midCars: increment(midCars),
      seniorCars: increment(seniorCars),
      [revenueField]: increment(revenue),
      totalRevenue: increment(revenue),
    })
  } else {
    // Create new document
    const cashRevenue = paymentMethod === 'CASH' ? revenue : 0
    const onlineRevenue = paymentMethod === 'ONLINE' ? revenue : 0

    await setDoc(statsRef, {
      date: today,
      totalCars: 1,
      juniorCars,
      midCars,
      seniorCars,
      totalCashRevenue: cashRevenue,
      totalOnlineRevenue: onlineRevenue,
      totalRevenue: revenue,
    })
  }
}

/**
 * Get price books for dropdown
 */
export function listenToPriceBooks(
  callback: (brands: string[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, PRICE_BOOK_COLLECTION), (snapshot) => {
    const brands = Array.from(new Set(snapshot.docs.map((doc) => doc.data().brand)))
    callback(brands as string[])
  })
}

/**
 * Get price by brand and model
 */
export async function getPriceByBrandModel(
  brand: string,
  model: string
): Promise<number> {
  const q = query(
    collection(db, PRICE_BOOK_COLLECTION),
    where('brand', '==', brand),
    where('model', '==', model)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return 0
  return snapshot.docs[0].data().price || 0
}

/**
 * Get daily stats
 */
export async function getDailyStats(date: string): Promise<DailyStats | null> {
  const docSnapshot = await getDoc(doc(db, DAILY_STATS_COLLECTION, date))
  return docSnapshot.exists() ? (docSnapshot.data() as DailyStats) : null
}
