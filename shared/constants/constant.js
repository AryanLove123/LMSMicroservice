const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    EMPLOYEE: 'employee'
}

const LEAVE_TYPES = {
  CASUAL: 'casual',
  SICK: 'sick',
  PRIVILEGE: 'privilege',
};

const LEAVE_COUNT = {
  [LEAVE_TYPES.CASUAL]: 12,
  [LEAVE_TYPES.SICK]: 10,
  [LEAVE_TYPES.PRIVILEGE]: 15,
};

const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const NOTIFICATION_TYPES ={
  LEAVE_REQUESTED: 'LEAVE_REQUESTED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  LEAVE_CANCELLED: 'LEAVE_CANCELLED',
};

const NOTIFICATION_CHANNELS = {
    EMAIL: 'email',
    LOG:   'log',
};

const NOTIFICATION_STATUS = {
    PENDING:  'pending',
    SENT:     'sent',
    FAILED:   'failed',
};

const SAGA_STATUS = {
  STARTED: 'STARTED',
  BALANCE_DEDUCTED: 'BALANCE_DEDUCTED',
  COMPLETED: 'COMPLETED',
  COMPENSATING: 'COMPENSATING',
  FAILED: 'FAILED',
};

const RABBIT_EXCHANGES = {
  USER_EVENTS: 'user_events',
  LEAVE_EVENTS: 'leave_events',
  SAGA_EVENTS: 'saga_events',
  NOTIFICATION_EVENTS: 'notification_events',
}

const RABBIT_QUEUES = {
  USER_CREATED: 'user_created',
  LEAVE_REQUESTED: 'leave_requested',
  LEAVE_APPROVED: 'leave_approved',
  LEAVE_REJECTED: 'leave_rejected',
  LEAVE_CANCELLED: 'leave_cancelled',
  SAGA_DEDUCT_BALANCE: 'saga_deduct_balance',
  SAGA_DEDUCT_SUCCESS: 'saga_deduct_success',
  SAGA_DEDUCT_FAILURE: 'saga_deduct_failure',
  NOTIFY_LEAVE_APPROVAL: 'notify_leave_approval',
  NOTIFY_LEAVE_REJECTION: 'notify_leave_rejection',
}

const RABBIT_ROUTING_KEYS = {
  USER_CREATED: 'user.created',
  LEAVE_REQUESTED: 'leave.requested',
  LEAVE_APPROVED: 'leave.approved',
  LEAVE_REJECTED: 'leave.rejected',
  LEAVE_CANCELLED: 'leave.cancelled',
  SAGA_DEDUCT_BALANCE: 'saga.deduct_balance',
  SAGA_DEDUCT_SUCCESS: 'saga.deduct_success',
  SAGA_DEDUCT_FAILURE: 'saga.deduct_failure',
  NOTIFY_LEAVE_APPROVAL: 'notify.leave_approval',
  NOTIFY_LEAVE_REJECTION: 'notify.leave_rejection',
}


module.exports = {ROLES, LEAVE_TYPES, LEAVE_COUNT, LEAVE_STATUS, NOTIFICATION_TYPES, NOTIFICATION_CHANNELS, NOTIFICATION_STATUS, RABBIT_EXCHANGES, RABBIT_QUEUES, RABBIT_ROUTING_KEYS, SAGA_STATUS};