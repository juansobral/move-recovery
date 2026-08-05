export interface BookingMailData {
  id: number | string;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  notes?: string | null;
}

export interface MailMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}
