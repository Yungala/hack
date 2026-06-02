import Anthropic from 'npm:@anthropic-ai/sdk@0.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, mediaType = 'image/png' } = await req.json() as {
      imageBase64: string;
      mediaType?: string;
    };

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as 'image/png', data: imageBase64 },
            },
            {
              type: 'text',
              text: `이 그림을 보고 JSON으로만 응답해줘. 다른 텍스트 없이 JSON만.

규칙:
- 선정적, 고어, 혐오, 욕설이 포함되면 approved: false
- 그 외 모두 approved: true
- comment는 한국어로 친근하게. 뭘 그렸는지 추측하며 짧게 (20자 이내).
  예시: "강아지를 그리셨군요! 귀엽네요 🐶"
- 반려 시 comment: "이 그림은 게시할 수 없어요."

{"approved": true/false, "comment": "..."}`,
            },
          ],
        },
      ],
    });

    const text = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('invalid response');

    const result = JSON.parse(jsonMatch[0]) as { approved: boolean; comment: string };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ approved: true, comment: '그림을 올렸어요!' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
