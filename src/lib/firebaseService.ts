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
  deleteDoc,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
} from 'firebase/firestore'
import { db } from './firebase'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import {
  Transaction,
  TransactionStatus,
  PaymentMethod,
  DailyStats,
  CarService,
} from '@/types'
import { getKLDateString } from './utils'

const TRANSACTIONS_COLLECTION = 'transactions'
const DAILY_STATS_COLLECTION = 'daily_stats'
const PRICE_BOOK_COLLECTION = 'price_book'
const CASH_ADJUSTMENTS_COLLECTION = 'cash_adjustments'
const DAILY_SALARIES_COLLECTION = 'daily_salaries'
const storage = getStorage()

function normalizeStorageFileName(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

function getTransactionImagePath(transactionId: string, plateNumber: string) {
  return `transaction_images/${transactionId}_${normalizeStorageFileName(plateNumber)}`
}

export async function uploadImageToFirebase(
  file: File,
  transactionId: string,
  plateNumber: string,
  previousImagePath?: string
): Promise<{ imageUrl: string; imagePath: string }> {
  const imagePath = getTransactionImagePath(transactionId, plateNumber)

  if (previousImagePath && previousImagePath !== imagePath) {
    try {
      await deleteObject(storageRef(storage, previousImagePath))
    } catch {
      // ignore missing or already deleted object
    }
  }

  const uploadRef = storageRef(storage, imagePath)
  await uploadBytes(uploadRef, file, { contentType: file.type })
  const imageUrl = await getDownloadURL(uploadRef)

  return { imageUrl, imagePath }
}

export async function deleteTransactionImage(imagePath: string): Promise<void> {
  try {
    await deleteObject(storageRef(storage, imagePath))
  } catch {
    // ignore if image already deleted or path does not exist
  }
}

/**
 * Add a new transaction (car entry)
 */
export async function createTransaction(
  plateNumber: string,
  brand: string,
  model: string,
  color: string,
  services: CarService,
  computedPrice: number,
  imageUrl?: string,
  imagePath?: string
): Promise<string> {
  const transactionData: any = {
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

  if (imageUrl) transactionData.imageUrl = imageUrl
  if (imagePath) transactionData.imagePath = imagePath

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
  computedPrice: number,
  addons: any[] = [],
  denominations: Record<string, number> = {},
  changeDenominations: Record<string, number> = {}
): Promise<void> {
  const balance = cashReceived - computedPrice
  const transactionRef = doc(db, TRANSACTIONS_COLLECTION, transactionId)

  await updateDoc(transactionRef, {
    status: 'COMPLETED' as TransactionStatus,
    paymentMethod,
    cashReceived,
    balance,
    addons,
    denominations,
    changeDenominations,
    paidTime: serverTimestamp(),
  })
}

/**
 * Delete a transaction (remove from queue)
 */
export async function deleteTransaction(transactionId: string, imagePath?: string | null): Promise<void> {
  const transactionRef = doc(db, TRANSACTIONS_COLLECTION, transactionId)
  const transactionSnapshot = await getDoc(transactionRef)

  const pathToDelete =
    imagePath || (transactionSnapshot.exists() ? (transactionSnapshot.data().imagePath as string | undefined) : undefined)

  if (pathToDelete) {
    await deleteTransactionImage(pathToDelete)
  }

  await deleteDoc(transactionRef)
}

/**
 * Update an existing transaction (edit details)
 */
export async function updateTransaction(
  transactionId: string,
  updates: Partial<Transaction>
): Promise<void> {
  const transactionRef = doc(db, TRANSACTIONS_COLLECTION, transactionId)
  await updateDoc(transactionRef, updates)
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
        addons: data.addons || [],
        imageUrl: data.imageUrl || null,
        imagePath: data.imagePath || null,
        ...(data.denominations && { denominations: data.denominations }),
        changeDenominations: data.changeDenominations || {},
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
  totalCars: number,
  denominations: Record<string, number> = {},
  changeDenominations: Record<string, number> = {}
): Promise<void> {
  const today = getKLDateString()
  const statsRef = doc(db, DAILY_STATS_COLLECTION, today)

  // Determine car level
  let juniorCars = 0,
    midCars = 0,
    seniorCars = 0

  if (totalCars <= 19) juniorCars = totalCars
  else if (totalCars <= 29) midCars = totalCars
  else seniorCars = totalCars

  // Check if document exists
  const docSnapshot = await getDoc(statsRef)

  const denomUpdates: any = {}
  if (paymentMethod === 'CASH') {
    Object.entries(denominations).forEach(([bill, count]) => {
      denomUpdates[`cashCount_${bill}`] = increment(count)
    })
    // Subtract bills given back as change
    Object.entries(changeDenominations).forEach(([bill, count]) => {
      denomUpdates[`cashCount_${bill}`] = increment(-count)
    })
  }

  if (docSnapshot.exists()) {
    // Update existing document
    const revenueField = paymentMethod === 'CASH' ? 'totalCashRevenue' : 'totalOnlineRevenue'
    await updateDoc(statsRef, {
      totalCars: increment(totalCars),
      juniorCars: increment(juniorCars),
      midCars: increment(midCars),
      seniorCars: increment(seniorCars),
      [revenueField]: increment(revenue),
      totalRevenue: increment(revenue),
      ...denomUpdates
    })
  } else {
    // Create new document
    const cashRevenue = paymentMethod === 'CASH' ? revenue : 0
    const onlineRevenue = paymentMethod === 'ONLINE' ? revenue : 0

    const initialDenoms: any = {}
    if (paymentMethod === 'CASH') {
      ;[1, 5, 10, 20, 50, 100].forEach(b => {
        initialDenoms[`cashCount_${b}`] = denominations[b] || 0
      })
    }

    await setDoc(statsRef, {
      date: today,
      totalCars: totalCars,
      juniorCars,
      midCars,
      seniorCars,
      totalCashRevenue: cashRevenue,
      totalOnlineRevenue: onlineRevenue,
      totalRevenue: revenue,
      ...initialDenoms
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
 * Listen to all price book items for management view
 */
export function listenToFullPriceBook(
  callback: (items: any[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, PRICE_BOOK_COLLECTION), (snapshot) => {
    const items: any[] = []
    snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }))
    callback(items)
  })
}

export async function addPriceBookItem(item: { brand: string; model: string; price: number }) {
  return await addDoc(collection(db, PRICE_BOOK_COLLECTION), item)
}

export async function updatePriceBookItem(id: string, updates: Partial<any>) {
  const ref = doc(db, PRICE_BOOK_COLLECTION, id)
  await updateDoc(ref, updates)
}

export async function deletePriceBookItem(id: string) {
  const ref = doc(db, PRICE_BOOK_COLLECTION, id)
  await deleteDoc(ref)
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

// New collections for staff, attendance, inventory, customers
const STAFF_COLLECTION = 'users'
const ATTENDANCE_COLLECTION = 'attendance'
const INVENTORY_COLLECTION = 'inventory'
const CUSTOMERS_COLLECTION = 'customers'

function todayDateString() {
  return getKLDateString()
}

/**
 * Attendance helpers
 */
export async function getAttendancesByDate(date: string) {
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('date', '==', date)
  )
  const snapshot = await getDocs(q)
  const results: any[] = []
  snapshot.forEach((d) => {
    const data = d.data()
    results.push({ id: d.id, ...data })
  })
  return results
}

export async function getStaffList() {
  const snapshot = await getDocs(collection(db, STAFF_COLLECTION))
  const results: any[] = []
  snapshot.forEach((d) => results.push({ id: d.id, ...d.data() }))
  return results
}

export async function getStaffById(staffId: string) {
  const ref = doc(db, STAFF_COLLECTION, staffId)
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function listenToTodayAttendance(callback: (rows: any[]) => void) {
  const today = todayDateString()
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('date', '==', today)
  )
  return onSnapshot(q, (snapshot) => {
    const rows: any[] = []
    snapshot.forEach((d) => rows.push({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
    callback(rows)
  })
}

export async function clockOutAttendance(attendanceId: string): Promise<void> {
  const attendanceRef = doc(db, ATTENDANCE_COLLECTION, attendanceId);
  const attendanceSnap = await getDoc(attendanceRef);

  if (!attendanceSnap.exists()) {
    console.warn(`Attendance record with ID ${attendanceId} not found.`);
    return;
  }

  const attendanceData = attendanceSnap.data();
  const staffId = attendanceData.staffId;
  const date = attendanceData.date; // This is the 'today' string for daily_salaries

  await updateDoc(attendanceRef, { clockOutTime: serverTimestamp() });

  const salaryRef = doc(db, DAILY_SALARIES_COLLECTION, `${staffId}_${date}`);
  await updateDoc(salaryRef, { clockOutTime: serverTimestamp() });
}

export async function clockOutAllToday(): Promise<void> {
  const today = todayDateString()
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('date', '==', today)
  )
  const snapshot = await getDocs(q)
  const updates = snapshot.docs
    .map(d => clockOutAttendance(d.id))

  await Promise.all(updates)
}

/**
 * Records a staff advance, updates cash drawer, attendance, and daily salaries
 */
export async function recordStaffAdvance(
  staffId: string,
  staffName: string,
  amount: number,
  attendanceId: string,
  denominations: Record<string, number> = {}
): Promise<void> {
  const today = todayDateString()

  // 1. Add to cash adjustments (Drawer Expense)
  await addCashAdjustment('EXPENSE', amount, `Staff Advance: ${staffName}`, denominations)

  // 2. Update attendance record
  await addMoneyAdvanceForAttendance(attendanceId, amount)

  // 3. Update Daily Salaries record
  const salaryId = `${staffId}_${today}`
  const salaryRef = doc(db, DAILY_SALARIES_COLLECTION, salaryId)
  await setDoc(salaryRef, { staffId, date: today, advancesDeducted: increment(amount) }, { merge: true })
}

export async function addMoneyAdvanceForAttendance(attendanceId: string, amount: number) {
  const ref = doc(db, ATTENDANCE_COLLECTION, attendanceId)
  await updateDoc(ref, { moneyAdvance: increment(amount) })
}

export async function checkInStaff(staffId: string, imageUrl?: string, imagePath?: string) {
  const today = todayDateString()
  const attendanceData: any = {
    staffId,
    date: today,
    clockInTime: serverTimestamp(),
    clockOutTime: null,
    createdAt: serverTimestamp(),
    moneyAdvance: 0,
  }

  if (imageUrl) attendanceData.imageUrl = imageUrl
  if (imagePath) attendanceData.imagePath = imagePath

  const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), attendanceData)
  return docRef.id
}

/**
 * Inventory helpers
 */
export async function addInventoryItem(item: {
  name: string
  category: string
  quantity: number
  reorderLevel: number
  cost: number
  price: number
  supplier: string
  unit: string
}) {
  const now = new Date().toISOString()
  const docRef = await addDoc(collection(db, INVENTORY_COLLECTION), {
    ...item,
    createdAt: now,
    lastUpdated: now,
  })
  return docRef.id
}

export async function updateInventoryItem(itemId: string, updates: Partial<any>) {
  const ref = doc(db, INVENTORY_COLLECTION, itemId)
  await updateDoc(ref, {
    ...updates,
    lastUpdated: new Date().toISOString()
  })
}

/**
 * Delete an inventory item
 */
export async function deleteInventoryItem(itemId: string): Promise<void> {
  const ref = doc(db, INVENTORY_COLLECTION, itemId)
  await deleteDoc(ref)
}

export async function updateInventoryQuantity(itemId: string, delta: number) {
  const ref = doc(db, INVENTORY_COLLECTION, itemId)
  await updateDoc(ref, {
    quantity: increment(delta),
    lastUpdated: new Date().toISOString()
  })
}

export async function decrementInventoryByOne(itemId: string) {
  return updateInventoryQuantity(itemId, -1)
}

export async function getLowStockItems() {
  const snapshot = await getDocs(collection(db, INVENTORY_COLLECTION))
  const results: any[] = []
  snapshot.forEach((d) => {
    const data = d.data()
    const threshold = data.reorderLevel ?? 3
    if ((data.quantity ?? 0) <= threshold) results.push({ id: d.id, ...data })
  })
  return results
}

export async function getInventoryList() {
  const snapshot = await getDocs(collection(db, INVENTORY_COLLECTION))
  const results: any[] = []
  snapshot.forEach((d) => results.push({ id: d.id, ...d.data() }))
  return results
}

export function listenToInventory(callback: (items: any[]) => void) {
  return onSnapshot(collection(db, INVENTORY_COLLECTION), (snapshot) => {
    const items: any[] = []
    snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }))
    callback(items)
  })
}

