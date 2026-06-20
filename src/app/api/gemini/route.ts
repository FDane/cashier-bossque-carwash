import { NextRequest, NextResponse } from 'next/server'

// POST /api/gemini
// Body: { base64: string, mimeType: string, availableColors: string[] }
// Returns: { plateNumber: string, brand: string, model: string, color: string }

export async function POST(req: NextRequest) {
    try {
        const { base64, mimeType, availableColors } = await req.json()

        if (!base64) {
            return NextResponse.json({ error: 'Missing base64 image data' }, { status: 400 })
        }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
        }

        const colorList = Array.isArray(availableColors) ? availableColors.join(', ') : ''

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: mimeType || 'image/jpeg',
                                        data: base64,
                                    },
                                },
                                {
                                    text: `You are a car recognition assistant for a car wash system in Malaysia.

Analyze the car in this image and extract the following details.
Return ONLY a valid JSON object — no markdown, no backticks, no explanation, nothing else.

JSON schema:
{
  "plateNumber": "Malaysian license plate number (e.g. 'PEA 1234', 'WXY 5678'). Use empty string if not clearly visible.",
  "brand": "Car manufacturer/make (e.g. Perodua, Proton, Toyota, Honda, Hyundai, Nissan, Mazda, Mercedes-Benz, BMW, Ford). Use empty string if unknown.",
  "model": "Car model name (e.g. Myvi, Axia, Saga, Vios, City, Civic, Yaris, Almera). Use empty string if unknown.",
  "color": "Pick the CLOSEST match from this list only: ${colorList}. Use empty string if unsure."
}

Rules:
- For plateNumber: read the full plate carefully including state prefix letters and numbers.
- For brand: use the official brand name, not an abbreviation.
- For model: use the common short model name.
- For color: you MUST pick from the provided list or return empty string. Do not invent colors.
- If you cannot determine a field confidently, return empty string for that field.`,
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 1024, // Increased to give the model more breathing room
                        responseMimeType: "application/json" // Forces native JSON, preventing markdown issues
                    },
                }),
            }
        )

        if (!geminiResponse.ok) {
            const errText = await geminiResponse.text()
            console.error('Gemini API error response:', errText)
            return NextResponse.json(
                { error: `Gemini API returned ${geminiResponse.status}` },
                { status: 502 }
            )
        }

        const geminiData = await geminiResponse.json()

        const rawText: string =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

        if (!rawText) {
            return NextResponse.json(
                { error: 'Empty response from Gemini' },
                { status: 502 }
            )
        }

        const cleaned = rawText.replace(/```json|```/gi, '').trim()

        let parsed: {
            plateNumber?: string
            brand?: string
            model?: string
            color?: string
        }

        try {
            parsed = JSON.parse(cleaned)
        } catch {
            console.error('Failed to parse Gemini JSON:', cleaned)
            return NextResponse.json(
                { error: 'Could not parse AI response as JSON' },
                { status: 502 }
            )
        }

        // Sanitise — guarantee all keys exist and are strings
        const result = {
            plateNumber: typeof parsed.plateNumber === 'string' ? parsed.plateNumber.trim() : '',
            brand: typeof parsed.brand === 'string' ? parsed.brand.trim() : '',
            model: typeof parsed.model === 'string' ? parsed.model.trim() : '',
            color: typeof parsed.color === 'string' ? parsed.color.trim() : '',
        }

        return NextResponse.json(result)
    } catch (err: any) {
        console.error('Gemini route error:', err)
        return NextResponse.json(
            { error: err.message ?? 'Internal server error' },
            { status: 500 }
        )
    }
}