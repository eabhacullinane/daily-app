const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const today = new Date();
const dateStr = today.toISOString().slice(0, 10);
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const dayName = dayNames[today.getDay()];

const PROMPT = `You are generating Eabha's daily morning briefing for ${dayName}, ${dateStr}. Be concise and scannable. Use the web_search tool proactively to find real, current information.

## 🎧 Today's Listen
Search for the most recent episode released in the last 7 days from: BBC Global News Podcast, The Daily (NYT), Huberman Lab, Diary of a CEO (Steven Bartlett), Planet Money (NPR). Also look for compelling recent episodes on: PE/impact investing, biohacking, psychology, performance, economics, leadership, health, geopolitics.

Pick the SINGLE best listen for today. Give:
- Episode title
- Podcast name
- 2-sentence description
- Why it's the right listen today specifically
- Direct link to episode or podcast feed

## 🌍 Morning News Digest
Search for today's top stories from BBC World News, The Economist, Financial Times, or Reuters. Summarise 3 of the most important stories in 2–3 sentences each. Prioritise: geopolitics, economic/market news, science/health/climate. Include outlet name and a link for each.

## 💼 PE & Impact Investing
Search for 2–3 of the most notable recent moves in private equity and impact investing: fund closes, ESG/impact deals, emerging market activity, regulatory shifts, notable exits. Include source and link for each.

## 🏃 Training Today
Today is ${dayName}. Eabha's running context:
- Running since January 2026, 4-5x/week
- Two run clubs: Paris 11 RC (Saturdays), KIIN Run Club Paris (Sundays)
- Current 5K PR: ~28:20 | Longest run: 8km
- Goals: Sub-28 min 5K, build to 10km long run by end of July 2026
- Weekly template: Mon rest/easy, Tue intervals, Wed easy, Thu rest/easy, Fri easy, Sat run club, Sun long run

Recommend today's session with 3 options (A: ideal, B: lighter, C: rest/skip). Use web_search to find one current evidence-based running tip relevant to her training phase. End with: "📝 Log yesterday's run in your app."

## 🌿 Morning Prompt
One journaling or meditation prompt. Rotate themes: gratitude, goals, challenges, relationships, creativity, identity, values, energy/body. 1–2 sentences. Make it personal, specific, and thoughtful.

End with a single short energising line.`;

async function generateBriefing() {
  console.log(`Generating briefing for ${dayName}, ${dateStr}...`);

  const messages = [{ role: 'user', content: PROMPT }];
  let finalText = '';

  // Agentic loop to handle web search tool use
  for (let turn = 0; turn < 10; turn++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages
    });

    console.log(`Turn ${turn + 1}: stop_reason=${response.stop_reason}, blocks=${response.content.length}`);

    if (response.stop_reason === 'end_turn') {
      finalText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      break;
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      // For web_search_20250305, the API executes searches server-side.
      // We acknowledge each tool_use block with an empty tool_result.
      const toolResults = response.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: [] }));

      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unexpected stop reason — extract any text and stop
    finalText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
    break;
  }

  if (!finalText) {
    throw new Error('No text content generated');
  }

  const briefing = {
    date: dateStr,
    day: dayName,
    generated_at: new Date().toISOString(),
    content: finalText
  };

  fs.writeFileSync('briefing.json', JSON.stringify(briefing, null, 2));
  console.log('✓ Saved to briefing.json');
  console.log(`  Content length: ${finalText.length} chars`);
}

generateBriefing().catch(err => {
  console.error('Failed to generate briefing:', err.message);
  process.exit(1);
});
