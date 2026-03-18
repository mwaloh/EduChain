/**
 * QR Code Service
 * Handles QR code generation for credential sharing
 */

export class QRService {
  /**
   * Generate QR code data URL for a shareable credential link
   * Returns a PNG data URL that can be embedded in HTML or converted to image buffer
   */
  static async generateQRDataURL(url: string): Promise<string> {
    try {
      // Dynamically import qrcode (client-side usage in Next.js)
      // For server-side generation, we'd use: const QRCode = require('qrcode');
      const QRCode = require('qrcode');
      const dataURL = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return dataURL;
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate shareable credential link
   */
  static generateShareLink(token: string, baseUrl: string = 'http://localhost:3000'): string {
    return `${baseUrl}/verify/${token}`;
  }

  /**
   * Generate credential share metadata for social media
   */
  static generateShareMetadata(params: {
    degree: string;
    institution: string;
    studentName: string;
  }): { title: string; description: string; hashtags: string } {
    return {
      title: `I just verified my ${params.degree} credential on EduChain! 🎓`,
      description: `Verified credential from ${params.institution} on EduChain - the blockchain-based credential verification system. Verify: `,
      hashtags: '#EduChain #DigitalCredentials #BlockchainEducation #Verified',
    };
  }
}