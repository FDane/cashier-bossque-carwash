export const translations = {
  en: {
    // Header
    'header.title': 'Bossque Carwash',
    'header.dashboard': 'Dashboard',
    'header.language': 'Language',

    // Navigation
    'nav.home': 'Home',
    'nav.staff': 'Staff',
    'nav.inventory': 'Inventory',
    'nav.pastCars': 'Past Cars',
    'nav.customers': 'Customers',
    'nav.priceBook': 'Price List',

    // App General
    'app.subtitle': 'Management System',
    'app.footer': 'Bossque Carwash Management System. Built with Next.js & Firebase.',

    // Phase 1: Intake
    'intake.title': 'Car Entry Intake',
    'intake.subtitle': 'Register incoming vehicle',
    'intake.plateNumber': 'Plate Number',
    'intake.plateNumber.placeholder': 'e.g., ABC 123',
    'intake.brand': 'Car Brand / Model',
    'intake.brand.placeholder': 'Select brand',
    'intake.model': 'Car Model',
    'intake.model.placeholder': 'Select model',
    'intake.color': 'Car Color',
    'intake.color.placeholder': 'Select color',
    'intake.services': 'Service Types',
    'intake.services.exterior': 'Exterior',
    'intake.services.interior': 'Interior',
    'intake.services.engine': 'Engine',
    'intake.price': 'Estimated Price',
    'intake.image': 'Vehicle Photo',
    'intake.image.optional': '(optional)',
    'intake.uploadPhoto': 'Upload Optional Photo',
    'intake.changePhoto': 'Change Photo',
    'intake.imageOptionalNote': 'This image is optional. You can add it later when editing or checking out the car.',
    'intake.addQueue': 'Add to Queue',
    'intake.error.plateRequired': 'Plate number is required',
    'intake.error.brandRequired': 'Brand is required',
    'intake.error.priceZero': 'Invalid price for selected services',
    'intake.success': 'Car added to queue successfully',

    // Phase 2: Cashier
    'cashier.title': 'Cashier Counter Checkout',
    'cashier.search': 'Search Plate Number...',
    'cashier.queue': 'Active Queue',
    'cashier.queueCount': 'Cars waiting:',
    'cashier.noResults': 'No vehicles found',
    'cashier.emptyQueue': 'The queue is currently empty',
    'cashier.retailAddons': 'Add-on Retail Items',
    'cashier.confirmDelete': 'Are you sure you want to remove this car?',
    'cashier.deleteSuccess': 'Car removed from queue',
    'cashier.updateSuccess': 'Car updated successfully',

    // Customer
    'customer.title': 'Customer Management',
    'customer.addTitle': 'Add New Customer',
    'customer.searchTitle': 'Search Customer',
    'customer.pastOrders': 'Past Orders',
    'customer.noOrders': 'No past orders found',
    'customer.name': 'Customer Name',
    'customer.phone': 'Phone Number',
    'customer.plate': 'Plate Number',
    'customer.addSuccess': 'Customer added successfully',
    'customer.searchPlaceholder': 'Enter Plate Number...',

    // Inventory
    'inventory.title': 'Inventory Management',
    'inventory.search': 'Search items...',
    'inventory.addTitle': 'Add New Item',
    'inventory.lowStock': 'Low Stock Alerts',
    'inventory.name': 'Item Name',
    'inventory.category': 'Category',
    'inventory.quantity': 'Quantity',
    'inventory.addSuccess': 'Item added successfully',
    'inventory.deleteConfirm': 'Are you sure you want to delete this item?',

    // Past Cars
    'pastCars.title': 'Past Car Records',
    'pastCars.search': 'Search Plate Records',

    // Price Book
    'priceBook.title': 'Price List Management',
    'priceBook.brand': 'Brand',
    'priceBook.model': 'Model',
    'priceBook.price': 'Base Price',
    'priceBook.addTitle': 'Add New Car Price',

    // Payment Modal
    'payment.title': 'Payment Settlement',
    'payment.plateNumber': 'Plate Number',
    'payment.carDetails': 'Car Details',
    'payment.totalAmount': 'Total Amount',
    'payment.paymentMethod': 'Payment Method',
    'payment.cash': 'CASH',
    'payment.online': 'ONLINE (QR Pay)',
    'payment.cashReceived': 'Cash Received',
    'payment.balance': 'Balance',
    'payment.shortage': 'Shortage',
    'payment.surplus': 'Surplus',
    'payment.qrPlaceholder': 'QR Code Placeholder',
    'payment.qrInstruction': 'Scan QR code to complete payment',
    'payment.checkout': 'Selesai & Cetak Resit',
    'payment.vehiclePhoto': 'Vehicle Photo (optional)',
    'payment.vehiclePhotoNote': 'Upload or update the vehicle photo if available.',
    'payment.uploadPhoto': 'Upload Photo',
    'payment.changePhoto': 'Change Photo',
    'payment.viewUploadedPhoto': 'View uploaded photo',
    'payment.photoSelectedNote': 'A new photo is ready to upload.',
    'payment.error.invalidCash': 'Cash amount must be at least the total amount',
    'payment.success': 'Payment processed successfully',
    'payment.error': 'Error processing payment',

    // Staff Management
    'staff.title': 'Staff Management — Today',
    'staff.selectAll': 'Select all',
    'staff.clockOutSelected': 'Clock Out Selected',
    'staff.name': 'Staff Name',
    'staff.checkIn': 'Check In',
    'staff.checkOut': 'Check Out',
    'staff.advance': 'Advance (RM)',
    'staff.actions': 'Actions',
    'staff.addAdvance': 'Add',

    // Stats
    'stats.totalQueue': 'Total Queue',
    'stats.completedToday': 'Completed Today',
    'stats.totalRevenue': 'Total Revenue',
    'stats.avgPerCar': 'Avg. Per Car',

    // Common
    'common.add': 'Add',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.warning': 'Warning',

    // Date & Time
    'time.justNow': 'Just now',
    'time.minutesAgo': 'minutes ago',
    'time.hoursAgo': 'hours ago',

    // Colors
    'color.Black': 'Black',
    'color.White': 'White',
    'color.Silver': 'Silver',
    'color.Gray': 'Gray',
    'color.Blue': 'Blue',
    'color.Red': 'Red',
    'color.Gold': 'Gold',
    'color.Beige': 'Beige',
    'color.Green': 'Green',
    'color.Orange': 'Orange',
  },
  ms: {
    // Header
    'header.title': 'Bossque Carwash',
    'header.dashboard': 'Papan Pemuka',
    'header.language': 'Bahasa',

    // Navigation
    'nav.home': 'Utama',
    'nav.staff': 'Staff',
    'nav.inventory': 'Inventori',
    'nav.pastCars': 'Rekod Lama',
    'nav.customers': 'Pelanggan',
    'nav.priceBook': 'Senarai Harga',

    // App General
    'app.subtitle': 'Sistem Pengurusan',
    'app.footer': 'Sistem Pengurusan Bossque Carwash. Dibina dengan Next.js & Firebase.',

    // Phase 1: Intake
    'intake.title': 'Rekod Kenderaan',
    'intake.subtitle': 'Daftarkan kenderaan yang masuk',
    'intake.plateNumber': 'No Plat',
    'intake.plateNumber.placeholder': 'cth. ABC 123',
    'intake.brand': 'Jenama / Model Kereta',
    'intake.brand.placeholder': 'Pilih jenama',
    'intake.model': 'Model Kereta',
    'intake.model.placeholder': 'Pilih model',
    'intake.color': 'Warna Kereta',
    'intake.color.placeholder': 'Pilih warna',
    'intake.services': 'Jenis Perkhidmatan',
    'intake.services.exterior': 'Luar (Eksterior)',
    'intake.services.interior': 'Dalam (Interior)',
    'intake.services.engine': 'Enjin',
    'intake.price': 'Harga Anggaran',
    'intake.image': 'Foto Kenderaan',
    'intake.image.optional': '(pilihan)',
    'intake.uploadPhoto': 'Muat Naik Foto Kenderaan',
    'intake.changePhoto': 'Tukar Foto',
    'intake.imageOptionalNote': 'Imej ini adalah pilihan. Anda boleh menambahnya kemudian semasa mengedit atau semasa checkout kereta.',
    'intake.addQueue': 'Masuk Queue',
    'intake.error.plateRequired': 'No plat diperlukan',
    'intake.error.brandRequired': 'Jenama diperlukan',
    'intake.error.priceZero': 'Harga tidak sah untuk perkhidmatan yang dipilih',
    'intake.success': 'Kereta berjaya ditambah ke queue',

    // Phase 2: Cashier
    'cashier.title': 'Kaunter Bayaran Kenderaan',
    'cashier.search': 'Cari No Plat Kenderaan...',
    'cashier.queue': 'Kenderaan belum bayar',
    'cashier.queueCount': 'Kereta menunggu:',
    'cashier.noResults': 'Tiada kenderaan dijumpai',
    'cashier.emptyQueue': 'Queue kosong',
    'cashier.retailAddons': 'Tambahan Barangan Runcit',
    'cashier.confirmDelete': 'Adakah anda pasti mahu memadam kereta ini?',
    'cashier.deleteSuccess': 'Kereta dikeluarkan dari queue',
    'cashier.updateSuccess': 'Maklumat kereta dikemas kini',

    // Customer
    'customer.title': 'Pengurusan Pelanggan',
    'customer.addTitle': 'Tambah Pelanggan Baru',
    'customer.searchTitle': 'Cari Pelanggan',
    'customer.pastOrders': 'Rekod Pesanan Terdahulu',
    'customer.noOrders': 'Tiada rekod pesanan dijumpai',
    'customer.name': 'Nama Pelanggan',
    'customer.phone': 'No Telefon',
    'customer.plate': 'No Plat',
    'customer.addSuccess': 'Pelanggan berjaya ditambah',
    'customer.searchPlaceholder': 'Masukkan No Plat...',

    // Inventory
    'inventory.title': 'Pengurusan Inventori',
    'inventory.search': 'Cari barang...',
    'inventory.addTitle': 'Tambah Barang Baru',
    'inventory.lowStock': 'Amaran Stok Rendah',
    'inventory.name': 'Nama Barang',
    'inventory.category': 'Kategori',
    'inventory.quantity': 'Kuantiti',
    'inventory.addSuccess': 'Barang berjaya ditambah',
    'inventory.deleteConfirm': 'Adakah anda pasti mahu memadam barang ini?',

    // Past Cars
    'pastCars.title': 'Rekod Kenderaan Lama',
    'pastCars.search': 'Cari Rekod No Plat',

    // Price Book
    'priceBook.title': 'Pengurusan Senarai Harga',
    'priceBook.brand': 'Jenama',
    'priceBook.model': 'Model',
    'priceBook.price': 'Harga Asas',
    'priceBook.addTitle': 'Tambah Harga Kereta Baru',

    // Payment Modal
    'payment.title': 'Penyelesaian Pembayaran',
    'payment.plateNumber': 'No Plat',
    'payment.carDetails': 'Maklumat Kereta',
    'payment.totalAmount': 'Jumlah Perlu Dibayar',
    'payment.paymentMethod': 'Kaedah Pembayaran',
    'payment.cash': 'TUNAI',
    'payment.online': 'ATAS TALIAN (QR Pay)',
    'payment.cashReceived': 'Tunai Diterima',
    'payment.balance': 'Baki',
    'payment.shortage': 'Kurang',
    'payment.surplus': 'Lebih',
    'payment.qrPlaceholder': 'Ruang Kod QR',
    'payment.qrInstruction': 'Imbas kod QR untuk bayaran',
    'payment.checkout': 'Selesai & Cetak Resit',
    'payment.vehiclePhoto': 'Foto Kenderaan (pilihan)',
    'payment.vehiclePhotoNote': 'Muat naik atau kemas kini foto kenderaan jika ada.',
    'payment.uploadPhoto': 'Muat Naik Foto',
    'payment.changePhoto': 'Tukar Foto',
    'payment.viewUploadedPhoto': 'Lihat foto yang dimuat naik',
    'payment.photoSelectedNote': 'Foto baru siap dimuat naik.',
    'payment.error.invalidCash': 'Jumlah tunai mesti sekurang-kurangnya jumlah terhutang',
    'payment.success': 'Pembayaran berjaya diproses',
    'payment.error': 'Ralat memproses pembayaran',

    // Staff Management
    'staff.title': 'Pengurusan Kakitangan — Hari Ini',
    'staff.selectAll': 'Pilih semua',
    'staff.clockOutSelected': 'Clock Out Pilihan',
    'staff.name': 'Nama Kakitangan',
    'staff.checkIn': 'Masa Masuk',
    'staff.checkOut': 'Masa Keluar',
    'staff.advance': 'Pendahuluan (RM)',
    'staff.actions': 'Tindakan',
    'staff.addAdvance': 'Tambah',


    // Stats
    'stats.totalQueue': 'Jumlah Queue',
    'stats.completedToday': 'Selesai Hari Ini',
    'stats.totalRevenue': 'Jumlah Jualan',
    'stats.avgPerCar': 'Purata Per Kereta',

    // Common
    'common.add': 'Tambah',
    'common.close': 'Tutup',
    'common.confirm': 'Sahkan',
    'common.cancel': 'Batal',
    'common.loading': 'Memuatkan...',
    'common.error': 'Ralat',
    'common.success': 'Berjaya',
    'common.warning': 'Amaran',

    // Date & Time
    'time.justNow': 'Baru sahaja',
    'time.minutesAgo': 'minit yang lalu',
    'time.hoursAgo': 'jam yang lalu',

    // Colors
    'color.Black': 'Hitam',
    'color.White': 'Putih',
    'color.Silver': 'Perak',
    'color.Gray': 'Kelabu',
    'color.Blue': 'Biru',
    'color.Red': 'Merah',
    'color.Gold': 'Emas',
    'color.Beige': 'Beige',
    'color.Green': 'Hijau',
    'color.Orange': 'Oren',
  },
} as const

export type TranslationKey = keyof typeof translations.en

export type Language = 'en' | 'ms'

export function getTranslation(key: TranslationKey, language: Language): string {
  return translations[language][key] || translations.en[key] || key
}
