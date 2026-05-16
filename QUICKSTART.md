# Quick Start Guide

Get **Bossque Carwash Dashboard** up and running in 5 minutes!

## ⚡ Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- Firebase account ([Free signup](https://firebase.google.com/))
- Git

## 🚀 Setup Steps

### 1️⃣ Clone & Install (2 min)

```bash
git clone <repository-url>
cd cashier-bossque-carwash
npm install
```

### 2️⃣ Configure Firebase (2 min)

**Create `.env.local` file:**

```bash
cp .env.example .env.local
```

**Add your Firebase credentials:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

📌 **Where to find these?**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click ⚙️ Settings → Project settings
4. Copy values from "Web apps" section

### 3️⃣ Create Firestore Collections (1 min)

In Firebase Console → Firestore Database:

**Create collection: `/transactions`**
- Add sample document with these fields:
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
  "status": "PENDING",
  "paymentMethod": null,
  "cashReceived": 0,
  "balance": 0,
  "checkInTime": "server timestamp",
  "paidTime": null
}
```

**Create collection: `/price_book`**
- Add sample document:
```json
{
  "brand": "Toyota",
  "category": "Standard",
  "price": 45
}
```

### 4️⃣ Update Security Rules

In Firebase Console → Firestore → Rules:

```firebasestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /transactions/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /daily_stats/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /price_book/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.admin == true;
    }
  }
}
```

⚠️ **Development only**: For testing without auth, use `allow read, write: if true;`

### 5️⃣ Start Development Server (< 1 min)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ✅ Testing the App

### Test Phase 1: Car Entry

1. Fill in the form:
   - Plate: `ABC1234`
   - Brand: `Toyota`
   - Color: `Black`
   - Services: Select any services
2. Click **"Masuk Queue"**
3. ✅ Should see green success toast
4. Check Firebase Console → Transactions collection → New document created

### Test Phase 2: Cashier Checkout

1. Car should appear in the queue
2. Click the car card
3. Select payment method (CASH or ONLINE)
4. If CASH: Enter amount (e.g., 50)
5. Click **"Selesai & Cetak Resit"**
6. ✅ Car should disappear from queue
7. Check Firebase → Transaction status changed to "COMPLETED"

### Test Language Toggle

1. Click language button in header
2. UI text should switch between Malay/English

---

## 🐛 Troubleshooting

### Issue: "Firebase config not set"

**Solution**: Check `.env.local` file exists and has all 6 Firebase variables

```bash
cat .env.local  # Check contents
```

### Issue: "No transactions appearing"

**Solution**: 
1. Verify `/transactions` collection exists in Firestore
2. Check browser console for errors
3. Verify Firebase rules allow reads

```javascript
// In browser console
db.collection('transactions').get()
  .then(snap => console.log(snap.size, 'documents'))
```

### Issue: "Styles not working"

**Solution**:
```bash
rm -rf .next
npm run dev
```

### Issue: "Port 3000 already in use"

**Solution**:
```bash
npm run dev -- -p 3001  # Use different port
```

---

## 📁 Key Files to Know

| File | Purpose |
|------|---------|
| `.env.local` | Firebase configuration (keep secret!) |
| `src/components/Dashboard.tsx` | Main layout |
| `src/components/CarEntryIntake.tsx` | Phase 1: Car entry form |
| `src/components/CashierCheckout.tsx` | Phase 2: Payment checkout |
| `src/lib/firebaseService.ts` | Database operations |
| `src/i18n/translations.ts` | Malay/English strings |

---

## 🎯 Key Features

| Feature | Location |
|---------|----------|
| Real-time queue | CashierCheckout component |
| Price calculation | CarEntryIntake component |
| Language toggle | Header, useLanguage hook |
| Payment processing | CashierCheckout modal |
| Toast notifications | lib/toast.ts |
| Firestore sync | lib/firebaseService.ts |

---

## 📚 Next Steps

1. **Review code**: Check `src/components/Dashboard.tsx`
2. **Customize**: Update colors in `tailwind.config.ts`
3. **Add authentication**: Integrate Firebase Auth
4. **Deploy**: Use Vercel, Docker, or your host
5. **Read docs**: See [DEVELOPMENT.md](./DEVELOPMENT.md) for advanced setup

---

## 🚢 Deploy to Vercel (Bonus)

```bash
npm i -g vercel
vercel
```

✅ Select project folder  
✅ Configure environment variables  
✅ Done! Live at `your-project.vercel.app`

---

## 💡 Pro Tips

1. **Use browser DevTools**:
   - React DevTools extension
   - Network tab to monitor Firestore
   - Console for debugging

2. **Test on mobile**: Use Chrome DevTools → Toggle device toolbar

3. **Check real-time updates**: Open app in 2 tabs/windows

4. **Monitor Firestore**: Firebase Console → Firestore → Watch collections update in real-time

---

## 📖 Documentation

- [Full README](./README.md)
- [Developer Guide](./DEVELOPMENT.md)
- [API Reference](./API_DOCUMENTATION.md)
- [Database Schema](./FIRESTORE_SCHEMA.md)
- [Build Summary](./BUILD_SUMMARY.md)

---

## ❓ FAQ

**Q: Can I use this without Firebase?**  
A: No, Firebase Firestore is required for real-time data. You can refactor to use REST APIs or other databases.

**Q: How do I add authentication?**  
A: Use Firebase Auth. See [DEVELOPMENT.md](./DEVELOPMENT.md) for examples.

**Q: Can I customize colors?**  
A: Yes! Edit `tailwind.config.ts` to change the theme.

**Q: How do I deploy?**  
A: Use Vercel (1-click), Docker, or traditional hosting. See [README.md](./README.md).

---

## 🆘 Need Help?

1. Check [DEVELOPMENT.md](./DEVELOPMENT.md) troubleshooting section
2. Review [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for API details
3. Check browser console for error messages
4. Open an issue on GitHub

---

**🎉 You're all set! Happy coding!**

Built with ❤️ for Bossque Carwash
