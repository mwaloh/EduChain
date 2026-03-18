import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

// Email service for EduChain notifications
export class EmailService {
  private transporter: nodemailer.Transporter;
  private sendgridConfigured: boolean = false;

  constructor() {
    // Configure SendGrid if API key is available
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey);
      this.sendgridConfigured = true;
      console.log('📧 Email service: SendGrid configured');
    } else {
      // Fallback to nodemailer with SMTP
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('📧 Email service: SMTP configured');
    }
  }

  async sendCredentialIssuedEmail(params: {
    studentEmail: string;
    studentName: string;
    institutionName: string;
    degree: string;
    claimToken: string;
    claimUrl: string;
  }) {
    const { studentEmail, studentName, institutionName, degree, claimUrl } = params;

    const subject = `Your Digital Diploma is Ready - ${institutionName}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Your Digital Diploma</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">🎓 EduChain</h1>
            <p style="color: #6b7280; margin: 5px 0;">Decentralized Academic Credentials</p>
          </div>

          <div style="background: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1f2937; margin-top: 0;">Congratulations, ${studentName}!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Your <strong>${degree}</strong> from <strong>${institutionName}</strong> has been issued as a digital credential on the blockchain.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${claimUrl}"
               style="background: #6366f1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Claim Your Digital Diploma
            </a>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="color: #92400e; margin-top: 0;">What happens next?</h3>
            <ol style="color: #92400e; line-height: 1.6;">
              <li>Click the button above to claim your credential</li>
              <li>Connect your wallet (we'll help you create one if needed)</li>
              <li>View your digital diploma in your personal dashboard</li>
              <li>Share it with employers using QR codes and verification links</li>
            </ol>
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p>This is a secure, blockchain-verified credential that cannot be altered or forged.</p>
            <p>Questions? Contact your institution's registrar.</p>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail(studentEmail, subject, html);
  }

  async sendCredentialVerifiedEmail(params: {
    studentEmail: string;
    studentName: string;
    employerName: string;
    degree: string;
    verificationDate: string;
  }) {
    const { studentEmail, studentName, employerName, degree, verificationDate } = params;

    const subject = `Your Credential Was Verified by ${employerName}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Credential Verified</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10b981; margin: 0;">✅ Verified</h1>
            <p style="color: #6b7280; margin: 5px 0;">Your EduChain credential has been verified</p>
          </div>

          <div style="background: #f0fdf4; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #166534; margin-top: 0;">Hi ${studentName}!</h2>
            <p style="color: #166534; line-height: 1.6;">
              <strong>${employerName}</strong> verified your <strong>${degree}</strong> credential on ${verificationDate}.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="color: #374151; margin-top: 0;">What this means:</h3>
            <ul style="color: #4b5563; line-height: 1.6;">
              <li>Your credential's authenticity was confirmed on the blockchain</li>
              <li>The verification is permanently recorded for compliance</li>
              <li>You can view this activity in your EduChain dashboard</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student"
               style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View in Dashboard
            </a>
          </div>
        </body>
      </html>
    `;

  async sendInstitutionVerificationEmail(params: {
    adminEmail: string;
    adminName: string;
    institutionName: string;
    verificationUrl: string;
  }) {
    const { adminEmail, adminName, institutionName, verificationUrl } = params;

    const subject = `Verify Your EduChain Institution Account - ${institutionName}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Institution Account</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">🎓 EduChain</h1>
            <p style="color: #6b7280; margin: 5px 0;">Institution Registration</p>
          </div>

          <div style="background: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1f2937; margin-top: 0;">Welcome, ${adminName}!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Thank you for registering <strong>${institutionName}</strong> with EduChain.
              To complete your registration, please verify your email address.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background: #6366f1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Verify Email Address
            </a>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="color: #92400e; margin-top: 0;">What happens next?</h3>
            <ol style="color: #92400e; line-height: 1.6;">
              <li>Click the verification link above</li>
              <li>EduChain administrators will review your registration</li>
              <li>Domain ownership will be verified</li>
              <li>You'll receive final approval and setup instructions</li>
              <li>Start issuing blockchain credentials to your students</li>
            </ol>
          </div>

          <div style="background: #f0fdf4; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="color: #166534; margin-top: 0;">EduChain Benefits</h3>
            <ul style="color: #166534; line-height: 1.6;">
              <li>Issue tamper-proof digital diplomas</li>
              <li>Students receive instant email notifications</li>
              <li>Employers can verify credentials instantly</li>
              <li>Complete audit trail for compliance</li>
              <li>Integration with existing student systems</li>
            </ul>
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p>This link will expire in 24 hours.</p>
            <p>Questions? Contact support@educhain.edu</p>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail(adminEmail, subject, html);
  }
    try {
      if (this.sendgridConfigured) {
        await sgMail.send({
          to,
          from: process.env.FROM_EMAIL || 'noreply@educhain.edu',
          subject,
          html,
        });
      } else {
        await this.transporter.sendMail({
          from: process.env.FROM_EMAIL || 'noreply@educhain.edu',
          to,
          subject,
          html,
        });
      }
      console.log(`📧 Email sent to ${to}: ${subject}`);
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();