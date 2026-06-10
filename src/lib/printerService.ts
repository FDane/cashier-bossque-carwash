import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import path from 'path'

export interface PrintReceiptData {
    plateNumber: string
    customerName?: string // Dikekalkan dalam interface supaya frontend tidak error, tapi tidak akan diprint
    brand: string
    model: string
    color: string
    services: {
        exterior?: boolean
        interior?: boolean
        engine?: boolean
    }
    basePrice: number
    addons: Array<{ name: string; price: number; quantity: number }>
    miscCharges: Array<{ name: string; price: number }>
    paymentMethod: 'CASH' | 'ONLINE'
    cashReceived?: number
    change?: number
    cashDenominations?: Record<number, number>
    changeDenominations?: Record<number, number>
    totalAmount: number
    timestamp?: Date
    transactionId: string // Dikekalkan dalam interface, tapi tidak akan diprint
    notes?: string
}

const formatPrice = (price: number) => `RM ${price.toFixed(2)}`

export const executePrintJob = async (data: PrintReceiptData): Promise<void> => {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: '\\\\localhost\\POS-58',
        characterSet: CharacterSet.PC437_USA,
        width: 32,
        lineCharacter: "-",
    })

    // --- JANA NOMBOR RESIT AUTOMATIK ---
    // Format: CB + TahunBulanHari - JamMinit (Cth: CB260609-1845)
    const d = new Date()
    const yy = d.getFullYear().toString().slice(-2)
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    const dd = d.getDate().toString().padStart(2, '0')
    const hh = d.getHours().toString().padStart(2, '0')
    const min = d.getMinutes().toString().padStart(2, '0')
    const generatedReceiptNo = `CB${yy}${mm}${dd}-${hh}${min}`

    // --- 1. HEADER ---
    printer.alignCenter()

    try {
        const logoPath = path.join(process.cwd(), 'public', 'receipt-logo.png')
        await printer.printImage(logoPath)
    } catch (error) {
        console.error('Logo gagal diprint:', error)
    }

    printer.setTextSize(1, 1)
    printer.bold(true)
    printer.println('CARWASH BOSSQUE')

    printer.setTextNormal()
    printer.bold(false)
    printer.println('BERHADAPAN MASJID OSMANIAH')
    printer.println('JALAN PADANG BESAR (U)')
    printer.println('KG. SYED AFDAN, 02100')
    printer.println('PADANG BESAR, PERLIS')
    printer.println('Tel: 04-946 2327 / 013-718 7040')

    printer.newLine()
    printer.drawLine()

    // --- 2. INFO TRANSAKSI ---
    printer.alignLeft()
    printer.println(`Tarikh   : ${d.toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })}`)
    printer.println(`No. Resit: ${generatedReceiptNo}`) // Menggunakan nombor resit yang dijana
    printer.println(`No. Plat : ${data.plateNumber}`)
    // Nama pelanggan telah dibuang sepenuhnya dari sini
    printer.drawLine()

    // --- 3. SENARAI SERVIS & ITEM ---
    printer.bold(true)
    printer.leftRight('Servis', 'Harga')
    printer.bold(false)
    printer.drawLine()

    // --- LOGIK SERVIS DINAMIK ---
    const activeServices = []
    if (data.services?.exterior) activeServices.push('Luar')
    if (data.services?.interior) activeServices.push('Dalam')
    if (data.services?.engine) activeServices.push('Enjin')

    // Jika gabungan servis dipilih, ia akan papar "Cucian Luar & Dalam"
    const baseServiceName = activeServices.length > 0
        ? `Cucian ${activeServices.join(' & ')}`
        : 'Cucian Asas'

    printer.leftRight(baseServiceName, formatPrice(data.basePrice))

    // Addons / Tambahan
    if (data.addons && data.addons.length > 0) {
        data.addons.forEach((addon) => {
            printer.leftRight(`${addon.quantity}x ${addon.name}`, formatPrice(addon.price * addon.quantity))
        })
    }

    // Caj Lain-lain
    if (data.miscCharges && data.miscCharges.length > 0) {
        data.miscCharges.forEach((misc) => {
            printer.leftRight(misc.name, formatPrice(misc.price))
        })
    }

    printer.drawLine()

    // --- 4. JUMLAH KESELURUHAN ---
    printer.bold(true)
    printer.leftRight('JUMLAH KESELURUHAN', formatPrice(data.totalAmount))
    printer.bold(false)

    printer.newLine()

    // --- 5. PECAHAN BAYARAN ---
    printer.alignRight()
    const caraBayaran = data.paymentMethod === 'CASH' ? 'TUNAI' : 'ATAS TALIAN'
    printer.println(`Bayaran: ${caraBayaran}`)

    if (data.paymentMethod === 'CASH') {
        printer.println(`Diterima: ${formatPrice(data.cashReceived || 0)}`)
        printer.println(`Baki: ${formatPrice(data.change || 0)}`)
    }

    printer.newLine()

    // Nota (Jika ada)
    if (data.notes) {
        printer.alignLeft()
        printer.drawLine()
        printer.println(`Nota: ${data.notes}`)
    }

    // --- 6. FOOTER (UCAPAN) ---
    printer.alignCenter()
    printer.newLine()
    printer.println('Terima kasih kerana sudi datang!')
    printer.println('Layari web kami: bossque.my')

    printer.cut()

    try {
        await printer.execute()
        // console.log('Resit berjaya diprint') // Removed to fix lint warning
    } catch (_error) {
        // console.error('Ralat semasa print:', error) // Removed to fix lint warning
        throw _error
    }
}