export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, barrier_score, primary_concern, duration, routine, full_report } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const API_KEY = process.env.MAILERLITE_API_KEY;
  const GROUP_ID = '181683191179904610';

  // ─── STEP 1: Add subscriber to group ────────────────────────────────────────
  try {
    const subResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        email,
        groups: [GROUP_ID],
        fields: {
          barrier_score: barrier_score || '',
          primary_concern: primary_concern || '',
        },
      }),
    });
    const subData = await subResponse.json();
    if (!subResponse.ok) return res.status(subResponse.status).json({ error: subData });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  // ─── STEP 2: Send report email ───────────────────────────────────────────────
  const formattedReport = (full_report || '')
    .split('\n')
    .filter(l => l.trim())
    .map(line => {
      const isHeader = line.match(/^[A-Z][A-Z\s&:\-]+:?$/) && line.length < 70;
      if (isHeader) {
        return `<p style="font-family:sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4a6e4e;margin:24px 0 6px;font-weight:600;">${line.replace(/:$/, '')}</p>`;
      }
      return `<p style="font-family:sans-serif;font-size:14px;color:#3d4a3a;line-height:1.8;margin:0 0 8px;font-weight:300;">${line}</p>`;
    })
    .join('');

  const emailHtml = `
    <div style="max-width:600px;margin:0 auto;background:#fbf8f3;padding:40px 36px;font-family:sans-serif;">
      <div style="background:linear-gradient(135deg,#3d5940,#4a6e4e);padding:28px 32px;border-radius:16px 16px 0 0;margin:-40px -36px 32px;">
        <p style="color:rgba(208,228,198,.8);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;">Ritual Script Skincare</p>
        <h1 style="color:#f5f0e8;font-size:26px;font-weight:300;margin:0 0 4px;">Your Barrier Health Report</h1>
        <p style="color:rgba(208,228,198,.75);font-size:12px;margin:0;">Advanced Pharmacy Technician & Certified Skincare Coach</p>
      </div>

      <p style="font-size:14px;color:#6a7a65;line-height:1.8;margin:0 0 24px;">
        Thank you for completing the Barrier Health Index. Here is your personalized report based on everything you shared.
      </p>

      <div style="background:white;border-radius:14px;padding:24px 28px;border:1px solid rgba(165,190,165,.2);margin-bottom:28px;">
        ${formattedReport}
      </div>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="https://ritualscript.com" style="background:#4a6e4e;color:#f5f0e8;padding:14px 36px;border-radius:50px;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:500;">
          Explore Ritual Script →
        </a>
      </div>

      <p style="font-size:10px;color:#b0bfa8;text-align:center;line-height:1.6;">
        This assessment is educational in nature and does not constitute medical advice.<br>
        Questions? Reply to this email or contact <a href="mailto:hello@ritualscript.com" style="color:#8a9e84;">hello@ritualscript.com</a>
      </p>
    </div>
  `;

  try {
    await fetch('https://connect.mailerlite.com/api/messages/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        from: { email: 'hello@ritualscript.com', name: 'Rachel at Ritual Script' },
        to: [{ email }],
        subject: `Your Barrier Health Report — ${barrier_score || 'Results Inside'}`,
        html: emailHtml,
      }),
    });
  } catch (error) {
    // Don't fail the whole request if email sending fails
    console.error('Email send error:', error.message);
  }

  return res.status(200).json({ success: true });
}
