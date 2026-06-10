# POS-58 Thermal Printer Setup Guide

This guide ensures your hardware is correctly interfaced with the Bossque Carwash Dashboard.

## 1. Hardware Connection
- Connect the **POS-58 USB Thermal Printer** to your local machine.
- Ensure the printer is powered on and loaded with 58mm thermal paper.

## 2. Windows Printer Sharing (Required)
The `node-thermal-printer` library communicates via the Windows Spooler path for USB printers.
1. Open **Control Panel** > **Devices and Printers**.
2. Right-click your POS-58 printer > **Printer Properties**.
3. Go to the **Sharing** tab.
4. Check **"Share this printer"** and set the Share name to `POS-58`.

## 3. Configuration
Verify the interface path in the code.

**File**: `src/lib/printerService.ts`
```typescript
interface: '\\\\localhost\\POS-58',
```

## 4. Testing the Setup
Your setup now supports a simplified `GET` trigger for testing hardware readiness.

1. Ensure your development server is running: `npm run dev`.
2. Open a terminal and run:
   ```bash
   curl -X GET http://localhost:3000/api/print
   ```
3. **Expected Result**:
   - Terminal: Returns a success message with port status.
   - Printer: Produces a diagnostic test receipt containing the "BOSSQUE CARWASH" header.

## 5. Troubleshooting
| Symptom | Solution |
|---------|----------|
| `Error: Permission denied` | Ensure no other printer software or serial monitors are open. |
| `Port not found` | Re-run `npm run list-ports` and verify the USB cable. |
| Garbage/gibberish text | Double-check that `BAUD_RATE` is set to `19200`. |
| Printing is too faint | Check the printer's power supply; thermal printers require steady voltage. |

---
*Note: For production deployment, ensure the Node.js environment has appropriate permissions to access serial hardware ports.*