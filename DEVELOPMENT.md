# Development Guide

## Getting Started

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Firebase account ([Sign up free](https://firebase.google.com/))
- Git
- Visual Studio Code (recommended)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cashier-bossque-carwash
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup Firebase**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your Firebase credentials:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=<your-key>
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-domain>
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-project>
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-bucket>
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
   NEXT_PUBLIC_FIREBASE_APP_ID=<your-app-id>
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000)

---

## Development Workflow

### Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/
│   ├── Dashboard.tsx      # Main dashboard
│   ├── CarEntryIntake.tsx # Phase 1
│   └── CashierCheckout.tsx # Phase 2
├── hooks/
│   ├── useLanguage.ts
│   ├── useTransactions.ts
│   └── usePriceBooks.ts
├── i18n/
│   └── translations.ts
├── lib/
│   ├── firebase.ts
│   ├── firebaseService.ts
│   ├── toast.ts
│   └── utils.ts
└── types/
    └── index.ts           # Type definitions
```

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Use Prettier (auto-format on save)
- **Linting**: ESLint configured (run `npm run lint`)
- **Components**: Functional components with hooks

### Adding New Features

#### 1. Add Type Definition
```typescript
// src/types/index.ts
export interface NewFeature {
  id: string
  name: string
  // ...
}
```

#### 2. Create Component
```typescript
// src/components/NewComponent.tsx
'use client'

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'

export default function NewComponent() {
  const { t } = useLanguage()
  
  return (
    <div>
      {t('key' as any)}
    </div>
  )
}
```

#### 3. Add Translations
```typescript
// src/i18n/translations.ts
export const translations = {
  en: {
    'key': 'English text',
  },
  ms: {
    'key': 'Teks Melayu',
  }
}
```

#### 4. Create Service
```typescript
// src/lib/newService.ts
import { db } from './firebase'
import { collection, addDoc } from 'firebase/firestore'

export async function createNewItem(data: NewFeature) {
  const docRef = await addDoc(collection(db, 'collection_name'), data)
  return docRef.id
}
```

#### 5. Use Hook
```typescript
import { useTransactions } from '@/hooks/useTransactions'

const { transactions } = useTransactions('PENDING')
```

---

## Testing

### Manual Testing

1. **Test Car Entry Intake**
   - Enter plate number: `ABC1234`
   - Select brand: `Toyota`
   - Select color: `Black`
   - Select services (at least one)
   - Click "Masuk Queue"
   - Verify transaction appears in queue

2. **Test Cashier Checkout**
   - Search by plate number
   - Click car card
   - Select payment method
   - For CASH: Enter amount
   - Click checkout
   - Verify balance calculation

3. **Test Language Toggle**
   - Click language button in header
   - Verify all text changes

4. **Test Real-time Updates**
   - Open app in two tabs
   - Add car in first tab
   - Verify it appears in second tab

### Debugging

**Enable verbose logging:**
```typescript
// src/lib/firebaseService.ts
console.log('Transaction created:', docRef.id)
```

**Check Firebase connection:**
```bash
# In browser console
firebase.firestore().collection('transactions').get()
```

**Monitor Firestore:**
- Open Firebase Console
- Select your project
- Go to Firestore Database
- Watch real-time changes

---

## Common Issues & Solutions

### Issue: Firebase not connecting
**Solution:**
```bash
# Verify environment variables
echo $NEXT_PUBLIC_FIREBASE_PROJECT_ID

# Restart dev server
npm run dev
```

### Issue: Transactions not updating in real-time
**Solution:**
- Check Firestore security rules
- Verify collection name matches: `/transactions`
- Check browser console for errors
- Ensure listener is not unsubscribing

### Issue: Styles not applying
**Solution:**
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### Issue: TypeScript errors
**Solution:**
```bash
npm run type-check
# Fix errors shown in output
```

---

## Performance Tips

### 1. Optimize Real-time Listeners
```typescript
// Good: Listen to specific status only
const q = query(collection(db, 'transactions'), 
  where('status', '==', 'PENDING'))

// Avoid: Listening to all transactions
onSnapshot(collection(db, 'transactions'), ...)
```

### 2. Batch Operations
```typescript
// Multiple writes
const batch = writeBatch(db)
batch.update(ref1, data1)
batch.update(ref2, data2)
await batch.commit()
```

### 3. Use Pagination
```typescript
// Limit initial load
const q = query(collection(db, 'transactions'), 
  limit(50),
  orderBy('checkInTime', 'desc'))
```

### 4. Memoize Callbacks
```typescript
const filteredItems = useMemo(() => {
  return items.filter(item => item.status === 'PENDING')
}, [items])
```

---

## Deployment

### Local Testing
```bash
npm run build
npm start
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Deploy with Docker
```bash
# Build image
docker build -t bossque-carwash .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_FIREBASE_API_KEY=... \
  bossque-carwash
```

### Environment Variables for Production
- Set all `NEXT_PUBLIC_*` variables in deployment platform
- Use secrets manager for sensitive data (if any)

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm start               # Start production server

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # Check TypeScript

# Package Management
npm install             # Install dependencies
npm update              # Update dependencies
npm audit               # Check security issues
npm audit fix           # Fix security issues

# Formatting (if Prettier installed)
npx prettier --write .  # Format all files
```

---

## Browser DevTools

### React DevTools
Install from Chrome Web Store for component inspection.

### Firebase DevTools
Debug Firebase operations in console:
```javascript
// Check Firestore connection
db.collection('transactions').get()
  .then(snap => console.log(snap.size))

// Monitor listener
const unsubscribe = db.collection('transactions')
  .where('status', '==', 'PENDING')
  .onSnapshot(snap => console.log('Updated:', snap.docs.length))
```

### Network Tab
Monitor Firebase API calls:
- Search for `firestore`
- Check request/response payloads
- Verify status codes (200 = success)

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
git add .
git commit -m "Add new feature"

# Push to remote
git push origin feature/new-feature

# Create Pull Request on GitHub
```

### Commit Message Format
```
<type>: <subject>

<body>

<footer>
```

Examples:
```
feat: Add payment confirmation modal
fix: Fix real-time listener memory leak
docs: Update Firebase setup guide
style: Format code with Prettier
refactor: Simplify cart calculation logic
```

---

## API Reference

### Core Hooks

**useLanguage()**
```typescript
const { language, t, toggleLanguage, setLanguage } = useLanguage('ms')
```

**useTransactions(status)**
```typescript
const { transactions, loading, error } = useTransactions('PENDING')
```

**usePriceBooks()**
```typescript
const { brands, loading } = usePriceBooks()
```

### Firebase Service Functions

See [src/lib/firebaseService.ts](../src/lib/firebaseService.ts) for complete API.

### Utility Functions

- `formatCurrency(amount)` - Format to RM currency
- `formatTime(date)` - Format timestamp
- `validatePlateNumber(plate)` - Validate plate format
- `formatPlateNumber(plate)` - Format and uppercase
- `getCarLevel(totalCars)` - Get car level (JUNIOR/MID/SENIOR)
- `fuzzySearch(items, query, keys)` - Fuzzy filter

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Firebase Firestore Guide](https://firebase.google.com/docs/firestore)
- [Vercel Deployment Guide](https://vercel.com/docs)

---

## Support & Contribution

Found a bug? Have a feature request?
- Create an issue on GitHub
- Submit a pull request with improvements
- Contact the development team

---

**Happy coding! 🚀**
