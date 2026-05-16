# API Documentation

## Table of Contents
1. [Hooks](#hooks)
2. [Firebase Services](#firebase-services)
3. [Utility Functions](#utility-functions)
4. [Components Props](#component-props)
5. [Type Definitions](#type-definitions)

---

## Hooks

### useLanguage

Custom hook for managing language state and translation function.

**Usage:**
```typescript
import { useLanguage } from '@/hooks'

function MyComponent() {
  const { language, t, toggleLanguage, setLanguage } = useLanguage('ms')
  
  return (
    <div>
      <button onClick={toggleLanguage}>
        {language === 'en' ? 'Switch to Malay' : 'Tukar ke Inggeris'}
      </button>
      <h1>{t('header.title' as any)}</h1>
    </div>
  )
}
```

**Returns:**
```typescript
{
  language: 'en' | 'ms',              // Current language
  t: (key: TranslationKey) => string, // Translation function
  toggleLanguage: () => void,         // Toggle between EN/MS
  setLanguage: (lang: Language) => void, // Set specific language
}
```

---

### useTransactions

Real-time listener for transaction documents from Firestore.

**Usage:**
```typescript
import { useTransactions } from '@/hooks'

function QueueDisplay() {
  const { transactions, loading, error } = useTransactions('PENDING')
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      {transactions.map(tx => (
        <div key={tx.id}>{tx.plateNumber}</div>
      ))}
    </div>
  )
}
```

**Parameters:**
```typescript
status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
```

**Returns:**
```typescript
{
  transactions: Transaction[],  // Array of transactions
  loading: boolean,             // Loading state
  error: string | null,         // Error message if any
}
```

---

### usePriceBooks

Real-time listener for price book data.

**Usage:**
```typescript
import { usePriceBooks } from '@/hooks'

function BrandSelector() {
  const { brands, loading } = usePriceBooks()
  
  if (loading) return <div>Loading...</div>
  
  return (
    <select>
      {brands.map(brand => (
        <option key={brand}>{brand}</option>
      ))}
    </select>
  )
}
```

**Returns:**
```typescript
{
  brands: string[],  // Array of brand names
  loading: boolean,  // Loading state
}
```

---

## Firebase Services

### createTransaction

Create a new transaction (car entry).

**Function Signature:**
```typescript
async function createTransaction(
  plateNumber: string,
  brand: string,
  category: string,
  color: string,
  services: CarService,
  computedPrice: number
): Promise<string>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| plateNumber | string | Vehicle plate number (e.g., "ABC1234") |
| brand | string | Car brand (e.g., "Toyota") |
| category | string | Service category |
| color | string | Car color |
| services | CarService | Service selection {exterior, interior, engine} |
| computedPrice | number | Total price in RM |

**Returns:**
- Promise resolving to transaction ID (string)

**Example:**
```typescript
import { createTransaction } from '@/lib/firebaseService'

const txId = await createTransaction(
  'ABC1234',
  'Toyota',
  'Camry',
  'Black',
  { exterior: true, interior: true, engine: false },
  45
)
```

**Firestore Action:**
- Adds new document to `/transactions` collection
- Sets status to 'PENDING'
- Sets checkInTime to server timestamp

---

### completeTransaction

Mark transaction as completed and record payment.

**Function Signature:**
```typescript
async function completeTransaction(
  transactionId: string,
  paymentMethod: PaymentMethod,
  cashReceived: number,
  computedPrice: number
): Promise<void>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| transactionId | string | Transaction document ID |
| paymentMethod | 'CASH' \| 'ONLINE' | Payment method used |
| cashReceived | number | Amount of cash given by customer |
| computedPrice | number | Original total amount |

**Example:**
```typescript
import { completeTransaction } from '@/lib/firebaseService'

await completeTransaction(
  'transaction_id',
  'CASH',
  150,     // Cash given
  100      // Total price
)
```

**Firestore Action:**
- Updates transaction status to 'COMPLETED'
- Records payment method
- Calculates and stores balance (cashReceived - computedPrice)
- Sets paidTime to server timestamp

---

### listenToTransactions

Real-time listener for transactions filtered by status.

**Function Signature:**
```typescript
function listenToTransactions(
  status: TransactionStatus,
  callback: (transactions: Transaction[]) => void
): Unsubscribe
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| status | 'PENDING' \| 'COMPLETED' \| 'CANCELLED' | Filter by status |
| callback | Function | Callback with updated transactions |

**Returns:**
- Unsubscribe function to stop listening

**Example:**
```typescript
import { listenToTransactions } from '@/lib/firebaseService'

const unsubscribe = listenToTransactions('PENDING', (transactions) => {
  console.log('Pending transactions:', transactions)
})

// Stop listening when component unmounts
unsubscribe()
```

---

### updateDailyStats

Update daily statistics with revenue and car count.

**Function Signature:**
```typescript
async function updateDailyStats(
  paymentMethod: PaymentMethod,
  revenue: number,
  totalCars: number
): Promise<void>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| paymentMethod | 'CASH' \| 'ONLINE' | Payment method for revenue categorization |
| revenue | number | Amount in RM |
| totalCars | number | Total cars processed today |

**Example:**
```typescript
await updateDailyStats('CASH', 100, 25)
```

**Firestore Action:**
- Creates or updates `/daily_stats/{YYYY-MM-DD}` document
- Increments appropriate car level (JUNIOR/MID/SENIOR)
- Increments revenue fields based on payment method
- Calculates total revenue

---

### listenToPriceBooks

Real-time listener for price book brands.

**Function Signature:**
```typescript
function listenToPriceBooks(
  callback: (brands: string[]) => void
): Unsubscribe
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| callback | Function | Callback with brand list |

**Returns:**
- Unsubscribe function

---

### getPriceByBrandCategory

Get price for specific brand and category.

**Function Signature:**
```typescript
async function getPriceByBrandCategory(
  brand: string,
  category: string
): Promise<number>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| brand | string | Car brand |
| category | string | Service category |

**Returns:**
- Promise resolving to price (number) or 0 if not found

---

### getDailyStats

Retrieve daily statistics for a specific date.

**Function Signature:**
```typescript
async function getDailyStats(date: string): Promise<DailyStats | null>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| date | string | Date in YYYY-MM-DD format |

**Returns:**
- Promise resolving to DailyStats object or null

**Example:**
```typescript
const stats = await getDailyStats('2024-01-15')
console.log(stats?.totalRevenue)
```

---

## Utility Functions

### formatCurrency

Format number as currency (RM).

**Function Signature:**
```typescript
function formatCurrency(amount: number, currency = 'RM'): string
```

**Example:**
```typescript
formatCurrency(100)      // "RM 100.00"
formatCurrency(45.5)     // "RM 45.50"
formatCurrency(1200, '$') // "$ 1200.00"
```

---

### formatTime

Format timestamp as relative time (e.g., "5 minutes ago").

**Function Signature:**
```typescript
function formatTime(date: Date | number): string
```

**Example:**
```typescript
formatTime(new Date())           // "Just now"
formatTime(Date.now() - 300000)  // "5m ago"
formatTime(Date.now() - 3600000) // "1h ago"
```

---

### validatePlateNumber

Validate Malaysian plate number format.

**Function Signature:**
```typescript
function validatePlateNumber(plate: string): boolean
```

**Accepted Formats:**
- ABC1234
- ABC 1234
- A1234 (single letter)

**Example:**
```typescript
validatePlateNumber('ABC1234')  // true
validatePlateNumber('ABC 1234') // true
validatePlateNumber('INVALID')  // false
```

---

### formatPlateNumber

Format and uppercase plate number.

**Function Signature:**
```typescript
function formatPlateNumber(plate: string): string
```

**Example:**
```typescript
formatPlateNumber('abc1234')  // "ABC1234"
formatPlateNumber('ABC 1234') // "ABC1234"
```

---

### getCarLevel

Get car service level based on daily count.

**Function Signature:**
```typescript
function getCarLevel(totalCars: number): string
```

**Returns:**
- "JUNIOR" for 0-19 cars
- "MID" for 20-29 cars
- "SENIOR" for 30+ cars

**Example:**
```typescript
getCarLevel(15)  // "JUNIOR"
getCarLevel(25)  // "MID"
getCarLevel(35)  // "SENIOR"
```

---

### fuzzySearch

Fuzzy filter array items by query.

**Function Signature:**
```typescript
function fuzzySearch(
  items: any[],
  query: string,
  keys: string[]
): any[]
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| items | Array | Items to filter |
| query | string | Search query |
| keys | string[] | Object keys to search in |

**Example:**
```typescript
const cars = [
  { plateNumber: 'ABC1234', brand: 'Toyota' },
  { plateNumber: 'XYZ9876', brand: 'Honda' }
]

fuzzySearch(cars, 'ABC', ['plateNumber'])
// Returns: [{ plateNumber: 'ABC1234', brand: 'Toyota' }]
```

---

## Component Props

### Dashboard

Main dashboard component (no props).

```typescript
<Dashboard />
```

---

### CarEntryIntake

Phase 1: Car entry form component.

**Props:**
```typescript
interface CarEntryIntakeProps {
  onTransactionAdded?: (transaction: any) => void
}
```

**Example:**
```typescript
<CarEntryIntake 
  onTransactionAdded={(tx) => console.log('Added:', tx.plateNumber)} 
/>
```

---

### CashierCheckout

Phase 2: Cashier checkout component.

**Props:**
```typescript
interface CashierCheckoutProps {
  pendingTransactions: Transaction[]
  loading: boolean
}
```

**Example:**
```typescript
<CashierCheckout 
  pendingTransactions={transactions}
  loading={isLoading}
/>
```

---

## Type Definitions

### Transaction

```typescript
interface Transaction {
  id: string
  plateNumber: string
  brand: string
  category: string
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
```

### CarService

```typescript
interface CarService {
  exterior: boolean
  interior: boolean
  engine: boolean
}
```

### DailyStats

```typescript
interface DailyStats {
  date: string
  totalCars: number
  juniorCars: number
  midCars: number
  seniorCars: number
  totalCashRevenue: number
  totalOnlineRevenue: number
  totalRevenue: number
}
```

### PaymentMethod

```typescript
type PaymentMethod = 'CASH' | 'ONLINE' | null
```

### TransactionStatus

```typescript
type TransactionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'
```

---

## Error Handling

### Try-Catch Pattern

```typescript
try {
  const txId = await createTransaction(...)
  showToast.success('Transaction created!')
} catch (error) {
  console.error('Error:', error)
  showToast.error('Failed to create transaction')
}
```

### Firebase Errors

Common Firebase errors:

```typescript
error.code === 'permission-denied'    // User not authorized
error.code === 'not-found'            // Document doesn't exist
error.code === 'unavailable'          // Firebase service unavailable
error.code === 'invalid-argument'     // Invalid query parameter
```

---

## Examples

### Complete Car Entry Flow

```typescript
import { createTransaction } from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'

async function handleCarEntry(formData) {
  try {
    const txId = await createTransaction(
      formData.plateNumber,
      formData.brand,
      formData.category,
      formData.color,
      formData.services,
      formData.computedPrice
    )
    
    showToast.success('Car added to queue')
    resetForm()
  } catch (error) {
    showToast.error('Failed to add car')
  }
}
```

### Real-time Queue Display

```typescript
import { useTransactions } from '@/hooks'

function QueueComponent() {
  const { transactions, loading } = useTransactions('PENDING')
  
  return (
    <div>
      {transactions.map(tx => (
        <div key={tx.id}>
          <h3>{tx.plateNumber}</h3>
          <p>{tx.brand} - {formatCurrency(tx.computedPrice)}</p>
        </div>
      ))}
    </div>
  )
}
```

### Payment Processing

```typescript
import { completeTransaction, updateDailyStats } from '@/lib/firebaseService'

async function processPayment(transaction, paymentMethod, cashReceived) {
  await completeTransaction(
    transaction.id,
    paymentMethod,
    cashReceived,
    transaction.computedPrice
  )
  
  await updateDailyStats(
    paymentMethod,
    transaction.computedPrice,
    pendingTransactions.length
  )
  
  showToast.success('Payment processed')
}
```

---

## Best Practices

1. **Always handle errors** - Use try-catch or error callbacks
2. **Show user feedback** - Use toast notifications
3. **Unsubscribe from listeners** - Prevent memory leaks
4. **Validate inputs** - Check data before Firestore operations
5. **Use TypeScript** - Type safety prevents runtime errors
6. **Memoize expensive calculations** - Use useMemo for performance
7. **Optimize real-time listeners** - Use where() to filter data
8. **Handle loading states** - Show loading indicators
9. **Cache when appropriate** - Reduce Firestore read operations
10. **Test thoroughly** - Unit test business logic

---

For more information, refer to:
- [README.md](./README.md)
- [DEVELOPMENT.md](./DEVELOPMENT.md)
- [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md)
