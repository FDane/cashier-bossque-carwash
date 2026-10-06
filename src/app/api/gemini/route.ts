import { NextRequest, NextResponse } from 'next/server'

// POST /api/gemini
// Body:    { base64, mimeType, availableColors: string[], priceBook: { id, brand, model }[] }
// Success: { plateNumber, color, matched, id, brand, model }
//          matched=false -> id=null, brand='', model=''  (car not in price book / not sure)
// Error:   { error: string, code: string } with a proper HTTP status

const GEMINI_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const TIMEOUT_MS = 20_000
const MAX_BASE64_CHARS = 5_000_000 // ~3.7 MB image
const MAX_ITEMS = 1000
const UNKNOWN = 'UNKNOWN'
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

type Item = { id: string; brand: string; model: string }

const fail = (status: number, code: string, error: string) =>
    NextResponse.json({ error, code }, { status })

function cleanItems(input: unknown): Item[] {
    if (!Array.isArray(input)) return []
    const seen = new Set<string>()
    const out: Item[] = []
    for (const it of input.slice(0, MAX_ITEMS)) {
        const id = String(it?.id ?? '').trim()
        const brand = String(it?.brand ?? '').trim()
        const model = String(it?.model ?? '').trim()
        if (!id || !brand || !model || seen.has(id)) continue
        seen.add(id)
        out.push({ id, brand, model })
    }
    return out
}

function buildPrompt(items: Item[]) {
    // Group by brand, number each entry:  "Perodua: 1=Myvi, 2=Axia"
    const groups = new Map<string, string[]>()
    items.forEach((it, i) => {
        const list = groups.get(it.brand) ?? []
        list.push(`${i + 1}=${it.model}`)
        groups.set(it.brand, list)
    })
    const catalog = [...groups].map(([b, l]) => `${b}: ${l.join(', ')}`).join('\n')

    return `Identify the customer's car for a Malaysian car wash. If several cars are visible, use the closest/most centered one.
Return JSON:
- plateNumber: Malaysian plate as printed (e.g. "PEA 1234", "WXY 5678 A"). "" if not clearly legible. Never guess characters.
- color: closest body color from the allowed values, or ${UNKNOWN}.
- seen: brand and model you see, e.g. "Perodua Myvi". "" if unsure.
- match: number of the PRICE BOOK entry with the SAME brand AND model as the car, else 0.
Rules for match: only when you are confident of both brand and model (badge, grille, lights, body shape). Never pick a similar-looking entry. Brand or model not listed, unsure, or not a car -> 0.

PRICE BOOK (number=model):
${catalog}`
}

export async function POST(req: NextRequest) {
    try {
        // ── 1. Validate request ─────────────────────────────────────────────
        let body: any
        try {
            body = await req.json()
        } catch {
            return fail(400, 'BAD_REQUEST', 'Invalid request body')
        }

        const { base64, mimeType, availableColors, priceBook } = body ?? {}

        if (typeof base64 !== 'string' || !base64) return fail(400, 'NO_IMAGE', 'Missing image data')
        if (base64.length > MAX_BASE64_CHARS) return fail(413, 'IMAGE_TOO_LARGE', 'Image is too large')

        const mime = ALLOWED_MIME.has(mimeType) ? mimeType : 'image/jpeg'
        const colors: string[] = Array.isArray(availableColors)
            ? availableColors.filter((c: unknown): c is string => typeof c === 'string' && !!c.trim())
            : []
        const items = cleanItems(priceBook)

        if (items.length === 0) {
            return fail(400, 'EMPTY_PRICEBOOK', 'Price book is empty or not loaded yet')
        }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) return fail(500, 'NO_API_KEY', 'AI service is not configured')

        // ── 2. Call Gemini ──────────────────────────────────────────────────
        const responseSchema = {
            type: 'OBJECT',
            properties: {
                plateNumber: { type: 'STRING' },
                color: colors.length
                    ? { type: 'STRING', format: 'enum', enum: [...colors, UNKNOWN] }
                    : { type: 'STRING' },
                seen: { type: 'STRING' },
                match: { type: 'INTEGER' },
            },
            required: ['plateNumber', 'color', 'seen', 'match'],
            propertyOrdering: ['plateNumber', 'color', 'seen', 'match'],
        }

        let res: Response
        try {
            res = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                signal: AbortSignal.timeout(TIMEOUT_MS),
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { inline_data: { mime_type: mime, data: base64 } },
                                { text: buildPrompt(items) },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0,
                        maxOutputTokens: 150, // output is ~40 tokens
                        responseMimeType: 'application/json',
                        responseSchema,
                        thinkingConfig: { thinkingBudget: 0 }, // no hidden thinking tokens
                    },
                }),
            })
        } catch (e: any) {
            const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError'
            console.error('Gemini request failed:', e?.name, e?.message)
            return timedOut
                ? fail(504, 'AI_TIMEOUT', 'AI took too long to respond. Please try again.')
                : fail(502, 'AI_UNREACHABLE', 'Could not reach the AI service.')
        }

        if (!res.ok) {
            console.error('Gemini API error:', res.status, (await res.text()).slice(0, 500))
            return res.status === 429
                ? fail(429, 'AI_BUSY', 'AI is busy. Please try again in a moment.')
                : fail(502, 'AI_ERROR', `AI service error (${res.status})`)
        }

        // ── 3. Read the response ────────────────────────────────────────────
        const data = await res.json().catch(() => null)
        const cand = data?.candidates?.[0]

        if (!cand) {
            return data?.promptFeedback?.blockReason
                ? fail(502, 'AI_BLOCKED', 'The AI could not process this image.')
                : fail(502, 'AI_EMPTY', 'AI returned no result.')
        }
        if (cand.finishReason && cand.finishReason !== 'STOP') {
            console.error('Gemini finishReason:', cand.finishReason)
            return fail(502, 'AI_INCOMPLETE', 'AI response was incomplete. Please try again.')
        }

        const text: string = (cand.content?.parts ?? [])
            .filter((p: any) => !p.thought && typeof p.text === 'string')
            .map((p: any) => p.text)
            .join('')
            .replace(/```json|```/gi, '')
            .trim()

        let parsed: any
        try {
            parsed = JSON.parse(text)
        } catch {
            console.error('Gemini returned invalid JSON:', text.slice(0, 300))
            return fail(502, 'AI_BAD_JSON', 'Could not read the AI response.')
        }

        // ── 4. Validate output — never trust the model blindly ──────────────
        const plateNumber =
            typeof parsed.plateNumber === 'string'
                ? parsed.plateNumber.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12)
                : ''

        const color =
            typeof parsed.color === 'string'
                ? colors.find(c => c.toLowerCase() === parsed.color.trim().toLowerCase()) ?? ''
                : ''

        const n = Number(parsed.match)
        const item = Number.isInteger(n) && n >= 1 && n <= items.length ? items[n - 1] : null

        if (process.env.NODE_ENV !== 'production') {
            console.log('[gemini] seen:', parsed.seen, '| match:', n, '->', item ? `${item.brand} ${item.model}` : 'none')
        }

        return NextResponse.json({
            plateNumber,
            color,
            matched: !!item,
            id: item?.id ?? null,
            brand: item?.brand ?? '',
            model: item?.model ?? '',
        })
    } catch (err: any) {
        console.error('Gemini route error:', err)
        return fail(500, 'INTERNAL', 'Internal server error')
    }
}