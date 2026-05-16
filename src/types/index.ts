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
