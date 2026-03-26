const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const sesClient = new SESClient({ region: process.env.REGION || process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
  const { userId, email, analysis } = event;
  console.log(`Sending notification to ${email}`);
  
  try {
    const html = `
      <html>
        <body style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; color: white; text-align: center;">
            <h1>🏈 Fantasy Football AI Coach</h1>
            <p style="font-size: 18px;">Week ${analysis.weekNumber} Analysis</p>
          </div>
          <div style="margin: 20px 0;">
            <p>${analysis.analysis}</p>
            ${analysis.recommendations.map(r => `
              <div style="margin: 15px 0; padding: 15px; background: #f8fafc; border-left: 4px solid #667eea; border-radius: 4px;">
                <strong>${r.type.replace('_', ' ').toUpperCase()}</strong>
                <p>${r.text}</p>
              </div>
            `).join('')}
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center;">
            Powered by AWS & Claude AI
          </p>
        </body>
      </html>
    `;
    
    await sesClient.send(new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: '🏈 Your Fantasy Football Analysis is Ready!' },
        Body: { Html: { Data: html } }
      }
    }));
    
    console.log('Email sent successfully!');
    return {
      statusCode: 200,
      body: JSON.stringify({ sent: true, email: email })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({ sent: false, error: error.message })
    };
  }
};