export function listenToRetailItems(callback: (items: any[]) => void) {
  const q = query(
    collection(db, INVENTORY_COLLECTION),
    where('category', '==', 'retailItem')
  )
  return onSnapshot(q, (snapshot) => {
    const items: any[] = []
    snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }))
    callback(items)
  })
}

/**
 * Past car search
 */
export async function getTransactionsByPlate(plateNumber: string) {
  const plate = plateNumber.toUpperCase()
  const q = query(
    collection(db, TRANSACTIONS_COLLECTION),
    where('plateNumber', '==', plate)
  )
  const snapshot = await getDocs(q)
  const results: any[] = []
  snapshot.forEach((d) => results.push({ id: d.id, ...d.data() }))
  return results
}

export async function getPastTransactions(
  limitCount: number | undefined,
  plate?: string,
  afterDoc?: any,
  beforeDoc?: any,
  date?: string
) {
  const colRef = collection(db, TRANSACTIONS_COLLECTION)
  // Start with a base query for completed transactions
  let q = query(colRef, where('status', '==', 'COMPLETED'))

  if (plate) {
    // For global plate search, we use a prefix query
    // Firestore requires range filters to be ordered by that same field first
    const searchStr = plate.toUpperCase()
    q = query(
      q,
      where('plateNumber', '>=', searchStr),
      where('plateNumber', '<=', searchStr + '\uf8ff'),
      orderBy('plateNumber')
    )
  } else {
    // Default sorting by time for Date searches or browsing
    q = query(q, orderBy('checkInTime', 'desc'))

    if (date) {
      const start = new Date(`${date}T00:00:00+08:00`)
      const end = new Date(`${date}T23:59:59+08:00`)
      q = query(q, where('checkInTime', '>=', start), where('checkInTime', '<=', end))
    }
  }

  // Apply cursors
  if (afterDoc) q = query(q, startAfter(afterDoc))
  if (beforeDoc) q = query(q, endBefore(beforeDoc))

  // Only apply limit if limitCount is defined
  if (limitCount !== undefined) {
    if (beforeDoc) q = query(q, limitToLast(limitCount))
    else q = query(q, limit(limitCount))
  }

  return await getDocs(q)
}

