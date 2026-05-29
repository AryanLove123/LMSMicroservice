const { Notification, NOTIFICATION_CHANNELS, NOTIFICATION_STATUS } = require('../models/Notification');
const { NOTIFICATION_TYPES } = require('../../../../shared/constants/constant');
const { employeeTemplate, managerTemplate } = require('../templates/leaveRequestedTemplate');
const { approvalTemplate }  = require('../templates/leaveApprovedTemplate');
const { rejectionTemplate } = require('../templates/leaveRejectedTemplate');
const { wrapHtml }          = require('../templates/layoutTemplate');
const EmailDriver = require('../utils/EmailDriver')

class NotificationService {
    constructor(logger, rabbitMQ, driver) {
        this.logger  = logger;
        this.rabbitMQ = rabbitMQ;
        this.driver  = driver;
    }

    // ─── internal dispatch ─────────────────────────────────────────────────────

    /**
     * Send one notification through the configured driver and persist a record.
     */
    async _dispatch({ type, recipientId, recipientEmail, recipientName, subject, html, metadata }) {
        const channel = this.driver instanceof EmailDriver
            ? NOTIFICATION_CHANNELS.EMAIL
            : NOTIFICATION_CHANNELS.LOG;

        const doc = await Notification.create({
            recipientId,
            recipientEmail,
            recipientName,
            type,
            channel,
            status: NOTIFICATION_STATUS.PENDING,
            metadata,
        });

        try {
            await this.driver.send({ to: recipientEmail, toName: recipientName, subject, html, metadata });
            doc.status = NOTIFICATION_STATUS.SENT;
            doc.sentAt = new Date();
        } catch (err) {
            this.logger.error('[NotificationService] Driver failed to deliver notification', {
                type, recipientId, error: err.message,
            });
            doc.status       = NOTIFICATION_STATUS.FAILED;
            doc.errorMessage = err.message;
        }

        await doc.save();
        return doc;
    }

    // ─── public handlers ───────────────────────────────────────────────────────

    /**
     * Notify the manager when an employee requests leave.
     * Also sends a confirmation email to the employee.
     */
    async notifyManagerOfLeaveRequest(msg) {
        const {
            leaveRequestId, employeeId, employeeName, employeeEmail,
            managerId, managerEmail, managerName,
            leaveType, startDate, endDate, numberOfDays, reason,
        } = msg;

        const templateData = { employeeName, leaveType, startDate, endDate, numberOfDays, reason };

        // 1 — Confirmation to the employee
        await this._dispatch({
            type:           NOTIFICATION_TYPES.LEAVE_REQUESTED,
            recipientId:    employeeId,
            recipientEmail: employeeEmail,
            recipientName:  employeeName,
            subject:        `Leave request submitted — ${leaveType}`,
            html:           wrapHtml('Your Leave Request', employeeTemplate(templateData)),
            metadata:       { leaveRequestId, leaveType, startDate, endDate, numberOfDays },
        });

        // 2 — Alert to the manager (skip silently if manager email is unavailable)
        if (managerEmail) {
            await this._dispatch({
                type:           NOTIFICATION_TYPES.LEAVE_REQUESTED,
                recipientId:    managerId,
                recipientEmail: managerEmail,
                recipientName:  managerName || 'Manager',
                subject:        `Leave approval required — ${employeeName}`,
                html:           wrapHtml('New Leave Request', managerTemplate(templateData)),
                metadata:       { leaveRequestId, employeeId, employeeName, leaveType, startDate, endDate, numberOfDays },
            });
        } else {
            this.logger.warn('[NotificationService] Manager email not available; skipping manager notification', {
                managerId, employeeId, leaveRequestId,
            });
        }
    }

    /**
     * Notify the employee when their leave is approved.
     */
    async notifyEmployeeOfLeaveApproval(msg) {
        const {
            leaveId, employeeId, employeeName, employeeEmail,
            leaveType, startDate, endDate, numberOfDays, reason,
        } = msg;

        await this._dispatch({
            type:           NOTIFICATION_TYPES.LEAVE_APPROVED,
            recipientId:    employeeId,
            recipientEmail: employeeEmail,
            recipientName:  employeeName,
            subject:        `Your leave has been approved — ${leaveType}`,
            html:           wrapHtml('Leave Approved', approvalTemplate({ employeeName, leaveType, startDate, endDate, numberOfDays, reason })),
            metadata:       { leaveId, leaveType, startDate, endDate, numberOfDays },
        });
    }

    /**
     * Notify the employee when their leave is rejected.
     */
    async notifyEmployeeOfLeaveRejection(msg) {
        const {
            leaveId, employeeId, employeeName, employeeEmail,
            leaveType, startDate, endDate, numberOfDays, reason, reviewComments,
        } = msg;

        await this._dispatch({
            type:           NOTIFICATION_TYPES.LEAVE_REJECTED,
            recipientId:    employeeId,
            recipientEmail: employeeEmail,
            recipientName:  employeeName,
            subject:        `Your leave request was not approved — ${leaveType}`,
            html:           wrapHtml('Leave Not Approved', rejectionTemplate({ employeeName, leaveType, startDate, endDate, numberOfDays, reason: reviewComments || reason })),
            metadata:       { leaveId, leaveType, startDate, endDate, numberOfDays, reviewComments },
        });
    }

    // ─── query ─────────────────────────────────────────────────────────────────

    async getNotifications(userId, { page = 1, limit = 10, type } = {}) {
        const query = { recipientId: userId };
        if (type) query.type = type;

        const [notifications, total] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Notification.countDocuments(query),
        ]);

        return {
            notifications,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

module.exports = NotificationService;
