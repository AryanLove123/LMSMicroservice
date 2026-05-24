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

module.exports = {ROLES, LEAVE_TYPES, LEAVE_COUNT}