/**
 * Cash Adjustment helpers (Expenses/Additions)
 */
export async function addCashAdjustment(type: 'EXPENSE' | 'ADDITION', amount: number, reason: string, denominations: Record<string, number> = {}) {
  const today = todayDateString()
  const data = {
    type,
    amount,
    reason,
    denominations,
    date: today,
    timestamp: serverTimestamp(),
  }
  return await addDoc(collection(db, CASH_ADJUSTMENTS_COLLECTION), data)
}

export function listenToTodayAdjustments(callback: (items: any[]) => void): Unsubscribe {
  const today = todayDateString()
  const q = query(
    collection(db, CASH_ADJUSTMENTS_COLLECTION),
    where('date', '==', today),
    orderBy('timestamp', 'desc')
  )
  return onSnapshot(q, (snapshot) => {
    const items: any[] = []
    snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }))
    callback(items)
  })
}

export async function deleteCashAdjustment(id: string) {
  await deleteDoc(doc(db, CASH_ADJUSTMENTS_COLLECTION, id))
}

/**
 * Customer helpers
 */
export async function addCustomer(customer: { name: string; phone?: string; plates?: string[] }) {
  const data: any = {
    name: customer.name,
    phone: customer.phone || null,
    plates: customer.plates ? customer.plates.map(p => p.toUpperCase()) : [],
    createdAt: serverTimestamp(),
  }
  const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), data)
  return docRef.id
}

export async function updateCustomer(customerId: string, updates: { name?: string; phone?: string; plates?: string[] }) {
  const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId)
  const data: any = { ...updates }
  if (updates.plates) data.plates = updates.plates.map(p => p.toUpperCase())
  await updateDoc(customerRef, data)
}

export async function deleteCustomer(customerId: string) {
  await deleteDoc(doc(db, CUSTOMERS_COLLECTION, customerId))
}

export function listenToCustomers(callback: (customers: any[]) => void): Unsubscribe {
  return onSnapshot(collection(db, CUSTOMERS_COLLECTION), (snapshot) => {
    const customers: any[] = []
    snapshot.forEach((d) => customers.push({ id: d.id, ...d.data() }))
    callback(customers)
  })
}

export async function getCustomerByPlate(plate: string) {
  const q = query(collection(db, CUSTOMERS_COLLECTION), where('plates', 'array-contains', plate.toUpperCase()))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const d = snapshot.docs[0]
  return { id: d.id, ...d.data() }
}

export async function getCustomerPastOrdersByPlate(plate: string) {
  return getTransactionsByPlate(plate)
}
