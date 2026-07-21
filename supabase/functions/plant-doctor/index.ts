// Supabase Edge Function: plant-doctor
// Takes plant info, recent care history, and a photo and/or text description
// of a problem, and returns a diagnosis via Google Gemini (free tier).

import { createClient } from 'npm:@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
// Check ai.google.dev/gemini-api/docs/models for the current recommended
// free-tier "flash" model name if this one is ever deprecated.
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_SEVERITY = ['healthy', 'mild', 'moderate', 'urgent']

function buildPrompt(plant, recentLogs, description) {
  const plantInfo = `
Plant nickname: ${plant.nickname || 'Unknown'}
Common name: ${plant.common_name || 'Unknown'}
Scientific name: ${plant.scientific_name || 'Unknown'}
Known watering need: ${plant.watering || 'Not recorded'}
Known sunlight need: ${plant.sunlight || 'Not recorded'}
Known soil type: ${plant.soil_type || 'Not recorded'}
Known humidity need: ${plant.humidity || 'Not recorded'}
Care difficulty: ${plant.care_level || 'Not recorded'}
`.trim()

  const logsText = recentLogs && recentLogs.length > 0
    ? recentLogs
        .map((l) => `- ${l.action === 'custom' ? (l.custom_action || 'Other') : l.action} on ${new Date(l.logged_at).toLocaleDateString()}`)
        .join('\n')
    : 'No recent care logged.'

  const userNote = description
    ? `The owner describes the problem as: "${description}"`
    : 'The owner did not add a text description, so rely on the photo.'

  return `You are a friendly, knowledgeable plant doctor helping a home plant owner. Use the plant's known info, its recent care history, and the photo and/or description provided to figure out what might be wrong, or confirm it looks healthy. Be practical and specific, not generic. Avoid alarming language for minor issues.

PLANT INFO:
${plantInfo}

RECENT CARE HISTORY (most recent first):
${logsText}

${userNote}

Return STRICT JSON only, no markdown fences, matching this schema:
{
  "diagnosis": string,
  "likely_causes": string[],
  "recommended_actions": string[],
  "severity": "healthy" | "mild" | "moderate" | "urgent"
}

Keep "diagnosis" to 2-4 sentences in plain language. "likely_causes" and "recommended_actions" should each have at most 4 short, concrete bullet points. If the plant looks healthy and there's no described problem, say so plainly with severity "healthy" and empty or reassuring arrays.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Require a signed-in BloomMate user. We handle this ourselves rather than
  // relying on Supabase's platform-level JWT gateway check (unreliable on
  // some projects), so this function stays protected even when deployed
  // with the gateway check disabled.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const token = authHeader.replace('Bearer ', '')
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )
  const { data: { user }, error: authError } = await authClient.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Not signed in.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { plant, recent_logs, photo_base64, mime_type, description } = await req.json()

    if (!photo_base64 && !description) {
      return new Response(JSON.stringify({ error: 'Please add a photo or describe the problem.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = buildPrompt(plant || {}, recent_logs || [], description || null)

    const parts = [{ text: prompt }]
    if (photo_base64 && mime_type) {
      parts.push({ inline_data: { mime_type, data: photo_base64 } })
    }

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini API error:', errText)
      return new Response(JSON.stringify({ error: 'AI service error. Please try again.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rawText) {
      return new Response(JSON.stringify({ error: 'AI did not return a result. Please try again.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch (e) {
      console.error('Could not parse Gemini JSON:', rawText)
      return new Response(JSON.stringify({ error: 'AI returned an unreadable result. Please try again.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = {
      diagnosis: typeof parsed.diagnosis === 'string' ? parsed.diagnosis : 'Could not generate a diagnosis.',
      likely_causes: Array.isArray(parsed.likely_causes)
        ? parsed.likely_causes.filter((s) => typeof s === 'string').slice(0, 4)
        : [],
      recommended_actions: Array.isArray(parsed.recommended_actions)
        ? parsed.recommended_actions.filter((s) => typeof s === 'string').slice(0, 4)
        : [],
      severity: ALLOWED_SEVERITY.includes(parsed.severity) ? parsed.severity : 'unknown',
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('plant-doctor error:', err)
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})