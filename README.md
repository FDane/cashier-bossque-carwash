# Bossque Carwash Management Dashboard

A modern, real-time carwash management system built with Next.js, TypeScript, Tailwind CSS, and Firebase Firestore. Designed for touchscreen-friendly workflow with dual-language support (Malay/English).

## Features

### 🚗 Three-Part Workflow

1. **Phase 1: Car Entry Intake**
   - Quick-input panel for floor staff
   - Plate number registration with auto-uppercase
   - Car brand/model selection from dropdown
   - Color selection
   - Service type toggles (Exterior/Interior/Engine)
   - Real-time price calculation
   - One-click queue entry

2. **Phase 2: Cashier Counter Checkout**
   - Real-time PENDING queue with fuzzy search
   - Integrated POS-58 Thermal Printer support for automatic receipts
   - Multi-car batch payment processing
   - Interactive cash calculator with change calculation
   - Automatic daily revenue and statistics tracking

3. **Phase 3: Customer Kiosk Display**
   - Real-time customer-facing status board
   - Visual vehicle identification (Images or Silhouettes)
   - Live itemized pricing and addon display
   - Interactive payment status (Processing -> Confirmed)
   - Synchronized animations with the cashier counter

### 🖨️ Printer Integration
- **ESC/POS Support**: Optimized for 58mm thermal printers.
- **Automatic Printing**: Receipts trigger instantly upon checkout completion.
- **Customizable**: Editable templates for business branding and receipt layout.

### 🌐 Internationalization

- Full support for Malay (default) and English
- Toggle language in header
- All UI strings translated

### 🎨 Premium Design

- Dark mode aesthetic (Zinc/Slate theme)
- Vibrant blue/green accents
- Responsive grid layout (1-3 columns)
- Touchscreen-optimized buttons and inputs
- Smooth animations and transitions
- Real-time status updates

### 📊 Firebase Integration

- Real-time Firestore listeners
- Optimistic UI state management
- Atomic transactions for payment processing
- Daily statistics tracking by car level (JUNIOR/MID/SENIOR)
- Revenue segregation (Cash vs Online)

## Prerequisites

- Node.js 18+ and npm/yarn
- Firebase project with Firestore enabled
- Modern browser with ES2020 support

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cashier-bossque-carwash
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure Firebase**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Set up Firestore Collections**

   Create the following collections in Firebase Firestore:

   **`/transactions`** - Car transaction records
   ```json
   {
     "plateNumber": "ABC1234",
     "brand": "Toyota",
     "category": "Standard",
     "color": "Black",
     "services": {
       "exterior": true,
       "interior": true,
       "engine": false
     },
     "computedPrice": 45,
     "status": "PENDING|COMPLETED",
     "paymentMethod": "CASH|ONLINE|null",
     "cashReceived": 50,
     "balance": 5,
     "checkInTime": "2024-01-15T10:30:00Z",
     "paidTime": "2024-01-15T10:45:00Z"
   }
   ```

   **`/daily_stats/{YYYY-MM-DD}`** - Daily statistics
   ```json
   {
     "date": "2024-01-15",
     "totalCars": 25,
     "juniorCars": 15,
     "midCars": 8,
     "seniorCars": 2,
     "totalCashRevenue": 1200,
     "totalOnlineRevenue": 400,
     "totalRevenue": 1600
   }
   ```

   **`/settings/kiosk_state`** - Kiosk synchronization
   - This document is used to broadcast the current checkout state to the customer display.
   - Fields: `stage`, `transactions`, `totalAmount`, `paymentMethod`, etc.

   **`/price_book`** - Car pricing
   ```json
   {
     "brand": "Toyota",

   **`/price_book`** - Car pricing
   ```json
   {
     "brand": "Toyota",
     "model": "Camry",
     "category": "Standard",
     "price": 45
   }
   ```

5. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main page
│   └── globals.css         # Global styles
├── components/
│   ├── Dashboard.tsx       # Main dashboard layout
│   ├── CarEntryIntake.tsx  # Phase 1 component
│   └── CashierCheckout.tsx # Phase 2 component
├── hooks/
│   ├── useLanguage.ts      # Language toggle hook
│   ├── useTransactions.ts  # Real-time transactions listener
│   └── usePriceBooks.ts    # Price books listener
├── i18n/
│   └── translations.ts     # Translation strings
├── lib/
│   ├── firebase.ts         # Firebase initialization
│   ├── firebaseService.ts  # Firebase operations
│   ├── toast.ts            # Toast notifications
│   └── utils.ts            # Utility functions
└── types/
    └── index.ts            # TypeScript type definitions
```

## Key Components

### CarEntryIntake
- Form for car entry registration
- Real-time price calculation
- Service type selection
- Direct Firestore integration

### CashierCheckout
- Live queue display with fuzzy search
- Payment method selection
- Real-time cash calculator
- Checkout modal with validation

### Dashboard
- Main layout with header
- Language toggle
- Statistics dashboard
- Responsive grid layout

## API & Hooks

### `useLanguage()`
```typescript
const { language, t, toggleLanguage } = useLanguage()
```

### `useTransactions(status)`
```typescript
const { transactions, loading, error } = useTransactions('PENDING')
```

### Firebase Service Functions

```typescript
// Create new transaction
createTransaction(
  plateNumber: string,
  brand: string,
  category: string,
  color: string,
  services: CarService,
  computedPrice: number
): Promise<string>

// Complete transaction (checkout)
completeTransaction(
  transactionId: string,
  paymentMethod: 'CASH' | 'ONLINE',
  cashReceived: number,
  computedPrice: number
): Promise<void>

// Listen to real-time transactions
listenToTransactions(
  status: 'PENDING' | 'COMPLETED',
  callback: (transactions: Transaction[]) => void
): Unsubscribe

// Update daily statistics
updateDailyStats(
  paymentMethod: 'CASH' | 'ONLINE',
  revenue: number,
  totalCars: number
): Promise<void>
```

## Styling

Uses Tailwind CSS with custom configuration:
- Dark theme (zinc-950, zinc-900, zinc-800)
- Color accents: Blue (primary), Green (accent), Red (danger), Amber (warning)
- Responsive breakpoints: sm (640px), md (768px), lg (1024px)
- Custom animations: fadeIn, slideInRight

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Mobile browsers (iOS 15+, Android 10+)

## Performance

- Real-time Firestore listeners (no polling)
- Optimistic UI updates
- Lazy component loading
- Image optimization
- Code splitting with Next.js

## Security

- Environment variables for Firebase config
- Client-side Firebase rules should be configured
- Validate all inputs on client
- Server-side validation recommended

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Docker
```bash
docker build -t bossque-carwash .
docker run -p 3000:3000 bossque-carwash
```

### Traditional Host
```bash
npm run build
npm start
```

## Troubleshooting

### Firebase connection issues
- Verify `.env.local` contains correct credentials
- Check Firestore database rules allow read/write
- Ensure collections exist in Firestore

### Transactions not updating
- Check Firebase real-time listener is active
- Verify Firestore security rules
- Check browser console for errors

### UI elements not responsive
- Clear browser cache
- Verify Tailwind CSS is building correctly
- Check viewport meta tag in layout

## Future Enhancements

- Print receipt functionality
- SMS/Email notifications
- Staff authentication & roles
- Detailed analytics dashboard
- Appointment scheduling
- Vehicle history tracking
- Multi-location support
- Mobile app with React Native

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open a GitHub issue or contact the development team.

---

**Built with ❤️ by Bossque Team**
