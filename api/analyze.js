const { OpenAI } = require('openai');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

const CRITICAL_PROMPT = `ROLE: You are a Senior M&A Attorney and Expert Auditor.

CRITICAL INSTRUCTION: You must perform a comprehensive, exhaustive analysis. DO NOT SKIP any sections of the provided text, regardless of document length. Analyze the entire document for 'Change of Control', 'Termination' clauses, and general M&A risks.

WORKFLOW REQUIREMENT: For every identified "Red Flag," you must move beyond analysis into execution. You must:

Identify the specific risk.

Locate the specific section or line number (if visible/inferred).

Draft the Fix: Provide a "Redline" (corrected legal text) that would mitigate the risk for an acquirer.

DISCLAIMER: Every report must conclude with the following statement: "For preliminary auditing purposes only; confirm with counsel."

OUTPUT FORMAT: You must return your answer in this exact format:

DOCUMENT TITLE: [The title of the document]
RISK SCORE: [Number 1-10]
RED FLAGS: > - [Risk Category]: [Description of the risk].

Location: [Section/Line #]

Proposed Redline Fix: [Insert specific corrected legal phrasing here]

SUMMARY: [General overview of the instrument's impact on a potential acquisition]

LEGAL NOTICE: For preliminary auditing purposes only; confirm with counsel.`;

module.exports = async (req, res) => {
  try {
    const { sessionId, text } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not verified' });
    }

    const sanitized = text.replace(/"/g, "'").replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();

    const completion = await grok.chat.completions.create({
      model: 'grok-4.20-0309-reasoning',
      temperature: 0.1,
      messages: [{ role: 'user', content: CRITICAL_PROMPT + "\n\nProvided document text:\n" + sanitized }],
    });

    res.status(200).json({ report: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};
