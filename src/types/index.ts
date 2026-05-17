export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

export type PaymentMethod = 'CASH' | 'ONLINE' | null

export interface CarService {
  exterior: boolean
  interior: boolean
  engine: boolean
}

export interface Transaction {
  id: string
  plateNumber: string
  brand: string
  model: string
  color: string
  services: CarService
  computedPrice: number
  status: TransactionStatus
  paymentMethod: PaymentMethod
  cashReceived: number
  balance: number
  checkInTime: Date | number
  paidTime: Date | number | null
  notes?: string
  addons?: string[]
}

export interface PriceBook {
  id: string
  brand: string
  model: string
  price: number
}

export interface DailyStats {
  date: string
  totalCars: number
  juniorCars: number // 0-19 cars
  midCars: number // 20-29 cars
  seniorCars: number // 30+ cars
  totalCashRevenue: number
  totalOnlineRevenue: number
  totalRevenue: number
}

export interface CarBrand {
  brand: string
  models?: string[]
}

export interface IntakeFormData {
  plateNumber: string
  brand: string
  color: string
  services: CarService
}

export interface CheckoutData {
  paymentMethod: PaymentMethod
  cashReceived: number
  balance: number
}

// Staff & Attendance
export interface Staff {
  id: string
  displayName: string
  role?: 'ADMIN' | 'CASHIER' | 'STAFF'
  email?: string
}

export interface Attendance {
  id: string
  staffId: string
  date: string // YYYY-MM-DD
  checkInTime: Date | number
  checkOutTime?: Date | number | null
  moneyAdvance?: number
}

// Inventory
export interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  lowStockThreshold?: number
}

// Customer
export interface Customer {
  id: string
  name: string
  phone?: string
  plates?: string[]
  createdAt?: Date | number
}
