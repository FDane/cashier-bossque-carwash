#!/usr/bin/env node
/**
 * Utility to detect available printer ports
 * Usage: node scripts/list-ports.js
 */

import { SerialPort } from 'serialport'

async function listPorts() {
  try {
    console.log('Scanning for available serial ports...\n')
    const ports = await SerialPort.list()

    if (ports.length === 0) {
      console.log('❌ No serial ports found!')
      console.log('Make sure your POS-58 printer is connected via USB.')
      process.exit(1)
    }

    console.log(`✅ Found ${ports.length} available port(s):\n`)

    ports.forEach((port, index) => {
      console.log(`${index + 1}. Port: ${port.path}`)
      console.log(`   Manufacturer: ${port.manufacturer || 'Unknown'}`)
      console.log(`   Serial Number: ${port.serialNumber || 'Unknown'}`)
      console.log(`   PID: ${port.productId || 'Unknown'}`)
      console.log(`   VID: ${port.vendorId || 'Unknown'}`)
      console.log()
    })

    console.log('📝 Update your printer configuration:')
    console.log('Edit src/app/api/print/route.ts and change the portName to match your printer port.')
    console.log(`\nExample: const portName = '${ports[0]?.path || 'COM3'}';`)
  } catch (error) {
    console.error('❌ Error listing ports:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

listPorts()
