const ROLES = {
    ADMIN: 'admin',
    MANGER: 'manager',
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

const RABBIT_EXCHANGES = {
  USER_EVENTS: 'user_events',
}

const RABBIT_QUEUES = {
  USER_CREATED: 'user_created',
}

const RABBIT_ROUTING_KEYS = {
  USER_CREATED: 'user.created',
}


module.exports = {ROLES, LEAVE_TYPES, LEAVE_COUNT, RABBIT_EXCHANGES, RABBIT_QUEUES, RABBIT_ROUTING_KEYS}