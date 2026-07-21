// Supabase Edge Function: identify-plant
// Takes a base64 photo, calls Google Gemini (free tier, vision-capable),
// and returns plant identification + care data matching our exact
// dropdown option values (see src/lib/plantFields.js).

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

// Must exactly match src/lib/plantFields.js option values.
const ALLOWED = {
  watering: ['frequent', 'average', 'minimum', 'none', 'soak_and_dry', 'bottom_water'],
  sunlight: ['full_sun', 'sun-part_shade', 'part_shade', 'full_shade', 'bright_indirect', 'low_light', 'morning_sun'],
  soil_type: ['well_draining', 'sandy', 'loamy', 'clay', 'peat_moss_based', 'orchid_bark'],
  humidity: ['high', 'moderate', 'low'],
  ph_level: ['acidic', 'neutral', 'alkaline'],
  fertilizer_frequency: ['every_week', 'every_2_weeks', 'every_month', 'growing_season_only', 'rarely', 'never'],
  pruning_frequency: ['monthly', 'seasonal', 'yearly', 'as_needed', 'never'],
  cycle: ['perennial', 'annual', 'biennial'],
  care_level: ['easy', 'moderate', 'advanced'],
}

function sanitizeEnum(field, value) {
  if (value == null) return null
  const v = String(value).trim()
  return ALLOWED[field].includes(v) ? v : null
}

const PROMPT = `You are a plant identification and care expert. Look at the photo of a plant and identify it, then return care information as STRICT JSON matching this exact schema. Do not include any text outside the JSON, no markdown code fences.

Schema:
{
  "identified": boolean,
  "confidence": "high" | "medium" | "low",
  "common_name": string | null,
  "scientific_name": string | null,
  "watering": one of ["frequent","average","minimum","none","soak_and_dry","bottom_water"] or null,
  "sunlight": one of ["full_sun","sun-part_shade","part_shade","full_shade","bright_indirect","low_light","morning_sun"] or null,
  "soil_type": one of ["well_draining","sandy","loamy","clay","peat_moss_based","orchid_bark"] or null,
  "humidity": one of ["high","moderate","low"] or null,
  "ph_level": one of ["acidic","neutral","alkaline"] or null,
  "temp_min": number or null,
  "temp_max": number or null,
  "fertilizer_frequency": one of ["every_week","every_2_weeks","every_month","growing_season_only","rarely","never"] or null,
  "pruning_frequency": one of ["monthly","seasonal","yearly","as_needed","never"] or null,
  "cycle": one of ["perennial","annual","biennial"] or null,
  "care_level": one of ["easy","moderate","advanced"] or null,
  "poisonous_to_pets": boolean or null,
  "poisonous_to_humans": boolean or null,
  "care_guide": {
    "watering": string,
    "sunlight": string,
    "pruning": string
  }
}

Temperatures must be in Celsius. Only use values from the given lists, exactly as written including underscores and hyphens. If you are unsure about any field, use null rather than guessing — do not invent data. If the image doesn't clearly show a plant, set "identified" to false, leave other fields null, and still include a "care_guide" object with empty strings.`

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
    const { image_base64, mime_type } = await req.json()

    if (!image_base64 || !mime_type) {
      return new Response(JSON.stringify({ error: 'Missing image_base64 or mime_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type, data: image_base64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
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

    // Sanitize: only accept values matching our known dropdown options.
    // Anything else (hallucinated or malformed) falls back to null so it
    // can never silently write bad data into a plant record.
    const result = {
      identified: Boolean(parsed.identified),
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
      common_name: parsed.common_name || null,
      scientific_name: parsed.scientific_name || null,
      watering: sanitizeEnum('watering', parsed.watering),
      sunlight: sanitizeEnum('sunlight', parsed.sunlight),
      soil_type: sanitizeEnum('soil_type', parsed.soil_type),
      humidity: sanitizeEnum('humidity', parsed.humidity),
      ph_level: sanitizeEnum('ph_level', parsed.ph_level),
      temp_min: typeof parsed.temp_min === 'number' ? parsed.temp_min : null,
      temp_max: typeof parsed.temp_max === 'number' ? parsed.temp_max : null,
      fertilizer_frequency: sanitizeEnum('fertilizer_frequency', parsed.fertilizer_frequency),
      pruning_frequency: sanitizeEnum('pruning_frequency', parsed.pruning_frequency),
      cycle: sanitizeEnum('cycle', parsed.cycle),
      care_level: sanitizeEnum('care_level', parsed.care_level),
      poisonous_to_pets: typeof parsed.poisonous_to_pets === 'boolean' ? parsed.poisonous_to_pets : null,
      poisonous_to_humans: typeof parsed.poisonous_to_humans === 'boolean' ? parsed.poisonous_to_humans : null,
      care_guide: {
        watering: parsed.care_guide?.watering || '',
        sunlight: parsed.care_guide?.sunlight || '',
        pruning: parsed.care_guide?.pruning || '',
      },
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('identify-plant error:', err)
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})