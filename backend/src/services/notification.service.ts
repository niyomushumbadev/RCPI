import { prisma } from '../config/db';

export type NotificationType =
  | 'REPORT_SUBMITTED'
  | 'REPORT_RECEIVED'
  | 'REPORT_VERIFIED'
  | 'REPORT_REJECTED'
  | 'REPORT_ASSIGNED'
  | 'REPORT_UPDATED'
  | 'REPORT_ESCALATED'
  | 'REPORT_RESOLVED'
  | 'REPORT_REOPENED'
  | 'REPORT_CLOSED'
  | 'INFO_REQUESTED'
  | 'DEADLINE_APPROACHING'
  | 'REPORT_OVERDUE'
  | 'FEEDBACK_REQUEST'
  | 'GOVERNMENT_MESSAGE'
  | 'COMMUNITY_ALERT'
  | 'SECURITY_NEW_LOGIN'
  | 'SECURITY_PASSWORD_CHANGED'
  | 'FEEDBACK_REQUEST';

interface CreateNotificationInput {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  reportId?: number;
}

/** Fire-and-forget notification creation. Never throws into caller flow. */
export async function notify(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        reportId: input.reportId ?? null,
      },
    });
  } catch (err) {
    console.error('[notify] failed:', err);
  }
}
