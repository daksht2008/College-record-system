let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    console.warn("⚠️ nodemailer is not installed. Emails will be printed to console. Run 'npm install nodemailer' to send real emails.");
}

// Ensure you set EMAIL_USER and EMAIL_PASS in your environment
const transporter = nodemailer ? nodemailer.createTransport({
    service: 'gmail', // You can change this to any provider
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
}) : null;

/**
 * Sends an email
 * @param {string|string[]} to - Recipient email(s)
 * @param {string} subject - Email subject
 * @param {string} text - Email body text
 */
async function sendEmail(to, subject, text) {
    if (!to || to.length === 0) return;
    
    // Fallback if nodemailer not installed or no credentials
    if (!transporter || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log(`\n📧 --- MOCK EMAIL ---`);
        console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${text}`);
        console.log(`-----------------------\n`);
        return true;
    }

    try {
        const mailOptions = {
            from: `"EduSync Admin" <${process.env.EMAIL_USER}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
            text: text
        };
        await transporter.sendMail(mailOptions);
        return true;
    } catch (err) {
        console.error('Error sending email:', err);
        return false;
    }
}

module.exports = { sendEmail };
