export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    email, first_name, barrier_score, barrier_category,
    top_factors, free_text_reactivity, free_text_final,
    full_report, source, timestamp
  } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  const RESEND_KEY      = process.env.RESEND_API_KEY;
  const MAILERLITE_KEY  = process.env.MAILERLITE_API_KEY;
  const GROUP_ID        = '181683191179904610';

  // ─── STEP 1: Add to MailerLite ───────────────────────────────────────────────
  try {
    const subRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MAILERLITE_KEY}`,
      },
      body: JSON.stringify({
        email,
        fields: { name: first_name || '', barrier_score: String(barrier_score || '') },
        groups: [GROUP_ID],
      }),
    });
    if (!subRes.ok) {
      const err = await subRes.json();
      console.error('MailerLite error:', JSON.stringify(err));
    }
  } catch (e) {
    console.error('MailerLite error:', e.message);
  }

  // ─── STEP 2: Format report for email ─────────────────────────────────────────
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

  const hasFreeText = free_text_reactivity || free_text_final;
  const freeTextBlock = hasFreeText ? `
    <div style="background:#f9f5f0;border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid rgba(165,190,165,.2);">
      <p style="font-family:sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#A0505E;margin:0 0 10px;font-weight:600;">In Your Own Words</p>
      ${free_text_reactivity ? `<p style="font-family:sans-serif;font-size:13px;font-style:italic;color:#3d4a3a;line-height:1.7;margin:0 0 8px;">"${free_text_reactivity}"</p>` : ''}
      ${free_text_final ? `<p style="font-family:sans-serif;font-size:13px;font-style:italic;color:#3d4a3a;line-height:1.7;margin:0;">"${free_text_final}"</p>` : ''}
    </div>` : '';

  const emailHtml = `
    <div style="max-width:600px;margin:0 auto;background:#fbf8f3;padding:40px 36px;font-family:sans-serif;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#3d5940,#4a6e4e);padding:28px 32px;border-radius:16px 16px 0 0;margin:-40px -36px 32px;">
        <p style="color:rgba(208,228,198,.8);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;">Ritual Script Skincare</p>
        <h1 style="color:#f5f0e8;font-size:26px;font-weight:300;margin:0 0 4px;font-family:Georgia,serif;">Your Barrier Health Report</h1>
        <p style="color:rgba(208,228,198,.75);font-size:12px;margin:0;">Certified Skincare Coach &amp; Licensed Advanced Pharmacy Technician</p>
      </div>

      <!-- Greeting -->
      <p style="font-size:15px;color:#3d5940;font-family:Georgia,serif;font-style:italic;margin:0 0 6px;">
        Hi ${first_name || 'there'},
      </p>
      <p style="font-size:14px;color:#6a7a65;line-height:1.8;margin:0 0 24px;">
        Thank you for completing the Barrier Health Index. Here is your personalized report based on everything you shared.
      </p>

      <!-- Score badge -->
      <div style="background:#f0f5f0;border:1px solid rgba(74,110,78,.2);border-radius:14px;padding:18px 24px;margin-bottom:24px;display:flex;align-items:center;">
        <div>
          <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4a6e4e;margin:0 0 4px;font-weight:600;">Your Barrier Health Score</p>
          <p style="font-family:Georgia,serif;font-size:26px;color:#3d5940;margin:0;font-weight:400;">${barrier_score} — ${barrier_category}</p>
          ${top_factors ? `<p style="font-size:12px;color:#6a7a65;margin:6px 0 0;">Top contributing factors: ${top_factors}</p>` : ''}
        </div>
      </div>

      <!-- Free text if provided -->
      ${freeTextBlock}

      <!-- Report content -->
      <div style="background:white;border-radius:14px;padding:24px 28px;border:1px solid rgba(165,190,165,.2);margin-bottom:28px;">
        ${formattedReport || '<p style="font-size:14px;color:#6a7a65;">Your personalized report content is included above.</p>'}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="https://ritualscript.com" style="background:#4a6e4e;color:#f5f0e8;padding:14px 36px;border-radius:50px;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:500;">
          Explore Ritual Script →
        </a>
      </div>

      <!-- Footer -->
      <p style="font-size:10px;color:#b0bfa8;text-align:center;line-height:1.6;">
        This assessment is educational in nature and does not constitute medical advice.<br>
        Questions? <a href="mailto:hello@ritualscript.com" style="color:#8a9e84;">hello@ritualscript.com</a><br><br>
        You're receiving this because you completed the Barrier Health Index at tools.ritualscript.com.<br>
        To unsubscribe from The Script newsletter, reply with "unsubscribe."
      </p>
    </div>
  `;

  // ─── STEP 3: Send via Resend ──────────────────────────────────────────────────
  try {
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: 'Rachel at Ritual Script <hello@ritualscript.com>',
        to: [email],
        subject: `Your Barrier Health Report — ${barrier_score || 'Results Inside'}`,
        html: emailHtml,
      }),
    });
    if (!sendRes.ok) {
      const err = await sendRes.json();
      console.error('Resend error:', JSON.stringify(err));
    } else {
      console.log('Resend: email sent to', email);
    }
  } catch (e) {
    console.error('Resend error:', e.message);
  }

  return res.status(200).json({ success: true });
}
