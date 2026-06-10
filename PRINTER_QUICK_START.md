# POS-58 Printer Integration - Quick Start

## What Was Implemented

Your cashier app now automatically prints receipts to the POS-58 thermal printer when transactions are completed. Here's what happens:

1. ✅ Customer completes checkout
2. ✅ System processes transaction in Firebase
3. ✅ Receipt is formatted for thermal printer
4. ✅ Receipt automatically prints (one per vehicle in batch)
5. ✅ Transaction is saved and archived

## Files Added

| File | Purpose |
|------|---------|
| `src/lib/printerService.ts` | Receipt formatting with ESC/POS commands |
| `src/app/api/print/route.ts` | Backend API for printer communication |
| `src/hooks/usePrinter.ts` | React hook for printing management |
| `POS58_PRINTER_SETUP.md` | Detailed setup instructions |

## 5-Minute Setup

### Step 1: Set Up Windows Printer Sharing
Ensure your POS-58 printer is installed in Windows and shared with the name **"POS-58"**.

### Step 2: Verify Configuration
Check `src/lib/printerService.ts`. It is pre-configured to look for:
`interface: '\\\\localhost\\POS-58'`

### Step 3: Start Development Server
```bash
npm run dev
```

### Step 4: Test
1. Open the cashier page
2. Or use the test command below
3. Receipt should print automatically!

## What You'll See

### On Screen
- Green "Complete" button becomes available when payment is set
- After checkout, brief loading state while printing
- Success message: "Transaction completed"

### On Printer
A formatted receipt with:
```
BOSSQUE CARWASH
        Receipt
─────────────────────────────────────────
Date: 6/9/2026 2:30:45 PM
ID: TXN-ABC123

VEHICLE DETAILS
Plate: ABC1234
Honda Civic
Color: Black

CUSTOMER
John Doe

SERVICES
• Exterior
• Interior

─────────────────────────────────────────
Base Price:         RM 150.00
Exterior Wash:      RM  50.00
Air Freshener (x1):  RM  25.00
─────────────────────────────────────────
        TOTAL: RM 225.00

PAYMENT
Method: CASH
Received: RM 300.00
Change: RM  75.00

Cash Breakdown:
  RM50 x 1
  RM20 x 1
  RM5 x 1

Change Breakdown:
  RM50 x 1
  RM20 x 1
  RM5 x 1

─────────────────────────────────────────
Thank you for your business!
```

## Printer Specifications

Your POS-58 settings (auto-configured):
- **Library**: node-thermal-printer
- **Type**: EPSON (Standard for POS-58)
- **Paper Width**: 58mm (supports thermal paper)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Printer not found" | Ensure printer is shared as "POS-58" in Windows settings |
| Permission Denied | Run your terminal/IDE as Administrator |
| Logo not printing | Ensure `public/receipt-logo.png` exists |
| App freezes on checkout | Check if the printer is offline or out of paper |

## Advanced Features

### Print Without Completing Transaction
To trigger a diagnostic test print or verify the printer connection without processing a real transaction, you can now use a simple GET request:

```bash
curl -X GET http://localhost:3000/api/print
```

### Disable Printing (Temporarily)
To disable automatic printing (e.g., for testing), comment out the print section in `src/components/CashierCheckout.tsx` around line 520.

### Custom Receipt Format
Edit `src/lib/printerService.ts` to customize:
- Business name and footer text
- Receipt width (line dashes)
- Font sizes
- Section headers
- Included information

## Next Steps

1. ✅ Setup is complete!
2. Test a transaction to confirm printing works
3. Adjust receipt format if needed
4. Backup receipt logs if needed

## Support Files

- **Setup Guide**: [POS58_PRINTER_SETUP.md](./POS58_PRINTER_SETUP.md) - Detailed instructions
- **API Documentation**: Check `src/app/api/print/route.ts` for endpoint details
- **Printer Service**: Check `src/lib/printerService.ts` for receipt formatting

---

**Last Updated**: June 9, 2026  
**Printer Model**: POS-58 USB Thermal Printer  
**Interface**: Node.js + Serial Port Communication
